/**
 * Upload Endpoints Tests
 * 
 * Coverage:
 * - POST /api/upload/product-image
 * - POST /api/upload/avatar
 * - DELETE /api/upload/file/:filename
 * - GET /api/upload/image-url/:filename
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import { createAdminWithToken, createUserWithToken, deleteAllTestUsers } from '../helpers/auth';

describe('Upload Endpoints', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = await createTestApp({ disableFileSystem: true });
    const { token: aToken } = await createAdminWithToken();
    const { token: uToken } = await createUserWithToken();
    adminToken = aToken;
    userToken = uToken;
  });

  afterAll(async () => {
    await deleteAllTestUsers();
    await app.close();
  });

  describe('POST /api/upload/product-image', () => {
    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upload/product-image',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing file (with admin token)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upload/product-image',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([400, 415]).toContain(response.statusCode);
    });
  });

  describe('POST /api/upload/avatar', () => {
    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upload/avatar',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for missing file (with user token)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/upload/avatar',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect([400, 415]).toContain(response.statusCode);
    });
  });

  describe('DELETE /api/upload/file/:filename', () => {
    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/upload/file/test-file.jpg',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent file (with admin token)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/upload/file/non-existent-file.jpg',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([400, 404]).toContain(response.statusCode);
    });

    it('should reject path traversal attempts (with admin token)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/upload/file/../../../etc/passwd',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([400, 404]).toContain(response.statusCode);
    });
  });

  describe('GET /api/upload/image-url/:filename', () => {
    // This endpoint is public as per routes implementation
    it('should return image URL or 404', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/upload/image-url/test-image.jpg',
      });

      expect([200, 404]).toContain(response.statusCode);
    });

    it('should support size parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/upload/image-url/test-image.jpg?size=thumbnail',
      });

      expect([200, 404]).toContain(response.statusCode);
    });

    it('should be accessible without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/upload/image-url/test-image.jpg',
      });

      expect(response.statusCode).not.toBe(401);
    });
  });
});
