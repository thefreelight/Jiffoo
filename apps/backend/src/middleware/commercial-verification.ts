/**
 * 商业服务器请求验证中间件
 * 验证来自客户端的商业服务请求，防止未授权访问
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

interface CommercialRequestQuery {
  client?: string;
  fp?: string;
  ts?: string;
  sig?: string;
  type?: string;
}

interface CommercialRequestHeaders {
  'x-client-type'?: string;
  'x-client-fingerprint'?: string;
  'user-agent'?: string;
}

/**
 * 验证客户端指纹的合法性
 */
function validateClientFingerprint(fingerprint: string): boolean {
  // 指纹应该是16位十六进制字符串
  if (!fingerprint || fingerprint.length !== 16) {
    return false;
  }
  
  // 检查是否为有效的十六进制
  return /^[a-f0-9]{16}$/i.test(fingerprint);
}

/**
 * 验证时间戳的有效性
 */
function validateTimestamp(timestamp: string): boolean {
  const ts = parseInt(timestamp);
  const now = Date.now();
  const diff = Math.abs(now - ts);
  
  // 允许5分钟的时间差
  const MAX_TIME_DIFF = 5 * 60 * 1000;
  
  return diff <= MAX_TIME_DIFF;
}

/**
 * 验证请求签名
 */
// 密钥组件分散存储（防止静态分析）
const _k1 = () => 'jiffoo';
const _k2 = () => 'secret';
const _k3 = () => '2024';
const _getSignatureKey = () => `${_k1()}-${_k2()}-${_k3()}`;

function validateSignature(
  baseUrl: string,
  clientType: string,
  fingerprint: string,
  timestamp: string,
  signature: string
): boolean {
  try {
    const signatureData = `${baseUrl}${clientType}${fingerprint}${timestamp}`;
    const expectedSignature = crypto
      .createHash('md5')
      .update(signatureData + _getSignatureKey())
      .digest('hex')
      .substring(0, 12);

    return signature === expectedSignature;
  } catch {
    return false;
  }
}

/**
 * 检查客户端类型的合法性
 */
function validateClientType(clientType: string): boolean {
  return clientType === 'opensource' || clientType === 'commercial';
}

/**
 * 检查请求频率限制
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(clientFingerprint: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1分钟窗口
  const maxRequests = 100; // 每分钟最多100个请求
  
  const key = clientFingerprint;
  const current = requestCounts.get(key);
  
  if (!current || now > current.resetTime) {
    // 新窗口或窗口已重置
    requestCounts.set(key, {
      count: 1,
      resetTime: now + windowMs
    });
    return true;
  }
  
  if (current.count >= maxRequests) {
    return false; // 超过限制
  }
  
  current.count++;
  return true;
}

/**
 * 记录可疑请求
 */
function logSuspiciousRequest(
  request: FastifyRequest,
  reason: string,
  details?: any
) {
  const logData = {
    timestamp: new Date().toISOString(),
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    url: request.url,
    reason,
    details,
    headers: {
      'x-client-type': request.headers['x-client-type'],
      'x-client-fingerprint': request.headers['x-client-fingerprint']
    }
  };
  
  console.warn('🚨 Suspicious commercial request:', JSON.stringify(logData, null, 2));
  
  // 在生产环境中，这里应该发送到安全监控系统
  // 例如：发送到 Sentry、DataDog 或自定义的安全日志系统
}

/**
 * 商业服务验证中间件
 */
