/**
 * Security Utilities for Extension Installation
 * 
 * Provides file validation, size limits, and path traversal protection
 */

import path from 'path';
import { ExtensionInstallerError } from './errors';

// ============================================================================
// File Type Validation
// ============================================================================

/** Allowed file extensions for theme/plugin packages */
// Theme Pack (L3.5) is strictly allow-listed.
export const ALLOWED_EXTENSIONS = [
    '.json',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
    '.svg',
    '.css',
    '.md',
    '.txt',
    '.woff',
    '.woff2',
] as const;

/** Forbidden file extensions (executable scripts and binary) */
export const FORBIDDEN_EXTENSIONS = [
    '.js',
    '.ts',
    '.tsx',
    '.jsx',
    '.mjs',
    '.cjs',
    '.exe',
    '.sh',
    '.bat',
    '.cmd',
    '.ps1',
    '.dll',
    '.so',
    '.dylib',
    '.node',
    '.wasm',
    '.map',
] as const;

/**
 * For executable extensions (Theme App / Bundle / Plugin), we only forbid high-risk source/script/binary types,
 * and do NOT enforce a strict allow-list, because build artifacts legitimately contain many extensions.
 */
const EXECUTABLE_FORBIDDEN_EXTENSIONS = [
    '.ts',
    '.tsx',
    '.jsx',
    '.sh',
    '.bat',
    '.cmd',
    '.ps1',
    '.exe',
    '.dll',
    '.so',
    '.dylib',
    '.node',
    '.map',
] as const;

function isTypeDeclarationFile(filename: string): boolean {
    const normalized = filename.toLowerCase();
    return normalized.endsWith('.d.ts') || normalized.endsWith('.d.mts') || normalized.endsWith('.d.cts');
}

function isAllowedPluginRuntimeBinary(filename: string, kind?: string): boolean {
    if (kind !== 'plugin') {
        return false;
    }

    const normalized = filename.replace(/\\/g, '/').toLowerCase();
    const isNativeOrWasm =
        normalized.endsWith('.node') ||
        normalized.endsWith('.wasm') ||
        /\.so(\.\d+)*$/.test(normalized);
    if (!isNativeOrWasm) {
        return false;
    }

    return (
        normalized.includes('node_modules/.prisma/') ||
        normalized.includes('node_modules/@prisma/engines/') ||
        normalized.includes('node_modules/prisma/') ||
        normalized.includes('node_modules/@img/sharp-linux-') ||
        normalized.includes('node_modules/@img/sharp-libvips-')
    );
}

function isThemePackKind(kind?: string): boolean {
    return kind === 'theme-shop' || kind === 'theme-admin';
}

/**
 * Validate file extension
 * @throws Error if file type is forbidden or not allowed
 */
export function validateFileExtension(filename: string, kind?: string): void {
    const ext = path.extname(filename).toLowerCase();

    // Theme Pack (L3.5): strict allow-list + strict forbidden-list
    if (isThemePackKind(kind)) {
        if (FORBIDDEN_EXTENSIONS.includes(ext as any)) {
            throw new ExtensionInstallerError(
                `Forbidden file type detected: ${ext}. Executable scripts are not allowed for ${kind} security reasons.`,
                { code: 'FORBIDDEN_FILE_TYPE', statusCode: 400 }
            );
        }
        if (ext && !ALLOWED_EXTENSIONS.includes(ext as any)) {
            throw new ExtensionInstallerError(
                `Unsupported file type: ${ext}. Only ${ALLOWED_EXTENSIONS.join(', ')} are allowed.`,
                { code: 'UNSUPPORTED_FILE_TYPE', statusCode: 400 }
            );
        }
        return;
    }

    // Theme App / Bundle / Plugin: forbid only high-risk types; allow everything else (including .js/.mjs/.cjs and nested .zip files in bundles)
    if (isTypeDeclarationFile(filename)) {
        return;
    }
    if (isAllowedPluginRuntimeBinary(filename, kind)) {
        return;
    }
    if (EXECUTABLE_FORBIDDEN_EXTENSIONS.includes(ext as any)) {
        throw new ExtensionInstallerError(
            `Forbidden file type detected: ${ext}. This file type is not allowed for ${kind || 'extension'} security reasons.`,
            { code: 'FORBIDDEN_FILE_TYPE', statusCode: 400 }
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
export const MAX_ZIP_SIZE = 10 * 1024 * 1024;

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
function getMaxFileSize(kind?: string): number {
    // Theme Pack is intentionally strict.
    if (isThemePackKind(kind)) return MAX_FILE_SIZE;
    // Executable bundles/apps may legitimately include larger JS/WASM assets.
    if (kind === 'bundle') return 100 * 1024 * 1024; // 100MB
    if (kind === 'plugin') return 50 * 1024 * 1024; // 50MB
    if (kind === 'theme-app-shop' || kind === 'theme-app-admin') return 100 * 1024 * 1024; // 100MB
    return MAX_FILE_SIZE;
}

export function validateFileSize(filename: string, size: number, kind?: string): void {
    const max = getMaxFileSize(kind);
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

    if (!resolvedPath.startsWith(resolvedBase)) {
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
    manifestName: 'theme.json' | 'manifest.json'
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
    MISSING_MANIFEST: 'Missing required manifest file (theme.json or manifest.json).',
} as const;
