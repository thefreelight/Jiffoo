import { env } from '@/config/env';

type CacheEntry = {
  expiresAt: number;
  value: string;
};

type VaultSecretRef = {
  field: string;
  mount: string;
  path: string;
};

export class SecretManagerError extends Error {
  code: string;

  constructor(message: string, code = 'SECRET_MANAGER_ERROR') {
    super(message);
    this.name = 'SecretManagerError';
    this.code = code;
  }
}

export class SecretManagerService {
  private static cache = new Map<string, CacheEntry>();

  static async resolve(secretRef: string): Promise<string> {
    const normalizedRef = String(secretRef || '').trim();
    if (!normalizedRef) {
      throw new SecretManagerError('Secret reference is empty', 'SECRET_REF_EMPTY');
    }

    const cached = this.cache.get(normalizedRef);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const parsed = this.parseSecretRef(normalizedRef);
    let value: string;
    if (parsed.protocol === 'vault:') {
      value = await this.resolveVaultSecret(parsed);
    } else {
      throw new SecretManagerError(
        `Unsupported secret reference protocol "${parsed.protocol}"`,
        'SECRET_REF_PROTOCOL_UNSUPPORTED'
      );
    }

    this.cache.set(normalizedRef, {
      value,
      expiresAt: now + env.VAULT_CACHE_TTL_MS,
    });

    return value;
  }

  private static parseSecretRef(secretRef: string): URL {
    try {
      return new URL(secretRef);
    } catch {
      throw new SecretManagerError(
        `Invalid secret reference "${secretRef}". Expected format like vault://kv/app/path#field`,
        'SECRET_REF_INVALID'
      );
    }
  }

  private static parseVaultSecretRef(secretRef: URL): VaultSecretRef {
    const mount = decodeURIComponent(secretRef.hostname || '').trim();
    const path = decodeURIComponent(secretRef.pathname || '').replace(/^\/+/, '').trim();
    const field = decodeURIComponent(secretRef.hash.replace(/^#/, '') || '').trim();

    if (!mount || !path || !field) {
      throw new SecretManagerError(
        `Invalid Vault secret reference "${secretRef.toString()}". Expected vault://<mount>/<path>#<field>`,
        'SECRET_REF_INVALID'
      );
    }

    return { mount, path, field };
  }

  private static async resolveVaultSecret(secretRef: URL): Promise<string> {
    const vaultAddr = String(env.VAULT_ADDR || '').trim();
    const vaultToken = String(env.VAULT_TOKEN || '').trim();

    if (!vaultAddr) {
      throw new SecretManagerError('VAULT_ADDR is not configured', 'VAULT_ADDR_MISSING');
    }
    if (!vaultToken) {
      throw new SecretManagerError('VAULT_TOKEN is not configured', 'VAULT_TOKEN_MISSING');
    }

    const parsed = this.parseVaultSecretRef(secretRef);
    const requestUrl = `${vaultAddr.replace(/\/$/, '')}/v1/${parsed.mount}/data/${parsed.path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.VAULT_TIMEOUT_MS);

    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Vault-Token': vaultToken,
          ...(env.VAULT_NAMESPACE ? { 'X-Vault-Namespace': env.VAULT_NAMESPACE } : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new SecretManagerError(
          `Vault request failed for "${secretRef.toString()}" with status ${response.status}`,
          'VAULT_REQUEST_FAILED'
        );
      }

      const payload = await response.json() as {
        data?: {
          data?: Record<string, unknown>;
        };
      };
      const rawValue = payload?.data?.data?.[parsed.field];

      if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
        throw new SecretManagerError(
          `Vault secret field "${parsed.field}" is missing or empty for "${secretRef.toString()}"`,
          'VAULT_SECRET_FIELD_MISSING'
        );
      }

      return rawValue.trim();
    } catch (error) {
      if (error instanceof SecretManagerError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new SecretManagerError(
          `Vault request timed out for "${secretRef.toString()}"`,
          'VAULT_REQUEST_TIMEOUT'
        );
      }

      throw new SecretManagerError(
        error instanceof Error ? error.message : 'Vault request failed',
        'VAULT_REQUEST_FAILED'
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
