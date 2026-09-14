import { authenticateNativeAdmin, type NativeAuthEnv } from './auth';

// Cloudflare-native instances are upgraded through the published Worker
// release pipeline (see oneClickUpgradeBlockedReason in upgrade-version.ts),
// so there is never an in-flight upgrade: the Merchant Admin settings panel
// shows an idle status. Reset is accepted as a no-op returning the same idle
// document so the UI never dead-ends on this runtime.

interface UpgradeStatusView {
  status: string;
  progress: number;
  currentStep: string | null;
  error: string | null;
  targetVersion: string | null;
  updatedAt: string | null;
}

function idleStatus(): UpgradeStatusView {
  return { status: 'idle', progress: 0, currentStep: null, error: null, targetVersion: null, updatedAt: null };
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'x-jiffoo-runtime': 'cloudflare-native-d1-upgrade-status', 'cache-control': 'no-store' } });
}

export async function tryNativeUpgradeStatus(request: Request, env: NativeAuthEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const isStatus = url.pathname === '/api/v1/upgrade/status' && request.method === 'GET';
  const isReset = url.pathname === '/api/v1/upgrade/status/reset' && request.method === 'POST';
  if (!isStatus && !isReset) return null;
  const admin = await authenticateNativeAdmin(request, env);
  if (!admin) {
    return json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator authentication is required' } }, 401);
  }
  return json({ success: true, data: idleStatus() });
}