export async function commercialVerificationMiddleware(
  request: FastifyRequest<{
    Querystring: CommercialRequestQuery;
    Headers: CommercialRequestHeaders;
  }>,
  reply: FastifyReply
) {
  try {
    const query = request.query;
    const headers = request.headers;
    
    // 1. 检查必需的查询参数
    if (!query.client || !query.fp || !query.ts || !query.sig || !query.type) {
      logSuspiciousRequest(request, 'Missing required query parameters', { query });
      return reply.status(400).send({
        success: false,
        error: 'Invalid request parameters'
      });
    }
    
    // 2. 验证客户端类型
    if (!validateClientType(query.client)) {
      logSuspiciousRequest(request, 'Invalid client type', { clientType: query.client });
      return reply.status(400).send({
        success: false,
        error: 'Invalid client type'
      });
    }
    
    // 3. 验证客户端指纹
    if (!validateClientFingerprint(query.fp)) {
      logSuspiciousRequest(request, 'Invalid client fingerprint', { fingerprint: query.fp });
      return reply.status(400).send({
        success: false,
        error: 'Invalid client fingerprint'
      });
    }
    
    // 4. 验证时间戳
    if (!validateTimestamp(query.ts)) {
      logSuspiciousRequest(request, 'Invalid or expired timestamp', { timestamp: query.ts });
      return reply.status(400).send({
        success: false,
        error: 'Request expired or invalid timestamp'
      });
    }
    
    // 5. 验证请求签名
    const baseUrl = `https://${request.hostname}${request.url.split('?')[0]}`;
    if (!validateSignature(baseUrl, query.client, query.fp, query.ts, query.sig)) {
      logSuspiciousRequest(request, 'Invalid request signature', {
        expectedUrl: baseUrl,
        providedSignature: query.sig
      });
      return reply.status(401).send({
        success: false,
        error: 'Invalid request signature'
      });
    }
    
    // 6. 检查请求头一致性
    if (headers['x-client-type'] && headers['x-client-type'] !== query.client) {
      logSuspiciousRequest(request, 'Client type mismatch', {
        queryClient: query.client,
        headerClient: headers['x-client-type']
      });
      return reply.status(400).send({
        success: false,
        error: 'Client type mismatch'
      });
    }
    
    if (headers['x-client-fingerprint'] && headers['x-client-fingerprint'] !== query.fp) {
      logSuspiciousRequest(request, 'Client fingerprint mismatch', {
        queryFingerprint: query.fp,
        headerFingerprint: headers['x-client-fingerprint']
      });
      return reply.status(400).send({
        success: false,
        error: 'Client fingerprint mismatch'
      });
    }
    
    // 7. 检查频率限制
    if (!checkRateLimit(query.fp)) {
      logSuspiciousRequest(request, 'Rate limit exceeded', { fingerprint: query.fp });
      return reply.status(429).send({
        success: false,
        error: 'Too many requests'
      });
    }
    
    // 8. 检查 User-Agent
    const userAgent = headers['user-agent'] || '';
    if (!userAgent.includes('Jiffoo')) {
      logSuspiciousRequest(request, 'Suspicious User-Agent', { userAgent });
      // 不阻止请求，但记录日志
    }
    
    // 验证通过，添加验证信息到请求对象
    (request as any).commercialClient = {
      type: query.client,
      fingerprint: query.fp,
      timestamp: parseInt(query.ts),
      serverType: query.type,
      verified: true
    };
    
    // 记录成功的验证（用于分析）
    console.log(`✅ Commercial request verified: ${query.client} client accessing ${query.type} service`);
    
  } catch (error) {
    console.error('Commercial verification middleware error:', error);
    logSuspiciousRequest(request, 'Verification middleware error', { error: error.message });
    
    return reply.status(500).send({
      success: false,
      error: 'Internal verification error'
    });
  }
}

/**
 * 获取验证统计信息（用于监控）
 */
export function getVerificationStats() {
  const now = Date.now();
  const activeClients = Array.from(requestCounts.entries())
    .filter(([_, data]) => now <= data.resetTime)
    .length;
  
  return {
    activeClients,
    totalTrackedClients: requestCounts.size,
    timestamp: new Date().toISOString()
  };
}

/**
 * 清理过期的请求计数记录
 */
export function cleanupExpiredRecords() {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(key);
    }
  }
}

// 定期清理过期记录
setInterval(cleanupExpiredRecords, 5 * 60 * 1000); // 每5分钟清理一次
