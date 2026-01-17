/**
 * Jiffoo Mall Installer - Environment Detector
 * 
 * Detects system environment: OS, Node.js, memory, disk, Docker
 */

import os from 'node:os';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import type {
    EnvironmentCheckResult,
    OSInfo,
    NodeInfo,
    MemoryInfo,
    DiskInfo,
    DockerInfo,
    REQUIREMENTS,
} from './types.js';
import { REQUIREMENTS as REQ } from './types.js';

/**
 * Get operating system information
 */
export function getOSInfo(): OSInfo {
    const platform = os.platform();
    const type = platform === 'linux' ? 'linux'
        : platform === 'darwin' ? 'darwin'
            : platform === 'win32' ? 'win32'
                : 'unknown';

    let distro: string | undefined;

    if (type === 'linux') {
        try {
            const osRelease = fs.readFileSync('/etc/os-release', 'utf-8');
            const nameMatch = osRelease.match(/^NAME="?([^"\n]+)"?/m);
            if (nameMatch) {
                distro = nameMatch[1];
            }
        } catch {
            // Ignore if can't read os-release
        }
    }

    return {
        type,
        platform,
        version: os.release(),
        arch: os.arch(),
        distro,
    };
}

/**
 * Get Node.js version information
 */
export function getNodeInfo(): NodeInfo {
    const version = process.version.replace('v', '');
    const majorVersion = parseInt(version.split('.')[0], 10);
    const requiredMajor = parseInt(REQ.node.minVersion.split('.')[0], 10);

    return {
        version,
        majorVersion,
        satisfied: majorVersion >= requiredMajor,
        requiredVersion: REQ.node.minVersion,
    };
}

/**
 * Get memory information
 */
export function getMemoryInfo(): MemoryInfo {
    const total = os.totalmem();
    const free = os.freemem();

    return {
        total,
        available: free,
        satisfied: total >= REQ.memory.minimum,
        requiredMinimum: REQ.memory.minimum,
    };
}

/**
 * Get disk space information
 */
export function getDiskInfo(): DiskInfo {
    const cwd = process.cwd();

    try {
        if (os.platform() === 'win32') {
            // Windows: Use wmic
            const output = execSync(`wmic logicaldisk where "DeviceID='${cwd[0]}:'" get Size,FreeSpace /format:csv`, {
                encoding: 'utf-8',
            });
            const lines = output.trim().split('\n').filter(line => line.trim());
            if (lines.length >= 2) {
                const values = lines[1].split(',');
                const freeSpace = parseInt(values[1], 10);
                const size = parseInt(values[2], 10);
                return {
                    total: size,
                    available: freeSpace,
                    satisfied: freeSpace >= REQ.disk.minimum,
                    requiredMinimum: REQ.disk.minimum,
                };
            }
        } else {
            // Unix: Use df
            const output = execSync(`df -B1 "${cwd}" | tail -1`, {
                encoding: 'utf-8',
            });
            const parts = output.trim().split(/\s+/);
            const total = parseInt(parts[1], 10);
            const available = parseInt(parts[3], 10);

            return {
                total,
                available,
                satisfied: available >= REQ.disk.minimum,
                requiredMinimum: REQ.disk.minimum,
            };
        }
    } catch {
        // If we can't get disk info, assume it's satisfied
    }

    return {
        total: 0,
        available: 0,
        satisfied: true, // Assume satisfied if we can't check
        requiredMinimum: REQ.disk.minimum,
    };
}

/**
 * Get Docker installation information
 */
export function getDockerInfo(): DockerInfo {
    let installed = false;
    let version: string | undefined;
    let composeInstalled = false;
    let composeVersion: string | undefined;

    // Check Docker
    try {
        const dockerVersion = execSync('docker --version', { encoding: 'utf-8' });
        installed = true;
        const match = dockerVersion.match(/Docker version ([\d.]+)/);
        if (match) {
            version = match[1];
        }
    } catch {
        // Docker not installed
    }

    // Check Docker Compose
    if (installed) {
        try {
            // Try new docker compose command first
            const composeVersionOutput = execSync('docker compose version', { encoding: 'utf-8' });
            composeInstalled = true;
            const match = composeVersionOutput.match(/v?([\d.]+)/);
            if (match) {
                composeVersion = match[1];
            }
        } catch {
            try {
                // Fallback to docker-compose
                const composeVersionOutput = execSync('docker-compose --version', { encoding: 'utf-8' });
                composeInstalled = true;
                const match = composeVersionOutput.match(/([\d.]+)/);
                if (match) {
                    composeVersion = match[1];
                }
            } catch {
                // Docker Compose not installed
            }
        }
    }

    return {
        installed,
        version,
        composeInstalled,
        composeVersion,
    };
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const net = require('net') as typeof import('net');
        const server = net.createServer();

        server.once('error', () => {
            resolve(false);
        });

        server.once('listening', () => {
            server.close();
            resolve(true);
        });

        server.listen(port, '127.0.0.1');
    });
}

/**
 * Perform complete environment check
 */
export async function checkEnvironment(): Promise<EnvironmentCheckResult> {
    const os = getOSInfo();
    const node = getNodeInfo();
    const memory = getMemoryInfo();
    const disk = getDiskInfo();
    const docker = getDockerInfo();

    const allSatisfied = node.satisfied && memory.satisfied && disk.satisfied;

    return {
        os,
        node,
        memory,
        disk,
        docker,
        allSatisfied,
        timestamp: new Date(),
    };
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let value = bytes;

    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }

    return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Get environment check summary for display
 */
export function getEnvironmentSummary(result: EnvironmentCheckResult): string[] {
    const lines: string[] = [];

    // OS
    lines.push(`Operating System: ${result.os.distro || result.os.platform} (${result.os.arch})`);

    // Node.js
    const nodeStatus = result.node.satisfied ? '✓' : '✗';
    lines.push(`Node.js: ${nodeStatus} v${result.node.version} (required: >=${result.node.requiredVersion})`);

    // Memory
    const memStatus = result.memory.satisfied ? '✓' : '✗';
    lines.push(`Memory: ${memStatus} ${formatBytes(result.memory.total)} (required: ${formatBytes(result.memory.requiredMinimum)})`);

    // Disk
    const diskStatus = result.disk.satisfied ? '✓' : '✗';
    lines.push(`Disk Space: ${diskStatus} ${formatBytes(result.disk.available)} available (required: ${formatBytes(result.disk.requiredMinimum)})`);

    // Docker
    if (result.docker.installed) {
        lines.push(`Docker: ✓ v${result.docker.version}${result.docker.composeInstalled ? ` (Compose: v${result.docker.composeVersion})` : ''}`);
    } else {
        lines.push(`Docker: ✗ Not installed (optional)`);
    }

    return lines;
}
