import type { DeploymentMode } from '../types';
import type { UpdateExecutor } from './types';
import { DockerComposeUpdateExecutor } from './docker-compose';
import { SingleHostUpdateExecutor } from './single-host';
import { UnsupportedUpdateExecutor } from './unsupported';

export function createUpdateExecutor(mode: DeploymentMode): UpdateExecutor {
  switch (mode) {
    case 'single-host':
      return new SingleHostUpdateExecutor();
    case 'docker-compose':
      return new DockerComposeUpdateExecutor();
    case 'unsupported':
    default:
      return new UnsupportedUpdateExecutor();
  }
}

export type { UpdateExecutor, ExecutorAvailability, UpdateExecutionContext, UpdateExecutionResult } from './types';
