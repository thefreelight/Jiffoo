import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/database', () => ({
  prisma: {
    pluginThemeExtension: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/core/logger/unified-logger', () => ({
  LoggerService: {
    log: vi.fn(),
    logError: vi.fn(),
  },
}));

import { prisma } from '@/config/database';
import { LoggerService } from '@/core/logger/unified-logger';
import { ThemeExtensionsService } from '@/core/admin/plugin-management/theme-extensions-service';

describe('ThemeExtensionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty list when theme extension tables are unavailable', async () => {
    (prisma.pluginThemeExtension.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('The table `public.plugin_theme_extensions` does not exist in the current database.')
    );

    await expect(ThemeExtensionsService.getActiveEmbeds()).resolves.toEqual([]);
    expect(LoggerService.log).toHaveBeenCalledWith(
      'warn',
      'Theme extension tables unavailable; returning no app embeds',
      expect.objectContaining({
        context: 'ThemeExtensionsService.getActiveEmbeds',
      })
    );
  });
});
