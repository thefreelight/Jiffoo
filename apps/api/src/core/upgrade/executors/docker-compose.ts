import type { UpdateExecutionContext, UpdateExecutionResult, ExecutorAvailability } from './types';
import { BaseUpdateExecutor } from './base';
import { inferUpdaterBridgeUrl } from '../updater-bridge';

export class DockerComposeUpdateExecutor extends BaseUpdateExecutor {
  readonly mode = 'docker-compose' as const;

  private resolveUpdaterUrl(): string | null {
    return inferUpdaterBridgeUrl(this.mode);
  }

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
    const updaterUrl = this.resolveUpdaterUrl();
    if (updaterUrl) {
      try {
        const response = await fetch(`${updaterUrl}/health`);
        if (response.ok) {
          return {
            available: true,
            reason: null,
            guidance: null,
          };
        }
      } catch {
        return this.buildUnavailable(
          this.getManualGuidance('Updater agent is configured but unreachable.'),
          'Updater agent unreachable',
        );
      }
    }

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
    return `${prefix}Install the local updater bridge (or set JIFFOO_UPDATER_URL) and configure JIFFOO_DOCKER_COMPOSE_FILE if needed. Until the executor is ready, follow the operator guide: pull the new images, switch api/shop/admin sequentially, verify the live runtime version, and only then commit the compose APP_VERSION. Treat source-archive as a recovery path, not the default upgrade flow.`;
  }

  async execute(context: UpdateExecutionContext): Promise<UpdateExecutionResult> {
    const updaterUrl = this.resolveUpdaterUrl();
    if (updaterUrl) {
      context.reportProgress('preparing', 'Dispatching docker-compose upgrade to updater agent', 20);
      const response = await fetch(`${updaterUrl}/upgrade`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          targetVersion: context.targetVersion,
        }),
      });

      if (!response.ok) {
        let message = `Updater agent returned HTTP ${response.status}`;
        try {
          const body = await response.json() as { error?: string };
          if (body?.error) message = body.error;
        } catch {
          // keep fallback message
        }
        return {
          success: false,
          error: message,
        };
      }

      return {
        success: true,
        output: 'docker-compose upgrade accepted by updater agent',
      };
    }

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
