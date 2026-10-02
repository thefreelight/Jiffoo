/**
 * Security Utilities for Extension Installation
 * 
 * Provides file validation, size limits, and path traversal protection
 */

import path from 'path';
import { ExtensionInstallerError } from './errors';
import { extensionMaxFileSize, getPluginFileViolation, isPathWithinExtensionBase, PLUGIN_MAX_ZIP_SIZE } from 'shared/plugin-signing';

// ============================================================================
// File Type Validation
// ============================================================================

/**
 * For executable extensions, we only forbid high-risk source/script/binary types,
 * and do NOT enforce a strict allow-list, because build artifacts legitimately contain many extensions.
 */
/**
 * Validate file extension
 * @throws Error if file type is forbidden or not allowed
 */
export function validateFileExtension(filename: string, kind?: string): void {
    const pluginViolation = getPluginFileViolation(filename);
    if (kind === 'plugin' && pluginViolation?.code === 'FORBIDDEN_PRISMA_CLIENT') {
        throw new ExtensionInstallerError(
            `Generated Prisma client is not allowed in plugin packages: ${filename}`,
            { code: 'FORBIDDEN_PRISMA_CLIENT', statusCode: 400 }
        );
    }

    // Plugins allow built artifacts, including JavaScript and nested ZIP files.
    if (pluginViolation?.extension) {
        const ext = pluginViolation.extension;
        throw new ExtensionInstallerError(
            `Forbidden file type detected: ${ext}. This file type is not allowed for ${kind || 'extension'} security reasons.`,
            { code: pluginViolation.code, statusCode: 400 }
        );
    }
}

/**
 * Validate all files in a directory recursively
 */
export async function validateDirectoryFiles(
    dirPath: string,
    kind?: string,
    rootDir: string = dirPath
): Promise<void> {
    const fs = await import('fs/promises');
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            // Recursively validate subdirectories
            await validateDirectoryFiles(fullPath, kind, rootDir);
        } else if (entry.isFile()) {
            // Validate file extension
            validateFileExtension(path.relative(rootDir, fullPath), kind);
        }
    }
}

// ============================================================================
// File Size Validation
// ============================================================================

/** Maximum ZIP file size (10MB) */
export const MAX_ZIP_SIZE = PLUGIN_MAX_ZIP_SIZE;

/** Maximum individual file size (5MB) */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Maximum font file size (2MB) - stricter limit for fonts */
export const MAX_FONT_FILE_SIZE = 2 * 1024 * 1024;

/** Maximum number of font files */
export const MAX_FONT_FILES = 10;

/** Maximum total font size (5MB) */
export const MAX_TOTAL_FONT_SIZE = 5 * 1024 * 1024;

/**
 * Validate ZIP file size
 * @throws Error if size exceeds limit
 */
export function validateZipSize(size: number): void {
    if (size > MAX_ZIP_SIZE) {
        throw new ExtensionInstallerError(
            `ZIP file size (${formatBytes(size)}) exceeds maximum allowed size of ${formatBytes(MAX_ZIP_SIZE)}`,
            { code: 'ZIP_TOO_LARGE', statusCode: 413 }
        );
    }
}

/**
 * Validate individual file size
 * @throws Error if size exceeds limit
 */
export function validateFileSize(filename: string, size: number, kind?: string): void {
    const max = extensionMaxFileSize(kind);
    if (size > max) {
        throw new ExtensionInstallerError(
            `File "${filename}" size (${formatBytes(size)}) exceeds maximum allowed size of ${formatBytes(max)}`,
            { code: 'FILE_TOO_LARGE', statusCode: 413 }
        );
    }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ============================================================================
// Path Traversal Protection
// ============================================================================

/**
 * Validate that a path is within the allowed base directory
 * Prevents directory traversal attacks (e.g., ../../etc/passwd)
 * 
 * @throws Error if path traversal is detected
 */
export function validatePathTraversal(filePath: string, baseDir: string): void {
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(baseDir);

    if (!isPathWithinExtensionBase(resolvedPath, resolvedBase)) {
        throw new ExtensionInstallerError(
            `Directory traversal detected: "${filePath}" is outside allowed directory "${baseDir}"`,
            { code: 'PATH_TRAVERSAL', statusCode: 400 }
        );
    }
}

/**
 * Sanitize filename to prevent path traversal
 * Removes any path separators and parent directory references
 */
export function sanitizeFilename(filename: string): string {
    return filename
        .replace(/\.\./g, '') // Remove ..
        .replace(/[\/\\]/g, '_') // Replace path separators with underscore
        .replace(/^\.+/, ''); // Remove leading dots
}

// ============================================================================
// Content Validation
// ============================================================================

/**
 * Validate that a directory contains required manifest file
 */
export async function validateManifestExists(
    dirPath: string,
    manifestName: 'manifest.json'
): Promise<void> {
    const fs = await import('fs/promises');
    const manifestPath = path.join(dirPath, manifestName);

    try {
        await fs.access(manifestPath);
    } catch {
        throw new ExtensionInstallerError(`Missing required file: ${manifestName}`, {
            code: 'MISSING_MANIFEST',
            statusCode: 400
        });
    }
}

/**
 * Validate ZIP entry during extraction
 * Checks for path traversal, file size, and file type
 */
export function validateZipEntry(
    entryPath: string,
    entrySize: number,
    baseDir: string,
    kind?: string
): void {
    // Validate path traversal
    const fullPath = path.join(baseDir, entryPath);
    validatePathTraversal(fullPath, baseDir);

    // Validate file size
    if (entrySize > 0) {
        validateFileSize(entryPath, entrySize, kind);
    }

    // Validate file extension
    validateFileExtension(entryPath, kind);
}

// ============================================================================
// Error Messages
// ============================================================================

export const SECURITY_ERROR_MESSAGES = {
    FORBIDDEN_FILE_TYPE: 'Forbidden file type detected. Executable scripts are not allowed.',
    UNSUPPORTED_FILE_TYPE: 'Unsupported file type. Only images, JSON, CSS, and text files are allowed.',
    FILE_TOO_LARGE: 'File size exceeds maximum allowed size.',
    ZIP_TOO_LARGE: 'ZIP file size exceeds maximum allowed size.',
    PATH_TRAVERSAL: 'Directory traversal detected. Invalid file path.',
    MISSING_MANIFEST: 'Missing required manifest file (manifest.json).',
} as const;
