/**
 * API Proxy for Testing Authentication Providers
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001';

export async function POST(
  request: NextRequest,
  { params }: { params: { providerId: string } }
) {
  try {
    const { providerId } = params;
    const backendUrl = `${BACKEND_URL}/auth/${providerId}/authorize?state=test`;

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Auth provider test error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test provider'
      },
      { status: 500 }
    );
  }
}
