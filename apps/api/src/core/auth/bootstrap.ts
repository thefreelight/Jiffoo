import { systemSettingsService } from '@/core/admin/system-settings/service';
import type { AuthBootstrapMode, AuthBootstrapStatus } from 'shared/src/types/auth';

const AUTH_BOOTSTRAP_SETTINGS_KEY = 'auth.bootstrap.admin';
const DEFAULT_BOOTSTRAP_EMAIL = process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL || 'admin@jiffoo.com';
const DEFAULT_BOOTSTRAP_PASSWORD = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD || 'admin123';
const DEFAULT_BOOTSTRAP_MODE = normalizeMode(process.env.AUTH_BOOTSTRAP_MODE);

type StoredAuthBootstrapState = {
  mode: AuthBootstrapMode;
  showDemoCredentials: boolean;
  requiresPasswordRotation: boolean;
  email: string;
  updatedAt: string;
};

function normalizeMode(value: unknown): AuthBootstrapMode {
  if (value === 'demo' || value === 'normal') {
    return value;
  }
  return 'bootstrap';
}

function buildDefaultBootstrapState(): StoredAuthBootstrapState {
  return {
    mode: DEFAULT_BOOTSTRAP_MODE,
    showDemoCredentials: DEFAULT_BOOTSTRAP_MODE !== 'normal',
    requiresPasswordRotation: DEFAULT_BOOTSTRAP_MODE === 'bootstrap',
    email: DEFAULT_BOOTSTRAP_EMAIL,
    updatedAt: new Date().toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeStoredState(value: unknown): StoredAuthBootstrapState {
  if (!isRecord(value)) {
    return buildDefaultBootstrapState();
  }

  const mode = normalizeMode(value.mode);
  const email = typeof value.email === 'string' && value.email.trim()
    ? value.email.trim()
    : DEFAULT_BOOTSTRAP_EMAIL;
  const showDemoCredentials = typeof value.showDemoCredentials === 'boolean'
    ? value.showDemoCredentials
    : mode !== 'normal';
  const requiresPasswordRotation = typeof value.requiresPasswordRotation === 'boolean'
    ? value.requiresPasswordRotation
    : mode === 'bootstrap';

  return {
    mode,
    showDemoCredentials,
    requiresPasswordRotation,
    email,
    updatedAt: typeof value.updatedAt === 'string' && value.updatedAt.trim()
      ? value.updatedAt
      : new Date().toISOString(),
  };
}

async function saveState(state: StoredAuthBootstrapState): Promise<void> {
  await systemSettingsService.setSetting(AUTH_BOOTSTRAP_SETTINGS_KEY, {
    ...state,
    updatedAt: new Date().toISOString(),
  });
}

export async function getAuthBootstrapState(): Promise<StoredAuthBootstrapState> {
  const value = await systemSettingsService.getSetting(AUTH_BOOTSTRAP_SETTINGS_KEY);
  return sanitizeStoredState(value);
}

export async function getPublicAuthBootstrapStatus(): Promise<AuthBootstrapStatus> {
  const state = await getAuthBootstrapState();
  return {
    mode: state.mode,
    showDemoCredentials: state.showDemoCredentials,
    requiresPasswordRotation: state.requiresPasswordRotation,
    credentials: state.showDemoCredentials
      ? {
          email: state.email,
          password: DEFAULT_BOOTSTRAP_PASSWORD,
        }
      : null,
  };
}

export async function shouldRequirePasswordRotation(userEmail: string): Promise<boolean> {
  const state = await getAuthBootstrapState();
  if (state.mode !== 'bootstrap') {
    return false;
  }

  return state.requiresPasswordRotation && state.email.toLowerCase() === userEmail.toLowerCase();
}

export async function completeBootstrapPasswordRotation(userEmail: string): Promise<void> {
  const state = await getAuthBootstrapState();
  if (state.mode !== 'bootstrap') {
    return;
  }
  if (state.email.toLowerCase() !== userEmail.toLowerCase()) {
    return;
  }

  await saveState({
    ...state,
    mode: 'normal',
    showDemoCredentials: false,
    requiresPasswordRotation: false,
  });
}

