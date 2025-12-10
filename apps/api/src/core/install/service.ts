/**
 * Install Service (单商户版本)
 */

import { prisma } from '@/config/database';
import bcrypt from 'bcryptjs';

export interface InstallationStatus {
  isInstalled: boolean;
  version?: string;
  installedAt?: Date;
  siteName?: string;
}

export interface InstallData {
  siteName: string;
  siteDescription?: string;
  adminEmail: string;
  adminPassword: string;
  adminUsername?: string;
}

export class InstallService {
  static async checkInstallationStatus(): Promise<InstallationStatus> {
    try {
      const settings = await prisma.systemSettings.findUnique({
        where: { id: 'system' }
      });

      if (!settings) {
        return { isInstalled: false };
      }

      return {
        isInstalled: settings.isInstalled,
        version: settings.version,
        installedAt: settings.installedAt || undefined,
        siteName: settings.siteName
      };
    } catch (error) {
      return { isInstalled: false };
    }
  }

  static async checkDatabaseConnection(): Promise<{ connected: boolean; error?: string }> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { connected: true };
    } catch (error: any) {
      return { connected: false, error: error.message };
    }
  }

  static async completeInstallation(data: InstallData): Promise<{ success: boolean; error?: string }> {
    try {
      const status = await this.checkInstallationStatus();
      if (status.isInstalled) {
        return { success: false, error: 'System is already installed' };
      }

      // 创建管理员账号
      const hashedPassword = await bcrypt.hash(data.adminPassword, 10);
      const existingAdmin = await prisma.user.findFirst({
        where: { email: data.adminEmail }
      });

      let adminUser;
      if (!existingAdmin) {
        adminUser = await prisma.user.create({
          data: {
            email: data.adminEmail,
            username: data.adminUsername || data.adminEmail.split('@')[0],
            password: hashedPassword,
            role: 'ADMIN',
            isActive: true,
          }
        });
      } else {
        adminUser = existingAdmin;
      }

      // 更新系统设置
      await prisma.systemSettings.upsert({
        where: { id: 'system' },
        create: {
          id: 'system',
          isInstalled: true,
          installedAt: new Date(),
          installedBy: adminUser.id,
          siteName: data.siteName,
          siteDescription: data.siteDescription,
          version: '1.0.0',
        },
        update: {
          isInstalled: true,
          installedAt: new Date(),
          installedBy: adminUser.id,
          siteName: data.siteName,
          siteDescription: data.siteDescription,
        }
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async getSystemSettings() {
    return prisma.systemSettings.findUnique({ where: { id: 'system' } });
  }

  static async updateSystemSettings(data: Partial<{
    siteName: string;
    siteDescription: string;
    logoUrl: string;
    faviconUrl: string;
    maintenanceMode: boolean;
    allowRegistration: boolean;
    requireEmailVerification: boolean;
  }>) {
    return prisma.systemSettings.update({
      where: { id: 'system' },
      data
    });
  }
}
