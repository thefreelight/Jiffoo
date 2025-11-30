/**
 * Server-side Mall Context Helper
 * 
 * This module provides server-side utilities for fetching mall context
 * in Next.js Server Components and Server Actions.
 * 
 * Note: Due to Next.js limitations with async headers(), this helper
 * primarily focuses on query parameter-based tenant detection.
 * For custom domain detection, the client-side logic will handle it.
 */

export interface ServerMallContext {
  tenantId: string;
  tenantName: string;
  subdomain: string | null;
  domain: string | null;
  logo: string | null;
  theme: {
    slug: string;
    config?: Record<string, any>;
    version?: string;
    pluginSlug?: string;
  } | null;
  settings: Record<string, unknown> | null;
  status: string;
  defaultLocale?: string;
  supportedLocales?: string[];
}

/**
 * Fetch mall context from backend API (server-side)
 * 
 * This is a simplified version that works with Next.js Server Components.
 * It primarily handles tenant ID from query parameters.
 * 
 * @param searchParams - URL search params from Next.js page props
 * @returns Mall context or null if not found
 */
export async function getServerMallContext(
  searchParams?: Record<string, string | string[] | undefined>
): Promise<ServerMallContext | null> {
  try {
    // Extract tenant parameter
    const tenantParam = searchParams?.tenant;
    const tenantValue = Array.isArray(tenantParam) ? tenantParam[0] : tenantParam;

    // Only proceed if we have a valid numeric tenant ID
    if (!tenantValue || !/^\d+$/.test(tenantValue)) {
      return null;
    }

    // Build API URL - 使用 API_SERVICE_URL (服务端直连 API 服务，端口 3001)
    const apiServiceUrl = process.env.API_SERVICE_URL || 'http://localhost:3001';
    const url = `${apiServiceUrl}/api/mall/context?tenant=${tenantValue}`;

    // Fetch from backend
    const response = await fetch(url, {
      cache: 'no-store', // Always fetch fresh data for SSR
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch mall context: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.success && data.data) {
      return data.data as ServerMallContext;
    }

    return null;
  } catch (error) {
    console.error('Error fetching server mall context:', error);
    return null;
  }
}
