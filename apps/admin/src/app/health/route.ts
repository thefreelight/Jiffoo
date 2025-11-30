import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Platform Admin application
 * This endpoint is independent of API Service and only checks the Next.js app itself
 * Used by Kubernetes readiness and liveness probes
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'admin',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

