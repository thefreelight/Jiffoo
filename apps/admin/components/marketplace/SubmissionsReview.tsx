'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient, unwrapApiResponse, isAdminApiError } from '@/lib/api';

interface ValidationIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
}

interface Submission {
  id: string;
  kind: string;
  slug: string;
  name: string;
  version: string;
  contractVersion: string | null;
  category: string | null;
  description: string;
  developerName: string;
  developerEmail: string;
  sourceUrl: string | null;
  artifactUrl: string | null;
  artifactStoragePath: string | null;
  artifactFilename: string | null;
  artifactSize: number | null;
  checksumSha256: string | null;
  catalogRef: string | null;
  status: string;
  validationJson: unknown;
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  updatedAt: string;
}

const STATUS_FILTERS = ['submitted', 'draft', 'changes_requested', 'approved', 'rejected'] as const;

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-blue-50 text-blue-700',
  changes_requested: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
};

async function downloadStoredArtifact(id: string, fallbackName: string) {
  const response = await apiClient.get(`/admin/marketplace/submissions/${id}/artifact`, { responseType: 'blob' });
  const blob = response as unknown as Blob;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fallbackName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseIssues(validationJson: unknown): ValidationIssue[] {
  if (validationJson && typeof validationJson === 'object' && Array.isArray((validationJson as { issues?: unknown }).issues)) {
    return (validationJson as { issues: ValidationIssue[] }).issues;
  }
  return [];
}

export function SubmissionsReview() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('submitted');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const response = await apiClient.get(`/admin/marketplace/submissions${query}`);
      setSubmissions(unwrapApiResponse<{ submissions: Submission[] }>(response).submissions);
    } catch (err) {
      setError(isAdminApiError(err) ? err.message : 'Failed to load submissions');
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => submissions.find((submission) => submission.id === selectedId) ?? null,
    [submissions, selectedId],
  );

  const act = useCallback(
    async (action: 'approve' | 'reject' | 'request-changes') => {
      if (!selected) return;
      if (!notes.trim()) {
        setError('Review notes are required');
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await apiClient.post(`/admin/marketplace/submissions/${selected.id}/${action}`, { notes });
        setNotes('');
        await load();
      } catch (err) {
        setError(isAdminApiError(err) ? err.message : `Failed to ${action.replace('-', ' ')} submission`);
      } finally {
        setBusy(false);
      }
    },
    [selected, notes, load],
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
      <aside className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap gap-1.5 border-b border-gray-100 p-3">
          {(['submitted', ...STATUS_FILTERS.filter((s) => s !== 'submitted'), 'all'] as string[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                statusFilter === status ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
        <ul className="max-h-[70vh] divide-y divide-gray-100 overflow-y-auto">
          {submissions.length === 0 && <li className="p-6 text-sm text-gray-500">No submissions in this state.</li>}
          {submissions.map((submission) => (
            <li key={submission.id}>
              <button
                type="button"
                onClick={() => setSelectedId(submission.id)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${
                  selectedId === submission.id ? 'bg-blue-50/60' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-gray-900">
                    {submission.slug}@{submission.version}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      STATUS_STYLES[submission.status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {submission.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {submission.kind} · {submission.developerName} · {new Date(submission.updatedAt).toLocaleString()}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        {!selected && <p className="text-sm text-gray-500">Select a submission to review.</p>}
        {selected && (
          <div className="space-y-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {selected.name} <span className="font-mono text-sm text-gray-500">{selected.slug}@{selected.version}</span>
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  {selected.kind}
                  {selected.category ? ` · ${selected.category}` : ''}
                  {selected.contractVersion ? ` · contract ${selected.contractVersion}` : ''} ·{' '}
                  {selected.developerName} &lt;{selected.developerEmail}&gt;
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                  STATUS_STYLES[selected.status] ?? 'bg-gray-100 text-gray-600'
                }`}
              >
                {selected.status.replace('_', ' ')}
              </span>
            </header>

            <p className="text-sm leading-6 text-gray-700">{selected.description}</p>

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {selected.sourceUrl && (
                <a href={selected.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  Source repository ↗
                </a>
              )}
              {selected.artifactUrl && (
                <a href={selected.artifactUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  Artifact (remote) ↗
                </a>
              )}
              {selected.artifactStoragePath && (
                <button
                  type="button"
                  className="text-left text-blue-600 hover:underline"
                  onClick={() =>
                    void downloadStoredArtifact(selected.id, selected.artifactFilename ?? `${selected.slug}.zip`).catch(
                      () => setError('Failed to download stored artifact'),
                    )
                  }
                >
                  Artifact (stored){selected.artifactSize ? ` · ${(selected.artifactSize / 1024 / 1024).toFixed(1)}MB` : ''} ⬇
                </button>
              )}
            </div>

            {parseIssues(selected.validationJson).length > 0 && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Automated validation</h3>
                {parseIssues(selected.validationJson).map((issue, index) => (
                  <div
                    key={`${issue.code}-${index}`}
                    className={`rounded-lg px-3 py-2 text-xs ${
                      issue.level === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    <span className="font-mono font-semibold">{issue.code}</span> — {issue.message}
                  </div>
                ))}
              </div>
            )}

            {selected.reviewNotes && (
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <span className="font-semibold">Last review:</span> {selected.reviewNotes}
                {selected.reviewedBy ? ` — ${selected.reviewedBy}` : ''}
              </div>
            )}

            <details>
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-gray-500">
                Manifest
              </summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-gray-950 p-3 text-[11px] leading-4 text-gray-100">
                {JSON.stringify((selected as unknown as { manifestJson?: unknown }).manifestJson, null, 2)}
              </pre>
            </details>

            {selected.status === 'approved' && (
              <div className="space-y-2 border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-500">
                  Approved — publishing records the catalog reference (<code className="font-mono">submission:{selected.id}</code>) and hands the entry to the market publish flow.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await apiClient.post(`/admin/marketplace/submissions/${selected.id}/publish`, {});
                      setNotes('');
                      await load();
                    } catch (err) {
                      setError(isAdminApiError(err) ? err.message : 'Failed to publish submission');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Publish to catalog
                </button>
              </div>
            )}

            {selected.status === 'published' && (
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Published — catalog reference <span className="font-mono">{selected.catalogRef}</span>
              </div>
            )}

            {selected.status === 'submitted' && (
              <div className="space-y-2 border-t border-gray-100 pt-4">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  placeholder="Review notes (required)"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act('approve')}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act('request-changes')}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    Request changes
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void act('reject')}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
