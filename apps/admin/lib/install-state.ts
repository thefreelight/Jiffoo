export interface InstallSummary {
  siteName: string;
  adminUsername: string;
  adminEmail: string;
  timezone: string;
}

export function selectInstallState({ summary, loading, installed, connected }: {
  summary: InstallSummary | null; loading: boolean; installed: boolean; connected: boolean;
}): 'complete' | 'checking' | 'already' | 'form' | 'failed' {
  if (summary) return 'complete';
  if (loading) return 'checking';
  if (installed) return 'already';
  return connected ? 'form' : 'failed';
}
