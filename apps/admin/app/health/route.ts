import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Tenant Admin application
 * This endpoint is independent of API Service and only checks the Next.js app itself
 * Used by Kubernetes readiness and liveness probes
 */
const BOOT_TS = Date.now();

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'tenant',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - BOOT_TS) / 1000),
  });
}

export const runtime = 'edge';
