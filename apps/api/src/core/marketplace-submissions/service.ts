/**
 * Marketplace submissions — service
 *
 * State machine: draft -> submitted -> (approved | rejected | changes_requested)
 * changes_requested returns the submission to the developer, who resubmits.
 * Approval is the platform operator's action; catalog publication rides the
 * existing market publish machinery using the approved submission as source.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import {
  validateSubmission,
  validateArtifactUrl,
  type SubmissionKind,
  type SubmissionManifestInput,
  type ValidationReport,
} from './validation';

export const SUBMISSION_STATUSES = [
  'draft',
  'submitted',
  'changes_requested',
  'approved',
  'rejected',
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export interface CreateSubmissionInput {
  kind: string;
  slug: string;
  name: string;
  version: string;
  contractVersion?: string;
  category?: string;
  description: string;
  developerName: string;
  developerEmail: string;
  sourceUrl?: string;
  manifest: Record<string, unknown>;
  artifactUrl?: string;
  checksumSha256?: string;
}

export interface ReviewInput {
  notes: string;
  reviewer: string;
}

function reportToJson(report: ValidationReport) {
  return (report as unknown) as Prisma.InputJsonValue;
}

export class MarketplaceSubmissionsService {
  constructor(private readonly prisma: PrismaClient) {}

  async createSubmission(input: CreateSubmissionInput) {
    const kind = String(input.kind);
    if (kind !== 'plugin' && kind !== 'theme') {
      throw new SubmissionError(400, 'SUBMISSION_KIND_INVALID', 'kind must be "plugin" or "theme"');
    }

    const manifestInput: SubmissionManifestInput = {
      kind: kind as SubmissionKind,
      slug: String(input.slug ?? ''),
      name: String(input.name ?? ''),
      version: String(input.version ?? ''),
      contractVersion: input.contractVersion,
      category: input.category,
      description: String(input.description ?? ''),
      developerName: String(input.developerName ?? ''),
      developerEmail: String(input.developerEmail ?? ''),
      sourceUrl: input.sourceUrl,
      manifest: isPlainObject(input.manifest) ? input.manifest : {},
    };

    const report = validateSubmission(manifestInput);

    let artifactWarning = null;
    if (input.artifactUrl) {
      artifactWarning = validateArtifactUrl(input.artifactUrl);
      if (artifactWarning) {
        report.issues.push(artifactWarning);
        report.ok = false;
      }
    }

    const duplicate = await this.prisma.extensionSubmission.findUnique({
      where: { slug_version: { slug: manifestInput.slug, version: manifestInput.version } },
      select: { id: true, status: true },
    });
    if (duplicate) {
      throw new SubmissionError(
        409,
        'SUBMISSION_DUPLICATE',
        `Submission ${manifestInput.slug}@${manifestInput.version} already exists (${duplicate.status})`,
      );
    }

    const created = await this.prisma.extensionSubmission.create({
      data: {
        kind,
        slug: manifestInput.slug,
        name: manifestInput.name,
        version: manifestInput.version,
        contractVersion: input.contractVersion,
        category: input.category,
        description: manifestInput.description,
        developerName: input.developerName,
        developerEmail: input.developerEmail,
        sourceUrl: input.sourceUrl,
        manifestJson: (manifestInput.manifest as unknown) as Prisma.InputJsonValue,
        artifactUrl: input.artifactUrl,
        checksumSha256: input.checksumSha256,
        status: 'draft',
        validationJson: reportToJson(report),
      },
    });

    return { submission: created, validation: report };
  }

  async getSubmission(id: string) {
    const submission = await this.prisma.extensionSubmission.findUnique({ where: { id } });
    if (!submission) {
      throw new SubmissionError(404, 'SUBMISSION_NOT_FOUND', `Submission ${id} not found`);
    }
    return submission;
  }

  async listSubmissions(options: { status?: string; developerEmail?: string; limit?: number }) {
    const where: Record<string, unknown> = {};
    if (options.status) where.status = options.status;
    if (options.developerEmail) where.developerEmail = options.developerEmail;
    return this.prisma.extensionSubmission.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Math.max(options.limit ?? 50, 1), 200),
    });
  }

  async setArtifact(id: string, artifactUrl: string, checksumSha256?: string) {
    const submission = await this.getSubmission(id);
    if (!['draft', 'changes_requested'].includes(submission.status)) {
      throw new SubmissionError(
        409,
        'SUBMISSION_NOT_EDITABLE',
        `Artifact can only be set while draft or changes_requested (current: ${submission.status})`,
      );
    }
    const issue = validateArtifactUrl(artifactUrl);
    const existing = readReport(submission.validationJson);
    if (issue) {
      existing.issues = [
        ...existing.issues.filter((i) => i.code !== issue.code),
        issue,
      ];
      existing.ok = false;
    }
    return this.prisma.extensionSubmission.update({
      where: { id },
      data: {
        artifactUrl,
        checksumSha256,
        validationJson: reportToJson(existing),
      },
    });
  }

  async submitForReview(id: string) {
    const submission = await this.getSubmission(id);
    if (submission.status !== 'draft' && submission.status !== 'changes_requested') {
      throw new SubmissionError(
        409,
        'SUBMISSION_INVALID_TRANSITION',
        `Cannot submit from status "${submission.status}"`,
      );
    }
    const report = readReport(submission.validationJson);
    const artifactIssue = submission.artifactUrl
      ? validateArtifactUrl(submission.artifactUrl)
      : { level: 'error' as const, code: 'artifact.missing', message: 'artifactUrl is required before review' };

    const blocking = [
      ...report.issues.filter((issue) => issue.level === 'error'),
      ...(artifactIssue ? [artifactIssue] : []),
    ];
    if (blocking.length > 0) {
      throw new SubmissionError(
        422,
        'SUBMISSION_VALIDATION_FAILED',
        'Submission has blocking validation issues',
        blocking,
      );
    }

    return this.prisma.extensionSubmission.update({
      where: { id },
      data: { status: 'submitted', updatedAt: new Date() },
    });
  }

  /**
   * Record a stored upload (multipart) on the submission.
   */
  async setStoredArtifact(
    id: string,
    stored: { storagePath: string; filename: string; size: number },
  ) {
    const submission = await this.getSubmission(id);
    if (!['draft', 'changes_requested'].includes(submission.status)) {
      throw new SubmissionError(
        409,
        'SUBMISSION_NOT_EDITABLE',
        `Artifact can only be set while draft or changes_requested (current: ${submission.status})`,
      );
    }
    return this.prisma.extensionSubmission.update({
      where: { id },
      data: {
        artifactStoragePath: stored.storagePath,
        artifactFilename: stored.filename,
        artifactSize: stored.size,
      },
    });
  }

  /**
   * Publish an approved submission into the catalog flow. The catalogRef
   * links the marketplace entry back to the approved submission record.
   */
  async publish(id: string, reviewer: string) {
    const submission = await this.getSubmission(id);
    if (submission.status !== 'approved') {
      throw new SubmissionError(
        409,
        'SUBMISSION_INVALID_TRANSITION',
        `Only approved submissions can be published (current: ${submission.status})`,
      );
    }
    return this.prisma.extensionSubmission.update({
      where: { id },
      data: {
        status: 'published',
        catalogRef: `submission:${id}`,
        reviewedBy: reviewer,
        reviewedAt: new Date(),
      },
    });
  }

  async approve(id: string, review: ReviewInput) {
    const submission = await this.getSubmission(id);
    if (submission.status !== 'submitted') {
      throw new SubmissionError(
        409,
        'SUBMISSION_INVALID_TRANSITION',
        `Only submitted submissions can be approved (current: ${submission.status})`,
      );
    }
    return this.prisma.extensionSubmission.update({
      where: { id },
      data: {
        status: 'approved',
        reviewNotes: review.notes,
        reviewedBy: review.reviewer,
        reviewedAt: new Date(),
      },
    });
  }

  async reject(id: string, review: ReviewInput) {
    const submission = await this.getSubmission(id);
    if (submission.status !== 'submitted') {
      throw new SubmissionError(
        409,
        'SUBMISSION_INVALID_TRANSITION',
        `Only submitted submissions can be rejected (current: ${submission.status})`,
      );
    }
    return this.prisma.extensionSubmission.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewNotes: review.notes,
        reviewedBy: review.reviewer,
        reviewedAt: new Date(),
      },
    });
  }

  async requestChanges(id: string, review: ReviewInput) {
    const submission = await this.getSubmission(id);
    if (submission.status !== 'submitted') {
      throw new SubmissionError(
        409,
        'SUBMISSION_INVALID_TRANSITION',
        `Only submitted submissions can be returned for changes (current: ${submission.status})`,
      );
    }
    return this.prisma.extensionSubmission.update({
      where: { id },
      data: {
        status: 'changes_requested',
        reviewNotes: review.notes,
        reviewedBy: review.reviewer,
        reviewedAt: new Date(),
      },
    });
  }
}

export class SubmissionError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'SubmissionError';
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readReport(value: unknown): ValidationReport {
  if (isPlainObject(value) && Array.isArray(value.issues)) {
    return { ok: value.ok === true, issues: value.issues as ValidationReport['issues'] };
  }
  return { ok: true, issues: [] };
}
