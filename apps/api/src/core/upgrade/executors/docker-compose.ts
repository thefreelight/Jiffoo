import type { UpdateExecutionContext, UpdateExecutionResult, ExecutorAvailability } from './types';
import { BaseUpdateExecutor } from './base';

export class DockerComposeUpdateExecutor extends BaseUpdateExecutor {
  readonly mode = 'docker-compose' as const;

  private resolveComposeFile(): string | null {
    return this.findFirstExistingPath([
      process.env.JIFFOO_DOCKER_COMPOSE_FILE,
      'docker-compose.prod.yml',
      'docker-compose.yml',
      '/opt/jiffoo/current/docker-compose.prod.yml',
      '/opt/jiffoo/current/docker-compose.yml',
    ]);
  }

  async probe(): Promise<ExecutorAvailability> {
    const binary = this.resolveUpdaterBinary();
    if (!binary) {
      return this.buildUnavailable(this.getManualGuidance('Local updater binary is not installed.'));
    }

    const composeFile = this.resolveComposeFile();
    if (!composeFile) {
      return this.buildUnavailable(this.getManualGuidance('No supported Docker Compose file was found.'), 'Missing compose file');
    }

    return this.buildAvailable(binary);
  }

  getManualGuidance(reason?: string | null): string {
    const prefix = reason ? `${reason} ` : '';
    return `${prefix}Install the local updater and configure JIFFOO_DOCKER_COMPOSE_FILE if needed. Until the executor is ready, follow the operator guide: pull the new images, update the compose release tag, run migrations, and verify service health.`;
  }

  async execute(context: UpdateExecutionContext): Promise<UpdateExecutionResult> {
    const availability = await this.probe();
    const composeFile = this.resolveComposeFile();
    if (!availability.available || !availability.updaterBinary || !composeFile) {
      return {
        success: false,
        error: availability.guidance || this.getManualGuidance(availability.reason),
      };
    }

    context.reportProgress('downloading', 'Resolving Docker Compose release assets', 25);
    return this.runUpdater(
      availability.updaterBinary,
      [
        'upgrade',
        '--mode',
        this.mode,
        '--target-version',
        context.targetVersion,
        '--compose-file',
        composeFile,
      ],
      context
    );
  }
}
