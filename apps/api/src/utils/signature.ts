/**
 * Jiffoo Platform - Unified Signature Utilities
 *
 * HMAC-SHA256 signature generation and verification for secure communication
 * between the Jiffoo platform and external plugins.
 *
 * Protocol Specification (V1):
 * - Algorithm: HMAC-SHA256
 * - String to sign format: `${timestamp}\n${method}\n${path}\n${body}`
 * - Timestamp: ISO 8601 format (e.g., "2024-01-01T12:00:00.000Z")
 * - Request body: Only JSON is supported in V1
 *
 * Path Rules:
 * - For /install and /uninstall calls: Use fixed paths "/install" or "/uninstall"
 * - For gateway API forwarding: Use the path after removing /api/plugins/<slug>/api prefix
 *   e.g., /api/plugins/demo/api/orders -> /orders
 *
 * Headers sent with signed requests:
 * - X-Platform-Id: "jiffoo"
 * - X-Platform-Env: "development" | "production"
 * - X-Platform-Timestamp: ISO timestamp
 * - X-Platform-Signature: HMAC signature
 * - X-Plugin-Slug: Plugin slug
 * - X-Tenant-ID: Tenant ID
 * - X-Installation-ID: Installation ID
 * - X-User-ID: User ID (optional, if authenticated)
 */
import crypto from 'crypto'

/**
 * Generate HMAC-SHA256 signature
 *
 * @param sharedSecret - The shared secret between platform and plugin
 * @param method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param path - Request path (see Path Rules in module documentation)
 * @param body - Request body as JSON string (empty string for GET/HEAD requests)
 * @param timestamp - ISO 8601 timestamp string
 * @returns Hex-encoded HMAC-SHA256 signature
 *
 * @example
 * // For /install call
 * const signature = generateSignature(secret, 'POST', '/install', '{"tenantId":1}', '2024-01-01T12:00:00.000Z');
 *
 * // For gateway API forwarding (/api/plugins/demo/api/orders -> /orders)
 * const signature = generateSignature(secret, 'GET', '/orders', '', '2024-01-01T12:00:00.000Z');
 */
export function generateSignature(
  sharedSecret: string,
  method: string,
  path: string,
  body: string,
  timestamp: string
): string {
  const stringToSign = `${timestamp}\n${method}\n${path}\n${body}`
  return crypto.createHmac('sha256', sharedSecret).update(stringToSign).digest('hex')
}

/**
 * Verify HMAC-SHA256 signature
 *
 * @param sharedSecret - The shared secret between platform and plugin
 * @param method - HTTP method
 * @param path - Request path
 * @param body - Request body as JSON string
 * @param timestamp - ISO timestamp from X-Platform-Timestamp header
 * @param signature - Signature from X-Platform-Signature header
 * @returns true if signature is valid
 */
export function verifySignature(
  sharedSecret: string,
  method: string,
  path: string,
  body: string,
  timestamp: string,
  signature: string
): boolean {
  const expectedSignature = generateSignature(sharedSecret, method, path, body, timestamp)
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
  } catch {
    return false
  }
}


