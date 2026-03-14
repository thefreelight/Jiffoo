/**
 * Fastify Response Compression Plugin
 */

import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import * as zlib from 'node:zlib';
import { promisify } from 'node:util';

const brotliCompress = promisify(zlib.brotliCompress);
const gzipCompress = promisify(zlib.gzip);
const deflateCompress = promisify(zlib.deflate);

export interface CompressionPluginOptions {
  /** Whether enabled */
  enabled?: boolean;
  /** Skipped paths */
  skipPaths?: string[];
  /** Minimum response size to compress (bytes) */
  threshold?: number;
  /** Compression level (0-9) */
  level?: number;
  /** Content types to compress */
  contentTypes?: RegExp;
  /** Preferred encodings priority */
  encodings?: ('br' | 'gzip' | 'deflate')[];
}

const DEFAULT_CONTENT_TYPES = /^(text\/|application\/(json|javascript|xml|x-yaml))/i;

const compressionPlugin: FastifyPluginAsync<CompressionPluginOptions> = async (fastify, options) => {
  const {
    enabled = true,
    skipPaths = ['/health', '/metrics'],
    threshold = 1024, // 1KB
    level = 6,
    contentTypes = DEFAULT_CONTENT_TYPES,
    encodings = ['br', 'gzip', 'deflate'],
  } = options;

  if (!enabled) return;

  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
    // Skip specified paths
    if (skipPaths.some((p) => request.url.startsWith(p))) return payload;

    // Skip if already encoded
    if (reply.getHeader('content-encoding')) return payload;

    // Skip if no accept-encoding header
    const acceptEncoding = request.headers['accept-encoding'];
    if (!acceptEncoding) return payload;

    // Get content type
    const contentType = reply.getHeader('content-type');
    if (!contentType || !contentTypes.test(String(contentType))) return payload;

    // Convert payload to buffer
    let buffer: Buffer;
    if (Buffer.isBuffer(payload)) {
      buffer = payload;
    } else if (typeof payload === 'string') {
      buffer = Buffer.from(payload);
    } else if (payload) {
      buffer = Buffer.from(JSON.stringify(payload));
    } else {
      return payload;
    }

    // Skip if below threshold
    if (buffer.length < threshold) return payload;

    // Determine encoding
    const acceptEncodingStr = String(acceptEncoding).toLowerCase();
    let selectedEncoding: string | null = null;
    let compressFn: ((buffer: Buffer) => Promise<Buffer>) | null = null;

    for (const encoding of encodings) {
      if (acceptEncodingStr.includes(encoding)) {
        selectedEncoding = encoding;
        if (encoding === 'br') {
          compressFn = (buf) => brotliCompress(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: level } });
        } else if (encoding === 'gzip') {
          compressFn = (buf) => gzipCompress(buf, { level });
        } else if (encoding === 'deflate') {
          compressFn = (buf) => deflateCompress(buf, { level });
        }
        break;
      }
    }

    // Compress if encoding selected
    if (selectedEncoding && compressFn) {
      try {
        const compressed = await compressFn(buffer);
        reply.header('Content-Encoding', selectedEncoding);
        reply.header('Vary', 'Accept-Encoding');
        reply.removeHeader('content-length');
        return compressed;
      } catch (error) {
        // On compression error, return original payload
        fastify.log.warn({ error, url: request.url }, 'Compression failed');
        return payload;
      }
    }

    return payload;
  });
};

export default fp(compressionPlugin, {
  name: 'compression',
  fastify: '5.x',
});

// Production compression configuration
export const ProductionCompressionConfig: CompressionPluginOptions = {
  enabled: true,
  threshold: 1024,
  level: 6,
  encodings: ['br', 'gzip', 'deflate'],
};

// Development compression configuration (faster, less compression)
export const DevelopmentCompressionConfig: CompressionPluginOptions = {
  enabled: true,
  threshold: 2048,
  level: 1,
  encodings: ['gzip', 'deflate'],
};
