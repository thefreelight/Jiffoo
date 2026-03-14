import type { UpdateExecutionContext, UpdateExecutionResult, ExecutorAvailability } from './types';
import { BaseUpdateExecutor } from './base';

export class K8sUpdateExecutor extends BaseUpdateExecutor {
  readonly mode = 'k8s' as const;

  private resolveReleaseName(): string | null {
    return process.env.JIFFOO_HELM_RELEASE_NAME
      || process.env.HELM_RELEASE_NAME
      || process.env.ARGOCD_APP_NAME
      || null;
  }

  private resolveNamespace(): string {
    return process.env.JIFFOO_K8S_NAMESPACE
      || process.env.HELM_NAMESPACE
      || process.env.POD_NAMESPACE
      || 'default';
  }

  async probe(): Promise<ExecutorAvailability> {
    const binary = this.resolveUpdaterBinary();
    if (!binary) {
      return this.buildUnavailable(this.getManualGuidance('Local updater binary is not installed.'));
    }

    const releaseName = this.resolveReleaseName();
    if (!releaseName) {
      return this.buildUnavailable(this.getManualGuidance('No Helm release or controller application name was detected.'), 'Missing release metadata');
    }

    return this.buildAvailable(binary);
  }

  getManualGuidance(reason?: string | null): string {
    const prefix = reason ? `${reason} ` : '';
    return `${prefix}Install the local updater and provide a release identifier via JIFFOO_HELM_RELEASE_NAME or the cluster controller environment. Until then, use the operator guide to roll the release forward with Helm or your GitOps controller and verify rollout health.`;
  }

  async execute(context: UpdateExecutionContext): Promise<UpdateExecutionResult> {
    const availability = await this.probe();
    const releaseName = this.resolveReleaseName();
    if (!availability.available || !availability.updaterBinary || !releaseName) {
      return {
        success: false,
        error: availability.guidance || this.getManualGuidance(availability.reason),
      };
    }

    context.reportProgress('downloading', 'Resolving Kubernetes release metadata', 25);
    return this.runUpdater(
      availability.updaterBinary,
      [
        'upgrade',
        '--mode',
        this.mode,
        '--target-version',
        context.targetVersion,
        '--release',
        releaseName,
        '--namespace',
        this.resolveNamespace(),
      ],
      context
    );
  }
}
