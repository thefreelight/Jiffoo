import { systemSettingsService } from '@/core/admin/system-settings/service';
import type { AuthBootstrapMode, AuthBootstrapStatus } from 'shared/src/types/auth';

const AUTH_BOOTSTRAP_SETTINGS_KEY = 'auth.bootstrap.admin';
const DEFAULT_BOOTSTRAP_EMAIL = process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL || 'admin@jiffoo.com';
const DEFAULT_BOOTSTRAP_PASSWORD = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD || 'admin123';
const DEFAULT_BOOTSTRAP_MODE = normalizeMode(process.env.AUTH_BOOTSTRAP_MODE);

type StoredAuthBootstrapState = {
  mode: AuthBootstrapMode;
  showBootstrapCredentials: boolean;
  requiresPasswordRotation: boolean;
  email: string;
  updatedAt: string;
};

function normalizeMode(value: unknown): AuthBootstrapMode {
  if (value === 'normal') {
    return value;
  }
  return 'bootstrap';
}

function buildDefaultBootstrapState(): StoredAuthBootstrapState {
  return {
    mode: DEFAULT_BOOTSTRAP_MODE,
    showBootstrapCredentials: DEFAULT_BOOTSTRAP_MODE === 'bootstrap',
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

  const mode: AuthBootstrapMode = value.mode === 'bootstrap' ? 'bootstrap' : 'normal';
  const email = typeof value.email === 'string' && value.email.trim()
    ? value.email.trim()
    : DEFAULT_BOOTSTRAP_EMAIL;
  const showBootstrapCredentials = mode === 'bootstrap';
  const requiresPasswordRotation = mode === 'bootstrap';

  return {
    mode,
    showBootstrapCredentials,
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
    showBootstrapCredentials: state.showBootstrapCredentials,
    requiresPasswordRotation: state.requiresPasswordRotation,
    credentials: state.showBootstrapCredentials
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
    showBootstrapCredentials: false,
    requiresPasswordRotation: false,
  });
}

