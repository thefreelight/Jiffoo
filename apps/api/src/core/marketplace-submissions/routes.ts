/**
 * Marketplace Submissions Routes
 *
 * Developer-facing endpoints (developer API key auth; accounts are issued by
 * the platform) and admin endpoints (admin auth): submission review, publish
 * lifecycle, artifact download, and developer account management.
 *
 * GET /developer-portal (mounted separately) serves the self-service submit
 * page for developers who prefer a form over the API.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, adminMiddleware } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';
import { prisma } from '@/config/database';
import {
  MarketplaceSubmissionsService,
  SubmissionError,
} from './service';
import {
  createDeveloperAccount,
  developerAuth,
  DeveloperError,
  getDeveloperIdentity,
  listDeveloperAccounts,
  revokeDeveloperAccount,
} from './developer-accounts';
import { getStoredArtifactStream, saveUploadedArtifact } from './artifact-store';

function getService() {
  return new MarketplaceSubmissionsService(prisma as unknown as PrismaClient);
}

function handleError(reply: FastifyReply, error: unknown) {
  if (error instanceof SubmissionError) {
    return sendError(reply, error.statusCode, error.code, error.message, error.details);
  }
  if (error instanceof DeveloperError) {
    return sendError(reply, error.statusCode, error.code, error.message);
  }
  return sendError(reply, 500, 'SUBMISSION_INTERNAL', 'Failed to process submission request');
}

interface SubmissionParams {
  id: string;
}

export async function developerSubmissionRoutes(fastify: FastifyInstance) {
  const service = getService();

  fastify.addHook('preHandler', developerAuth);

  fastify.get(
    '/developer/me',
    async (request: FastifyRequest, reply: FastifyReply) => {
      return sendSuccess(reply, { developer: getDeveloperIdentity(request) });
    },
  );

  fastify.post(
    '/developer/submissions',
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      try {
        const developer = getDeveloperIdentity(request);
        const body = { ...((request.body ?? {}) as Record<string, unknown>) };
        // Identity comes from the API key account, not the payload.
        body.developerName = developer.name;
        body.developerEmail = developer.email;
        const result = await service.createSubmission(body as never);
        return sendSuccess(
          reply,
          { submission: result.submission, validation: result.validation },
          'Submission created (status: draft)',
          201,
        );
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  fastify.get(
    '/developer/submissions',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const developer = getDeveloperIdentity(request);
        const submissions = await service.listSubmissions({ developerEmail: developer.email });
        return sendSuccess(reply, { submissions });
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  fastify.get(
    '/developer/submissions/:id',
    async (request: FastifyRequest<{ Params: SubmissionParams }>, reply: FastifyReply) => {
      try {
        const developer = getDeveloperIdentity(request);
        const submission = await service.getSubmission(request.params.id);
        if (submission.developerEmail !== developer.email) {
          return sendError(reply, 403, 'SUBMISSION_FORBIDDEN', 'This submission belongs to another developer');
        }
        return sendSuccess(reply, { submission });
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  fastify.post(
    '/developer/submissions/:id/artifact',
    async (
      request: FastifyRequest<{ Params: SubmissionParams; Body: { artifactUrl?: string; checksumSha256?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const developer = getDeveloperIdentity(request);
        const existing = await service.getSubmission(request.params.id);
        if (existing.developerEmail !== developer.email) {
          return sendError(reply, 403, 'SUBMISSION_FORBIDDEN', 'This submission belongs to another developer');
        }
        const { artifactUrl, checksumSha256 } = (request.body ?? {}) as { artifactUrl?: string; checksumSha256?: string };
        if (!artifactUrl) {
          return sendError(reply, 400, 'SUBMISSION_ARTIFACT_REQUIRED', 'artifactUrl is required');
        }
        return sendSuccess(
          reply,
          { submission: await service.setArtifact(request.params.id, artifactUrl, checksumSha256) },
          'Artifact attached',
        );
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  fastify.post(
    '/developer/submissions/:id/artifact/upload',
    async (request: FastifyRequest<{ Params: SubmissionParams }>, reply: FastifyReply) => {
      try {
        const developer = getDeveloperIdentity(request);
        const existing = await service.getSubmission(request.params.id);
        if (existing.developerEmail !== developer.email) {
          return sendError(reply, 403, 'SUBMISSION_FORBIDDEN', 'This submission belongs to another developer');
        }
        const file = await (request as unknown as {
          file: () => Promise<{ filename: string; file: NodeJS.ReadableStream } | undefined>;
        }).file();
        if (!file) {
          return sendError(reply, 400, 'SUBMISSION_FILE_REQUIRED', 'Send the artifact as a multipart file field');
        }
        const stored = await saveUploadedArtifact(request.params.id, file.filename, file.file);
        const submission = await service.setStoredArtifact(request.params.id, stored);
        return sendSuccess(reply, { submission }, 'Artifact uploaded', 201);
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  fastify.post(
    '/developer/submissions/:id/submit',
    async (request: FastifyRequest<{ Params: SubmissionParams }>, reply: FastifyReply) => {
      try {
        const developer = getDeveloperIdentity(request);
        const existing = await service.getSubmission(request.params.id);
        if (existing.developerEmail !== developer.email) {
          return sendError(reply, 403, 'SUBMISSION_FORBIDDEN', 'This submission belongs to another developer');
        }
        return sendSuccess(
          reply,
          { submission: await service.submitForReview(request.params.id) },
          'Submission entered the review queue',
        );
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );
}

export async function adminSubmissionReviewRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', adminMiddleware);

  const service = getService();

  fastify.get(
    '/submissions',
    async (
      request: FastifyRequest<{ Querystring: { status?: string; limit?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const submissions = await service.listSubmissions({
          status: request.query.status,
          limit: request.query.limit ? Number(request.query.limit) : undefined,
        });
        return sendSuccess(reply, { submissions });
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  fastify.get(
    '/submissions/:id',
    async (request: FastifyRequest<{ Params: SubmissionParams }>, reply: FastifyReply) => {
      try {
        return sendSuccess(reply, { submission: await service.getSubmission(request.params.id) });
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  fastify.get(
    '/submissions/:id/artifact',
    async (request: FastifyRequest<{ Params: SubmissionParams }>, reply: FastifyReply) => {
      try {
        const submission = await service.getSubmission(request.params.id);
        if (submission.artifactStoragePath) {
          const stored = await getStoredArtifactStream(request.params.id);
          if (!stored) {
            return sendError(reply, 404, 'SUBMISSION_ARTIFACT_MISSING', 'Stored artifact file is missing on disk');
          }
          reply.header('content-disposition', `attachment; filename="${stored.filename}"`);
          reply.header('content-type', 'application/octet-stream');
          return reply.send(stored.stream);
        }
        if (submission.artifactUrl) {
          return sendSuccess(reply, { artifactUrl: submission.artifactUrl });
        }
        return sendError(reply, 404, 'SUBMISSION_ARTIFACT_MISSING', 'Submission has no artifact yet');
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  async function reviewAction(
    request: FastifyRequest,
    reply: FastifyReply,
    action: 'approve' | 'reject' | 'request-changes',
  ) {
    try {
      const { id } = request.params as SubmissionParams;
      const body = (request.body ?? {}) as { notes?: string };
      const reviewer = (request as unknown as { user?: { email?: string; id?: string } }).user;
      const notes = (body.notes ?? '').trim();
      if (!notes) {
        return sendError(reply, 400, 'SUBMISSION_NOTES_REQUIRED', 'review notes are required');
      }
      const review = { notes, reviewer: reviewer?.email ?? reviewer?.id ?? 'admin' };
      const submission =
        action === 'approve'
          ? await service.approve(id, review)
          : action === 'reject'
            ? await service.reject(id, review)
            : await service.requestChanges(id, review);
      return sendSuccess(reply, { submission }, `Submission ${action.replace('-', ' ')}d`);
    } catch (error) {
      return handleError(reply, error);
    }
  }

  fastify.post('/submissions/:id/approve', async (request, reply) => reviewAction(request, reply, 'approve'));
  fastify.post('/submissions/:id/reject', async (request, reply) => reviewAction(request, reply, 'reject'));
  fastify.post(
    '/submissions/:id/request-changes',
    async (request, reply) => reviewAction(request, reply, 'request-changes'),
  );

  fastify.post(
    '/submissions/:id/publish',
    async (request: FastifyRequest<{ Params: SubmissionParams }>, reply: FastifyReply) => {
      try {
        const reviewer = (request as unknown as { user?: { email?: string; id?: string } }).user;
        const submission = await service.publish(
          request.params.id,
          reviewer?.email ?? reviewer?.id ?? 'admin',
        );
        return sendSuccess(reply, { submission }, 'Submission published to the catalog flow');
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  // ---- Developer account management ----

  fastify.get('/developers', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return sendSuccess(reply, { developers: await listDeveloperAccounts() });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  fastify.post(
    '/developers',
    async (
      request: FastifyRequest<{ Body: { name?: string; email?: string; company?: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { name, email, company } = (request.body ?? {}) as { name?: string; email?: string; company?: string };
        if (!name?.trim() || !email?.trim()) {
          return sendError(reply, 400, 'DEVELOPER_FIELDS_REQUIRED', 'name and email are required');
        }
        const created = await createDeveloperAccount({ name: name.trim(), email: email.trim(), company });
        return sendSuccess(
          reply,
          {
            developer: created.account,
            apiKey: created.apiKey,
            note: 'Store this key now — it is shown only once.',
          },
          'Developer account created',
          201,
        );
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );

  fastify.post(
    '/developers/:id/revoke',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        return sendSuccess(
          reply,
          { developer: await revokeDeveloperAccount(request.params.id) },
          'Developer account revoked',
        );
      } catch (error) {
        return handleError(reply, error);
      }
    },
  );
}

/**
 * GET /developer-portal — self-service HTML submit page for developers.
 * Single file, no build step; talks to the developer API with the key.
 */
