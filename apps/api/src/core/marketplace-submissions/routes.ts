/**
 * Marketplace Submissions Routes
 *
 * Developer-facing endpoints (no auth; identity is payload-declared, spam is
 * bounded by validation + operator review) and admin review endpoints
 * (admin-authenticated, mounted under /api/admin/marketplace).
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

function getService() {
  return new MarketplaceSubmissionsService(prisma as unknown as PrismaClient);
}

function handleError(reply: FastifyReply, error: unknown) {
  if (error instanceof SubmissionError) {
    return sendError(reply, error.statusCode, error.code, error.message, error.details);
  }
  return sendError(reply, 500, 'SUBMISSION_INTERNAL', 'Failed to process submission request');
}

interface SubmissionParams {
  id: string;
}

export async function developerSubmissionRoutes(fastify: FastifyInstance) {
  const service = getService();

  fastify.post(
    '/developer/submissions',
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      try {
        const body = request.body as Record<string, unknown>;
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
    async (request: FastifyRequest<{ Querystring: { email?: string } }>, reply: FastifyReply) => {
      try {
        if (!request.query.email) {
          return sendError(reply, 400, 'SUBMISSION_EMAIL_REQUIRED', 'email query parameter is required');
        }
        const submissions = await service.listSubmissions({ developerEmail: request.query.email });
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
        return sendSuccess(reply, { submission: await service.getSubmission(request.params.id) });
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
        const { artifactUrl, checksumSha256 } = request.body ?? {};
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
    '/developer/submissions/:id/submit',
    async (request: FastifyRequest<{ Params: SubmissionParams }>, reply: FastifyReply) => {
      try {
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
}
