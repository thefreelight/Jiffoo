import { logger } from '@/core/logger/logger';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { Readable } from 'stream';

interface BackupMetadata {
    timestamp: string;
    database: string;
    file: string;
    checksum_file: string;
    size: number;
    encrypted: boolean;
    compression: string;
    s3_path: string;
}

interface BackupInfo {
    key: string;
    lastModified: Date;
    size: number;
}

export class BackupMonitor {
    private s3Client: S3Client;
    private bucketName: string;

    constructor() {
        this.s3Client = new S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
        });
        this.bucketName = process.env.S3_BACKUP_BUCKET || 'jiffoo-backups';
    }

    /**
     * Get the latest backup from S3
     */
    async getLatestBackup(): Promise<BackupInfo | null> {
        try {
            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: 'database/db_backup_',
            });

            const response = await this.s3Client.send(command);

            if (!response.Contents || response.Contents.length === 0) {
                return null;
            }

            // Sort by last modified date (descending)
            const sortedBackups = response.Contents
                .filter((obj) => obj.Key && obj.Key.endsWith('.sql.gpg'))
                .sort((a, b) => {
                    const dateA = a.LastModified?.getTime() || 0;
                    const dateB = b.LastModified?.getTime() || 0;
                    return dateB - dateA;
                });

            if (sortedBackups.length === 0) {
                return null;
            }

            const latest = sortedBackups[0];
            return {
                key: latest.Key!,
                lastModified: latest.LastModified!,
                size: latest.Size || 0,
            };
        } catch (error) {
            logger.error('Failed to get latest backup', { error });
            throw error;
        }
    }

    /**
     * Check if backup is recent (within RPO)
     */
    async checkBackupFreshness(): Promise<boolean> {
        try {
            const latestBackup = await this.getLatestBackup();

            if (!latestBackup) {
                logger.error('No backup found');
                await this.sendAlert('❌ No backup found!');
                return false;
            }

            const age = Date.now() - latestBackup.lastModified.getTime();
            const maxAge = 26 * 60 * 60 * 1000; // 26 hours (RPO + buffer)

            if (age > maxAge) {
                logger.error('Backup is too old', {
                    age: Math.floor(age / 1000 / 60 / 60) + ' hours',
                    latestBackup,
                });
                await this.sendAlert(
                    `❌ Backup is too old: ${latestBackup.key} (${Math.floor(age / 1000 / 60 / 60)} hours old)`
                );
                return false;
            }

            logger.info('Backup is fresh', {
                age: Math.floor(age / 1000 / 60 / 60) + ' hours',
                latestBackup,
            });
            return true;
        } catch (error) {
            logger.error('Failed to check backup freshness', { error });
            return false;
        }
    }

    /**
     * Verify backup integrity by checking checksum
     */
    async verifyBackupIntegrity(backupKey: string): Promise<boolean> {
        try {
            const checksumKey = `${backupKey}.sha256`;

            // Download checksum file
            const checksumCommand = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: checksumKey,
            });

            const checksumResponse = await this.s3Client.send(checksumCommand);
            const checksumContent = await this.streamToString(checksumResponse.Body as Readable);
            const expectedChecksum = checksumContent.split(' ')[0];

            // Download backup file and calculate checksum
            const backupCommand = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: backupKey,
            });

            const backupResponse = await this.s3Client.send(backupCommand);
            const actualChecksum = await this.calculateChecksum(backupResponse.Body as Readable);

            if (actualChecksum !== expectedChecksum) {
                logger.error('Backup integrity check failed', {
                    backupKey,
                    expectedChecksum,
                    actualChecksum,
                });
                await this.sendAlert(`❌ Backup integrity check failed: ${backupKey}`);
                return false;
            }

            logger.info('Backup integrity verified', { backupKey });
            return true;
        } catch (error) {
            logger.error('Failed to verify backup integrity', { error, backupKey });
            return false;
        }
    }

    /**
     * Run all backup health checks
     */
    async runHealthChecks(): Promise<{
        freshness: boolean;
        integrity: boolean;
        overall: boolean;
    }> {
        const freshness = await this.checkBackupFreshness();

        let integrity = false;
        if (freshness) {
            const latestBackup = await this.getLatestBackup();
            if (latestBackup) {
                integrity = await this.verifyBackupIntegrity(latestBackup.key);
            }
        }

        const overall = freshness && integrity;

        if (overall) {
            await this.sendAlert('✅ Backup health check passed');
        } else {
            await this.sendAlert('❌ Backup health check failed');
        }

        return { freshness, integrity, overall };
    }

    /**
     * Send alert notification
     */
    private async sendAlert(message: string): Promise<void> {
        const webhookUrl = process.env.SLACK_WEBHOOK_URL;

        if (!webhookUrl) {
            logger.warn('SLACK_WEBHOOK_URL not configured, skipping alert');
            return;
        }

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: message }),
            });

            if (!response.ok) {
                logger.error('Failed to send Slack notification', {
                    status: response.status,
                    statusText: response.statusText,
                });
            }
        } catch (error) {
            logger.error('Failed to send alert', { error });
        }
    }

    /**
     * Convert stream to string
     */
    private async streamToString(stream: Readable): Promise<string> {
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks).toString('utf-8');
    }

    /**
     * Calculate SHA-256 checksum of a stream
     */
    private async calculateChecksum(stream: Readable): Promise<string> {
        const hash = createHash('sha256');
        for await (const chunk of stream) {
            hash.update(chunk);
        }
        return hash.digest('hex');
    }
}
