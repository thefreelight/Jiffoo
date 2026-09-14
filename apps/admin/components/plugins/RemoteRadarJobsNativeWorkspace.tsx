import { useCallback, useEffect, useState } from 'react';
import { Loader2, Radar, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface ConnectorDefinition {
  id: string;
  name: string;
  configurationFields: string[];
}

interface SourceRow {
  id: string;
  sourceKey: string;
  name: string;
  connector: string;
  owner: string | null;
  repo: string | null;
  policy: string | null;
  authorizationStatus: string | null;
  authorizationExpiresAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StatsRow {
  todayNew: number;
  activeTotal: number;
  sourceCount: number;
  lastSyncedAt: string | null;
}

const AUTH_TONES: Record<string, string> = {
  authorized: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  not_required: 'text-slate-600 bg-slate-50 border-slate-200',
  expired: 'text-red-700 bg-red-50 border-red-200',
  withdrawn: 'text-red-700 bg-red-50 border-red-200',
  pending: 'text-amber-700 bg-amber-50 border-amber-200',
};

export function RemoteRadarJobsNativeWorkspace(props: { installationId: string; disabled?: boolean }) {
  const { disabled } = props;
  const [connectors, setConnectors] = useState<ConnectorDefinition[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [stats, setStats] = useState<StatsRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [connectorResponse, sourceResponse, statsResponse] = await Promise.all([
        apiClient.get('/admin/plugins/remoteradar-jobs/connectors'),
        apiClient.get('/admin/plugins/remoteradar-jobs/sources'),
        apiClient.get('/jobs/stats'),
      ]);
      // The jobs admin proxy returns the upstream payload as-is (bare
      // { connectors } / { sources } envelopes), so read it without the
      // standard success/data unwrap.
      const connectorData = connectorResponse as unknown as { connectors?: ConnectorDefinition[]; error?: string };
      const sourceData = sourceResponse as unknown as { sources?: SourceRow[]; error?: string };
      const statsData = statsResponse as unknown as StatsRow & { error?: string };
      if (connectorData.error || sourceData.error) {
        throw new Error(connectorData.error || sourceData.error || 'Failed to load');
      }
      setConnectors(connectorData.connectors || []);
      setSources(sourceData.sources || []);
      setStats(statsData.activeTotal != null ? statsData : null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load RemoteRadar jobs administration.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <Card className="rounded-lg border-gray-100 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
              <Radar className="h-5 w-5 text-blue-600" />
              RemoteRadar job sources
            </CardTitle>
            <CardDescription>
              Connector health, authorized sources, and sync status read from the RemoteRadar jobs plugin through the protected admin proxy.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || disabled}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {stats ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Active jobs</p>
                <p className="text-2xl font-semibold text-slate-900">{stats.activeTotal}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-500">New today</p>
                <p className="text-2xl font-semibold text-slate-900">{stats.todayNew}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm text-slate-500">Last sync</p>
                <p className="text-sm font-medium text-slate-900">
                  {stats.lastSyncedAt ? new Date(stats.lastSyncedAt).toLocaleString() : 'Never'}
                </p>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">Available connectors</p>
            <div className="flex flex-wrap gap-2">
              {connectors.map((connector) => (
                <Badge key={connector.id} variant="secondary" className="rounded-md px-2.5 py-1">
                  {connector.name}
                </Badge>
              ))}
              {!loading && connectors.length === 0 ? (
                <p className="text-sm text-slate-500">No connectors are registered.</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">Authorized sources</p>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Source</th>
                    <th className="px-4 py-2.5 font-medium">Connector</th>
                    <th className="px-4 py-2.5 font-medium">Authorization</th>
                    <th className="px-4 py-2.5 font-medium">Active</th>
                    <th className="px-4 py-2.5 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sources.map((source) => (
                    <tr key={source.id}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-900">{source.name}</p>
                        <p className="text-xs text-slate-500">{source.owner && source.repo ? `${source.owner}/${source.repo}` : source.sourceKey}</p>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{source.connector}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className={`rounded-md border px-2 py-0.5 ${AUTH_TONES[source.authorizationStatus || 'pending'] || AUTH_TONES.pending}`}>
                          {source.authorizationStatus || 'unknown'}
                          {source.authorizationExpiresAt ? ` · until ${new Date(source.authorizationExpiresAt).toLocaleDateString()}` : ''}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={source.active ? 'default' : 'secondary'} className="rounded-md px-2 py-0.5">
                          {source.active ? 'active' : 'inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(source.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {!loading && sources.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        No sources are registered yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
