import type { DeploymentMode } from './types';

function normalizeNamespace(value?: string | null): string {
  return value && value.trim().length > 0 ? value.trim() : 'default';
}

export function inferUpdaterBridgeUrl(mode: DeploymentMode): string | null {
  if (process.env.JIFFOO_UPDATER_URL) {
    return process.env.JIFFOO_UPDATER_URL;
  }

  if (mode === 'k8s' || process.env.KUBERNETES_SERVICE_HOST) {
    const namespace = normalizeNamespace(
      process.env.JIFFOO_K8S_NAMESPACE
      || process.env.HELM_NAMESPACE
      || process.env.POD_NAMESPACE
    );

    return `http://jiffoo-k8s-updater.${namespace}.svc.cluster.local:3015`;
  }

  return null;
}