export async function developerPortalRoute(fastify: FastifyInstance) {
  fastify.get('/developer-portal', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('content-type', 'text/html; charset=utf-8');
    return reply.send(PORTAL_HTML);
  });
}

const PORTAL_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Jiffoo — Developer Portal</title>
<style>
  :root { color-scheme: light; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; background: #f6f8fb; color: #111827; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p.sub { margin: 0 0 24px; color: #6b7280; font-size: 14px; }
  form { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 20px; display: grid; gap: 14px; }
  label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; display: block; margin-bottom: 4px; }
  input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 8px; padding: 9px 10px; font-size: 14px; font-family: inherit; }
  textarea { min-height: 120px; font-family: ui-monospace, monospace; }
  button { background: #2563eb; border: 0; color: #fff; font-weight: 700; font-size: 14px; border-radius: 8px; padding: 10px 18px; cursor: pointer; }
  button:disabled { opacity: .5; cursor: default; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .out { margin-top: 16px; white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: 12px; background: #0b1020; color: #d7dcf0; border-radius: 10px; padding: 14px; min-height: 40px; }
  .ok { color: #6ee7b7; } .err { color: #fca5a5; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Jiffoo Developer Portal</h1>
  <p class="sub">Submit a plugin or theme to the official marketplace. You need a developer API key (<code>jfdev_…</code>) — request one from the platform team.</p>
  <form id="f">
    <div class="row">
      <div><label>API key</label><input name="apiKey" placeholder="jfdev_…" required /></div>
      <div><label>Kind</label><select name="kind"><option value="plugin">plugin</option><option value="theme">theme</option></select></div>
    </div>
    <div class="row">
      <div><label>Slug</label><input name="slug" placeholder="my-plugin" required /></div>
      <div><label>Version</label><input name="version" placeholder="0.0.1" required /></div>
    </div>
    <div class="row">
      <div><label>Name</label><input name="name" placeholder="My Plugin" required /></div>
      <div><label>Category (plugins)</label><input name="category" placeholder="integration" /></div>
    </div>
    <div><label>Description</label><textarea name="description" placeholder="What it does (min 20 chars)" required></textarea></div>
    <div class="row">
      <div><label>Source URL</label><input name="sourceUrl" placeholder="https://github.com/you/repo" /></div>
      <div><label>Contract version (plugins)</label><input name="contractVersion" placeholder="v1" /></div>
    </div>
    <div><label>Manifest JSON</label><textarea name="manifest" placeholder='{"id":"my-plugin","version":"0.0.1","contract":"v1","category":"integration","uses":["api"]}' required></textarea></div>
    <div><label>Artifact file (zip / .jplugin / .jtheme, &le;200MB)</label><input type="file" name="artifact" /></div>
    <button type="submit">Validate &amp; submit for review</button>
  </form>
  <div class="out" id="out">Result will appear here.</div>
</div>
<script>
const out = document.getElementById('out');
function show(text, cls) { out.textContent = text; out.className = 'out ' + (cls || ''); }
document.getElementById('f').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const key = form.apiKey.value.trim();
  const base = location.origin + '/api/v1';
  show('Validating…');
  let manifest;
  try { manifest = JSON.parse(form.manifest.value); } catch { return show('Manifest is not valid JSON', 'err'); }
  const payload = {
    kind: form.kind.value, slug: form.slug.value.trim(), name: form.name.value.trim(),
    version: form.version.value.trim(), category: form.category.value.trim() || undefined,
    contractVersion: form.contractVersion.value.trim() || undefined,
    description: form.description.value.trim(), sourceUrl: form.sourceUrl.value.trim() || undefined,
    manifest,
  };
  const headers = { 'content-type': 'application/json', authorization: 'Bearer ' + key };
  let created;
  try {
    const res = await fetch(base + '/developer/submissions', { method: 'POST', headers, body: JSON.stringify(payload) });
    const body = await res.json();
    if (!body.success) return show('Create failed: ' + (body.error?.message || res.status), 'err');
    created = body.data.submission;
    const issues = (body.data.validation?.issues || []).map(i => i.level.toUpperCase() + ' ' + i.code + ' — ' + i.message);
    show('Created ' + created.id + '\\n' + (issues.join('\\n') || 'validation clean'), issues.some(i => i.startsWith('ERROR')) ? 'err' : 'ok');
  } catch (e) { return show('Network error: ' + e.message, 'err'); }
  try {
    if (form.artifact.files[0]) {
      show('Created ' + created.id + ' — uploading artifact…', 'ok');
      const fd = new FormData();
      fd.append('artifact', form.artifact.files[0]);
      const up = await fetch(base + '/developer/submissions/' + created.id + '/artifact/upload', { method: 'POST', headers: { authorization: 'Bearer ' + key }, body: fd });
      const upBody = await up.json();
      if (!upBody.success) return show('Upload failed: ' + (upBody.error?.message || up.status), 'err');
    }
    const sub = await fetch(base + '/developer/submissions/' + created.id + '/submit', { method: 'POST', headers: { authorization: 'Bearer ' + key } });
    const subBody = await sub.json();
    if (!subBody.success) return show('Submit failed: ' + (subBody.error?.message || sub.status) + '\\n' + JSON.stringify(subBody.error?.details || '', null, 1), 'err');
    show('Submitted for review — track with GET /api/v1/developer/submissions/' + created.id, 'ok');
  } catch (e) { show('Error: ' + e.message, 'err'); }
});
</script>
</body>
</html>`;
