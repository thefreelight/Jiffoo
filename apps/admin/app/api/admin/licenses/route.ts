/**
 * API Proxy for Admin License Management
 * Proxies requests to the API service for license management
 */

import { NextResponse } from 'next/server';
// 🔧 统一环境管理：使用共享envConfig
import { envConfig } from 'shared/config/env';

export async function GET() {
  try {
    // 🔧 使用统一的 API 服务 URL 配置
    const apiUrl = `${envConfig.getApiServiceUrl()}/api/admin/licenses`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API service responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Admin licenses API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch licenses'
      },
      { status: 500 }
    );
  }
}
