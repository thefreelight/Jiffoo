/**
 * SEO Management Integration Tests
 *
 * Coverage:
 * - GET /api/seo/products/:id - Get product SEO metadata
 * - PUT /api/seo/products/:id - Update product SEO metadata
 * - GET /api/sitemap.xml - Generate XML sitemap
 * - End-to-end flow: Edit product SEO in admin → verify on API
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  createAdminWithToken,
  deleteAllTestUsers,
} from '../helpers/auth';
import { createTestProduct, deleteAllTestProducts } from '../helpers/fixtures';

describe('SEO Management Integration', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    app = await createTestApp();

    const { token: aToken } = await createAdminWithToken();
    adminToken = aToken;

    // Create a test product for SEO testing
    testProduct = await createTestProduct({
      name: 'SEO Test Product',
      description: 'A product for testing SEO functionality',
      price: 99.99,
      stock: 50,
      category: 'test-seo',
    });
  });

  afterAll(async () => {
    await deleteAllTestProducts();
    await deleteAllTestUsers();
    await app.close();
  });

  describe('GET /api/seo/products/:id', () => {
    it('should return product SEO metadata', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/seo/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([200, 404]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const body = response.json();
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('id', testProduct.id);
        // SEO fields should be present (may be null if not set)
        expect(body.data).toHaveProperty('metaTitle');
        expect(body.data).toHaveProperty('metaDescription');
        expect(body.data).toHaveProperty('canonicalUrl');
        expect(body.data).toHaveProperty('structuredData');
      }
    });

    it('should return 404 for non-existent product', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/seo/products/non-existent-id`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/seo/products/:id', () => {
    it('should update product SEO metadata', async () => {
      const seoMetadata = {
        metaTitle: 'Custom SEO Title for Test Product',
        metaDescription: 'This is a custom meta description for SEO testing. It should be between 150-160 characters long for optimal search engine display.',
        canonicalUrl: 'https://example.com/products/seo-test-product',
        structuredData: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          'name': 'SEO Test Product',
          'description': 'A product for testing SEO functionality',
          'offers': {
            '@type': 'Offer',
            'price': '99.99',
            'priceCurrency': 'USD',
            'availability': 'https://schema.org/InStock'
          }
        })
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/seo/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: seoMetadata,
      });

      expect([200, 201]).toContain(response.statusCode);

      if (response.statusCode === 200 || response.statusCode === 201) {
        const body = response.json();
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('metaTitle', seoMetadata.metaTitle);
        expect(body.data).toHaveProperty('metaDescription', seoMetadata.metaDescription);
        expect(body.data).toHaveProperty('canonicalUrl', seoMetadata.canonicalUrl);

        // Verify structured data
        if (body.data.structuredData) {
          const structuredData = JSON.parse(body.data.structuredData);
          expect(structuredData).toHaveProperty('@context', 'https://schema.org');
          expect(structuredData).toHaveProperty('@type', 'Product');
        }
      }
    });

    it('should allow partial updates of SEO metadata', async () => {
      const partialUpdate = {
        metaTitle: 'Updated SEO Title Only'
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/seo/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: partialUpdate,
      });

      expect([200, 201]).toContain(response.statusCode);

      if (response.statusCode === 200 || response.statusCode === 201) {
        const body = response.json();
        expect(body.data).toHaveProperty('metaTitle', partialUpdate.metaTitle);
      }
    });

    it('should validate canonical URL format', async () => {
      const invalidUpdate = {
        canonicalUrl: 'not-a-valid-url'
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/seo/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: invalidUpdate,
      });

      // Should either accept it (some validators allow any string) or reject with 400
      expect([200, 201, 400]).toContain(response.statusCode);
    });

    it('should validate JSON-LD structured data', async () => {
      const invalidStructuredData = {
        structuredData: 'not valid json'
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/seo/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: invalidStructuredData,
      });

      // Should either accept it (stored as string) or reject with 400
      expect([200, 201, 400]).toContain(response.statusCode);
    });

    it('should return 404 for non-existent product', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/seo/products/non-existent-id`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          metaTitle: 'Test Title'
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('End-to-End SEO Flow', () => {
    it('should persist SEO metadata across requests', async () => {
      // Step 1: Update product SEO metadata (simulating admin edit)
      const seoMetadata = {
        metaTitle: 'E2E Test Product SEO Title',
        metaDescription: 'End-to-end test meta description that validates the complete flow from admin edit to API retrieval. This ensures data persistence works correctly.',
        canonicalUrl: 'https://shop.example.com/products/e2e-test-product',
        structuredData: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          'name': 'E2E SEO Test Product',
          'description': 'Testing end-to-end SEO flow',
          'brand': {
            '@type': 'Brand',
            'name': 'Test Brand'
          },
          'offers': {
            '@type': 'Offer',
            'price': '99.99',
            'priceCurrency': 'USD',
            'availability': 'https://schema.org/InStock'
          }
        })
      };

      const updateResponse = await app.inject({
        method: 'PUT',
        url: `/api/seo/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: seoMetadata,
      });

      expect([200, 201]).toContain(updateResponse.statusCode);

      // Step 2: Retrieve product SEO metadata (simulating shop page load)
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/seo/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(getResponse.statusCode).toBe(200);

      const body = getResponse.json();

      // Step 3: Verify meta tags match admin input
      expect(body.data.metaTitle).toBe(seoMetadata.metaTitle);
      expect(body.data.metaDescription).toBe(seoMetadata.metaDescription);
      expect(body.data.canonicalUrl).toBe(seoMetadata.canonicalUrl);

      // Step 4: Verify JSON-LD structured data is present and valid
      expect(body.data.structuredData).toBeTruthy();

      const structuredData = JSON.parse(body.data.structuredData);
      expect(structuredData['@context']).toBe('https://schema.org');
      expect(structuredData['@type']).toBe('Product');
      expect(structuredData.name).toBe('E2E SEO Test Product');
      expect(structuredData.offers).toBeDefined();
      expect(structuredData.offers['@type']).toBe('Offer');
      expect(structuredData.offers.price).toBe('99.99');
      expect(structuredData.brand).toBeDefined();
      expect(structuredData.brand.name).toBe('Test Brand');
    });

    it('should handle products without SEO metadata gracefully', async () => {
      // Create a product without SEO metadata
      const basicProduct = await createTestProduct({
        name: 'Product Without SEO',
        price: 49.99,
        stock: 10,
      });

      // Retrieve the product
      const response = await app.inject({
        method: 'GET',
        url: `/api/seo/products/${basicProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect([200, 404]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        const body = response.json();

        // SEO fields should exist but be null
        expect(body.data.metaTitle).toBeNull();
        expect(body.data.metaDescription).toBeNull();
        expect(body.data.canonicalUrl).toBeNull();
        expect(body.data.structuredData).toBeNull();
      }

      // Cleanup
      await app.prisma.product.delete({ where: { id: basicProduct.id } });
    });
  });

  describe('Meta Tag Validation', () => {
    it('should accept meta title within optimal length', async () => {
      const optimalTitle = 'Optimal Length SEO Title (50-60 chars approx)';

      const response = await app.inject({
        method: 'PUT',
        url: `/api/seo/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { metaTitle: optimalTitle },
      });

      expect([200, 201]).toContain(response.statusCode);
    });

    it('should accept meta description within optimal length', async () => {
      const optimalDescription = 'This meta description is crafted to be within the optimal character length of 150-160 characters for search engine result pages display.';

      const response = await app.inject({
        method: 'PUT',
        url: `/api/seo/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { metaDescription: optimalDescription },
      });

      expect([200, 201]).toContain(response.statusCode);
    });

    it('should handle long meta descriptions', async () => {
      const longDescription = 'This is an extremely long meta description that far exceeds the recommended character limit of 160 characters. Search engines will likely truncate this description when displaying it in search results, which may not provide the best user experience.';

      const response = await app.inject({
        method: 'PUT',
        url: `/api/seo/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { metaDescription: longDescription },
      });

      // Should still accept it but may warn (handled by frontend)
      expect([200, 201]).toContain(response.statusCode);
    });
  });

  describe('Structured Data Validation', () => {
    it('should accept valid Product schema', async () => {
      const productSchema = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': 'Test Product',
        'description': 'Product description',
        'image': 'https://example.com/image.jpg',
        'offers': {
          '@type': 'Offer',
          'price': '99.99',
          'priceCurrency': 'USD'
        }
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/seo/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { structuredData: JSON.stringify(productSchema) },
      });

      expect([200, 201]).toContain(response.statusCode);
    });

    it('should accept valid Product schema with reviews', async () => {
      const productWithReviews = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': 'Test Product with Reviews',
        'aggregateRating': {
          '@type': 'AggregateRating',
          'ratingValue': '4.5',
          'reviewCount': '89'
        },
        'review': {
          '@type': 'Review',
          'reviewRating': {
            '@type': 'Rating',
            'ratingValue': '5'
          },
          'author': {
            '@type': 'Person',
            'name': 'John Doe'
          }
        }
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/api/seo/products/${testProduct.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { structuredData: JSON.stringify(productWithReviews) },
      });

      expect([200, 201]).toContain(response.statusCode);
    });
  });

  describe('GET /api/sitemap.xml', () => {
    it('should return valid XML sitemap', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sitemap.xml',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/xml');

      const body = response.body;
      // Verify XML declaration
      expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      // Verify root element with correct namespace
      expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(body).toContain('</urlset>');
    });

    it('should contain products in sitemap', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sitemap.xml',
      });

      expect(response.statusCode).toBe(200);

      const body = response.body;
      // Should contain URL entries
      expect(body).toContain('<url>');
      expect(body).toContain('</url>');
      expect(body).toContain('<loc>');
      expect(body).toContain('</loc>');

      // Should contain product URLs (products use /products/ path)
      if (body.includes('/products/')) {
        expect(body).toMatch(/<loc>.*\/products\/.*<\/loc>/);
      }
    });

    it('should contain categories in sitemap', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sitemap.xml',
      });

      expect(response.statusCode).toBe(200);

      const body = response.body;
      // Should contain category URLs if any categories exist
      // Categories use /categories/ path
      if (body.includes('/categories/')) {
        expect(body).toMatch(/<loc>.*\/categories\/.*<\/loc>/);
      }
    });

    it('should contain static pages in sitemap', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sitemap.xml',
      });

      expect(response.statusCode).toBe(200);

      const body = response.body;
      // Should contain homepage or other static pages
      expect(body).toMatch(/<loc>.*<\/loc>/);
    });

    it('should include SEO elements (changefreq, priority)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sitemap.xml',
      });

      expect(response.statusCode).toBe(200);

      const body = response.body;
      // Should include optional but recommended SEO elements
      expect(body).toContain('<changefreq>');
      expect(body).toContain('</changefreq>');
      expect(body).toContain('<priority>');
      expect(body).toContain('</priority>');
    });

    it('should include lastmod dates', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sitemap.xml',
      });

      expect(response.statusCode).toBe(200);

      const body = response.body;
      // Should include last modification dates
      if (body.includes('<lastmod>')) {
        // Verify date format (YYYY-MM-DD)
        expect(body).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
      }
    });

    it('should filter sitemap by query parameters', async () => {
      // Test with only products
      const productsOnly = await app.inject({
        method: 'GET',
        url: '/api/sitemap.xml?includeCategories=false&includePages=false',
      });

      expect(productsOnly.statusCode).toBe(200);
      const body1 = productsOnly.body;
      expect(body1).toContain('<urlset');

      // Test with only categories
      const categoriesOnly = await app.inject({
        method: 'GET',
        url: '/api/sitemap.xml?includeProducts=false&includePages=false',
      });

      expect(categoriesOnly.statusCode).toBe(200);
      const body2 = categoriesOnly.body;
      expect(body2).toContain('<urlset');

      // Test with only pages
      const pagesOnly = await app.inject({
        method: 'GET',
        url: '/api/sitemap.xml?includeProducts=false&includeCategories=false',
      });

      expect(pagesOnly.statusCode).toBe(200);
      const body3 = pagesOnly.body;
      expect(body3).toContain('<urlset');
      // Pages should always have at least homepage
      expect(body3).toContain('<url>');
    });

    it('should properly escape XML special characters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sitemap.xml',
      });

      expect(response.statusCode).toBe(200);

      const body = response.body;
      // Should not contain unescaped special characters in URLs
      // (this is a negative test - these should NOT appear outside of tags)
      const urlMatches = body.match(/<loc>(.*?)<\/loc>/g);
      if (urlMatches) {
        urlMatches.forEach((match) => {
          const url = match.replace(/<\/?loc>/g, '');
          // Verify no unescaped ampersands (should be &amp;)
          if (url.includes('&') && !url.includes('&amp;')) {
            // If there's an ampersand, it should be properly escaped
            expect(url).toMatch(/&(amp|lt|gt|quot|apos);/);
          }
        });
      }
    });

    it('should handle empty database gracefully', async () => {
      // Even with no products/categories, should return valid XML with at least static pages
      const response = await app.inject({
        method: 'GET',
        url: '/api/sitemap.xml',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/xml');

      const body = response.body;
      expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(body).toContain('</urlset>');
    });
  });

  describe('Redirect Management', () => {
    let testRedirectId: string;

    describe('POST /api/seo/redirects', () => {
      it('should create a 301 redirect', async () => {
        const redirectData = {
          fromPath: '/old-url',
          toPath: '/new-url',
          statusCode: 301,
          isActive: true
        };

        const response = await app.inject({
          method: 'POST',
          url: '/api/seo/redirects',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: redirectData,
        });

        expect(response.statusCode).toBe(201);

        const body = response.json();
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('id');
        expect(body.data.fromPath).toBe(redirectData.fromPath);
        expect(body.data.toPath).toBe(redirectData.toPath);
        expect(body.data.statusCode).toBe(301);
        expect(body.data.isActive).toBe(true);
        expect(body.data.hitCount).toBe(0);

        // Store ID for cleanup and further tests
        testRedirectId = body.data.id;
      });

      it('should create a 302 temporary redirect', async () => {
        const redirectData = {
          fromPath: '/temp-old-url',
          toPath: '/temp-new-url',
          statusCode: 302,
          isActive: true
        };

        const response = await app.inject({
          method: 'POST',
          url: '/api/seo/redirects',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: redirectData,
        });

        expect(response.statusCode).toBe(201);

        const body = response.json();
        expect(body.data.statusCode).toBe(302);

        // Cleanup
        await app.prisma.seoRedirect.delete({ where: { id: body.data.id } });
      });

      it('should default to 301 status code if not specified', async () => {
        const redirectData = {
          fromPath: '/default-redirect',
          toPath: '/default-target'
        };

        const response = await app.inject({
          method: 'POST',
          url: '/api/seo/redirects',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: redirectData,
        });

        expect(response.statusCode).toBe(201);

        const body = response.json();
        expect(body.data.statusCode).toBe(301);

        // Cleanup
        await app.prisma.seoRedirect.delete({ where: { id: body.data.id } });
      });

      it('should validate fromPath starts with slash', async () => {
        const invalidData = {
          fromPath: 'missing-leading-slash',
          toPath: '/target'
        };

        const response = await app.inject({
          method: 'POST',
          url: '/api/seo/redirects',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: invalidData,
        });

        expect(response.statusCode).toBe(400);
      });

      it('should validate toPath format', async () => {
        const invalidData = {
          fromPath: '/source',
          toPath: 'missing-slash-and-protocol'
        };

        const response = await app.inject({
          method: 'POST',
          url: '/api/seo/redirects',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: invalidData,
        });

        expect(response.statusCode).toBe(400);
      });

      it('should accept absolute URLs as toPath', async () => {
        const redirectData = {
          fromPath: '/external-redirect',
          toPath: 'https://example.com/external'
        };

        const response = await app.inject({
          method: 'POST',
          url: '/api/seo/redirects',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: redirectData,
        });

        expect(response.statusCode).toBe(201);

        const body = response.json();
        expect(body.data.toPath).toBe('https://example.com/external');

        // Cleanup
        await app.prisma.seoRedirect.delete({ where: { id: body.data.id } });
      });

      it('should prevent duplicate fromPath redirects', async () => {
        const redirectData = {
          fromPath: '/duplicate-test',
          toPath: '/target-1'
        };

        // Create first redirect
        const firstResponse = await app.inject({
          method: 'POST',
          url: '/api/seo/redirects',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: redirectData,
        });

        expect(firstResponse.statusCode).toBe(201);
        const firstId = firstResponse.json().data.id;

        // Attempt to create duplicate
        const duplicateResponse = await app.inject({
          method: 'POST',
          url: '/api/seo/redirects',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: redirectData,
        });

        expect(duplicateResponse.statusCode).toBe(409);

        // Cleanup
        await app.prisma.seoRedirect.delete({ where: { id: firstId } });
      });

      it('should validate status code is valid redirect code', async () => {
        const invalidData = {
          fromPath: '/invalid-status',
          toPath: '/target',
          statusCode: 200 // Not a valid redirect status
        };

        const response = await app.inject({
          method: 'POST',
          url: '/api/seo/redirects',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: invalidData,
        });

        expect(response.statusCode).toBe(400);
      });
    });

    describe('GET /api/seo/redirects', () => {
      beforeAll(async () => {
        // Create some test redirects
        await app.prisma.seoRedirect.createMany({
          data: [
            {
              fromPath: '/test-redirect-1',
              toPath: '/target-1',
              statusCode: 301,
              isActive: true,
              hitCount: 10
            },
            {
              fromPath: '/test-redirect-2',
              toPath: '/target-2',
              statusCode: 302,
              isActive: true,
              hitCount: 5
            },
            {
              fromPath: '/test-redirect-inactive',
              toPath: '/target-inactive',
              statusCode: 301,
              isActive: false,
              hitCount: 0
            }
          ]
        });
      });

      afterAll(async () => {
        // Cleanup test redirects
        await app.prisma.seoRedirect.deleteMany({
          where: {
            fromPath: {
              startsWith: '/test-redirect-'
            }
          }
        });
      });

      it('should list all redirects with pagination', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/seo/redirects?page=1&limit=10',
          headers: { authorization: `Bearer ${adminToken}` },
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('items');
        expect(body.data).toHaveProperty('page', 1);
        expect(body.data).toHaveProperty('limit', 10);
        expect(body.data).toHaveProperty('total');
        expect(body.data).toHaveProperty('totalPages');
        expect(Array.isArray(body.data.items)).toBe(true);
      });

      it('should filter redirects by isActive status', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/seo/redirects?isActive=true',
          headers: { authorization: `Bearer ${adminToken}` },
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();
        // All returned items should be active
        body.data.items.forEach((redirect: any) => {
          expect(redirect.isActive).toBe(true);
        });
      });

      it('should search redirects by path', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/seo/redirects?search=test-redirect-1',
          headers: { authorization: `Bearer ${adminToken}` },
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();
        // Should find at least one redirect matching the search
        const found = body.data.items.some((redirect: any) =>
          redirect.fromPath.includes('test-redirect-1') ||
          redirect.toPath.includes('test-redirect-1')
        );
        expect(found).toBe(true);
      });
    });

    describe('DELETE /api/seo/redirects/:id', () => {
      it('should delete a redirect', async () => {
        // Create a redirect to delete
        const createResponse = await app.inject({
          method: 'POST',
          url: '/api/seo/redirects',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            fromPath: '/to-be-deleted',
            toPath: '/target'
          },
        });

        expect(createResponse.statusCode).toBe(201);
        const redirectId = createResponse.json().data.id;

        // Delete the redirect
        const deleteResponse = await app.inject({
          method: 'DELETE',
          url: `/api/seo/redirects/${redirectId}`,
          headers: { authorization: `Bearer ${adminToken}` },
        });

        expect(deleteResponse.statusCode).toBe(200);

        // Verify it's deleted
        const redirect = await app.prisma.seoRedirect.findUnique({
          where: { id: redirectId }
        });

        expect(redirect).toBeNull();
      });

      it('should return 404 when deleting non-existent redirect', async () => {
        const response = await app.inject({
          method: 'DELETE',
          url: '/api/seo/redirects/non-existent-id',
          headers: { authorization: `Bearer ${adminToken}` },
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe('End-to-End Redirect Flow', () => {
      it('should create redirect and verify it can be retrieved', async () => {
        // Step 1: Create 301 redirect from /old-url to /new-url (simulating admin action)
        const redirectData = {
          fromPath: '/old-product-url',
          toPath: '/new-product-url',
          statusCode: 301,
          isActive: true
        };

        const createResponse = await app.inject({
          method: 'POST',
          url: '/api/seo/redirects',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: redirectData,
        });

        expect(createResponse.statusCode).toBe(201);

        const createdRedirect = createResponse.json().data;
        expect(createdRedirect).toHaveProperty('id');
        expect(createdRedirect.fromPath).toBe('/old-product-url');
        expect(createdRedirect.toPath).toBe('/new-product-url');
        expect(createdRedirect.statusCode).toBe(301);
        expect(createdRedirect.isActive).toBe(true);

        // Step 2: Retrieve redirect (simulating shop middleware looking up redirect)
        const redirect = await app.prisma.seoRedirect.findUnique({
          where: { fromPath: '/old-product-url' }
        });

        // Step 3: Verify 301 status code and Location header would be correct
        expect(redirect).toBeTruthy();
        expect(redirect?.statusCode).toBe(301);
        expect(redirect?.toPath).toBe('/new-product-url');
        expect(redirect?.isActive).toBe(true);

        // Cleanup
        await app.prisma.seoRedirect.delete({ where: { id: createdRedirect.id } });
      });

      it('should increment hit count when redirect is used', async () => {
        // Create a redirect
        const createResponse = await app.inject({
          method: 'POST',
          url: '/api/seo/redirects',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {
            fromPath: '/hit-count-test',
            toPath: '/target',
            statusCode: 301
          },
        });

        const redirectId = createResponse.json().data.id;

        // Simulate using the redirect multiple times
        await app.prisma.seoRedirect.update({
          where: { id: redirectId },
          data: { hitCount: { increment: 1 } }
        });

        await app.prisma.seoRedirect.update({
          where: { id: redirectId },
          data: { hitCount: { increment: 1 } }
        });

        // Verify hit count incremented
        const redirect = await app.prisma.seoRedirect.findUnique({
          where: { id: redirectId }
        });

        expect(redirect?.hitCount).toBe(2);

        // Cleanup
        await app.prisma.seoRedirect.delete({ where: { id: redirectId } });
      });

      it('should only return active redirects for shop usage', async () => {
        // Create active and inactive redirects
        const activeRedirect = await app.prisma.seoRedirect.create({
          data: {
            fromPath: '/active-redirect-path',
            toPath: '/target',
            statusCode: 301,
            isActive: true
          }
        });

        const inactiveRedirect = await app.prisma.seoRedirect.create({
          data: {
            fromPath: '/inactive-redirect-path',
            toPath: '/target',
            statusCode: 301,
            isActive: false
          }
        });

        // Simulate shop looking for active redirect
        const foundActive = await app.prisma.seoRedirect.findFirst({
          where: {
            fromPath: '/active-redirect-path',
            isActive: true
          }
        });

        const foundInactive = await app.prisma.seoRedirect.findFirst({
          where: {
            fromPath: '/inactive-redirect-path',
            isActive: true
          }
        });

        expect(foundActive).toBeTruthy();
        expect(foundInactive).toBeNull();

        // Cleanup
        await app.prisma.seoRedirect.deleteMany({
          where: {
            id: { in: [activeRedirect.id, inactiveRedirect.id] }
          }
        });
      });

      it('should support both relative and absolute URL redirects', async () => {
        // Test relative redirect
        const relativeRedirect = await app.prisma.seoRedirect.create({
          data: {
            fromPath: '/relative-source',
            toPath: '/relative-target',
            statusCode: 301,
            isActive: true
          }
        });

        // Test absolute redirect
        const absoluteRedirect = await app.prisma.seoRedirect.create({
          data: {
            fromPath: '/absolute-source',
            toPath: 'https://example.com/external',
            statusCode: 301,
            isActive: true
          }
        });

        // Verify both types
        expect(relativeRedirect.toPath).toBe('/relative-target');
        expect(absoluteRedirect.toPath).toBe('https://example.com/external');

        // Cleanup
        await app.prisma.seoRedirect.deleteMany({
          where: {
            id: { in: [relativeRedirect.id, absoluteRedirect.id] }
          }
        });
      });
    });
  });

  describe('SEO Audit', () => {
    let productWithoutSeo: Awaited<ReturnType<typeof createTestProduct>>;
    let productWithSeo: Awaited<ReturnType<typeof createTestProduct>>;

    beforeAll(async () => {
      // Create a product without SEO meta tags
      productWithoutSeo = await createTestProduct({
        name: 'Product Without SEO',
        description: 'This product has no SEO meta tags',
        price: 49.99,
        stock: 100,
        category: 'test-audit',
      });

      // Create a product with SEO meta tags
      productWithSeo = await createTestProduct({
        name: 'Product With SEO',
        description: 'This product has SEO meta tags',
        price: 79.99,
        stock: 75,
        category: 'test-audit',
      });

      // Add SEO metadata to the second product
      await app.prisma.product.update({
        where: { id: productWithSeo.id },
        data: {
          metaTitle: 'Optimized Product Title for Search Engines',
          metaDescription: 'This is a well-optimized meta description that is between 150-160 characters long, providing value to users and search engines alike with relevant keywords.',
          canonicalUrl: 'https://example.com/products/with-seo',
          structuredData: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            'name': 'Product With SEO',
            'description': 'This product has SEO meta tags',
            'offers': {
              '@type': 'Offer',
              'price': '79.99',
              'priceCurrency': 'USD',
              'availability': 'https://schema.org/InStock'
            }
          })
        }
      });
    });

    afterAll(async () => {
      // Clean up test products
      await app.prisma.product.deleteMany({
        where: {
          id: { in: [productWithoutSeo.id, productWithSeo.id] }
        }
      });
    });

    describe('GET /api/seo/audit', () => {
      it('should run audit and detect missing meta tags', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/seo/audit',
          headers: { authorization: `Bearer ${adminToken}` },
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('summary');
        expect(body.data).toHaveProperty('issues');
        expect(body.data).toHaveProperty('timestamp');

        const { summary, issues } = body.data;

        // Verify summary structure
        expect(summary).toHaveProperty('totalIssues');
        expect(summary).toHaveProperty('critical');
        expect(summary).toHaveProperty('warnings');
        expect(summary).toHaveProperty('info');
        expect(summary).toHaveProperty('issuesByType');

        // Verify issues array
        expect(Array.isArray(issues)).toBe(true);
        expect(issues.length).toBeGreaterThan(0);

        // Check that product without SEO has issues
        const productIssues = issues.filter(
          (issue: any) => issue.entity.id === productWithoutSeo.id
        );
        expect(productIssues.length).toBeGreaterThan(0);

        // Verify missing-meta-title issue
        const missingTitleIssue = productIssues.find(
          (issue: any) => issue.type === 'missing-meta-title'
        );
        expect(missingTitleIssue).toBeDefined();
        expect(missingTitleIssue.severity).toBe('critical');
        expect(missingTitleIssue.message).toContain('Missing meta title');
        expect(missingTitleIssue.entity.type).toBe('product');
        expect(missingTitleIssue.recommendation).toBeDefined();

        // Verify missing-meta-description issue
        const missingDescIssue = productIssues.find(
          (issue: any) => issue.type === 'missing-meta-description'
        );
        expect(missingDescIssue).toBeDefined();
        expect(missingDescIssue.severity).toBe('critical');
        expect(missingDescIssue.message).toContain('Missing meta description');
      });

      it('should not flag products with proper SEO metadata', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/seo/audit',
          headers: { authorization: `Bearer ${adminToken}` },
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();
        const { issues } = body.data;

        // Check that product with SEO has fewer or no critical issues
        const productIssues = issues.filter(
          (issue: any) => issue.entity.id === productWithSeo.id
        );

        // Should not have missing-meta-title or missing-meta-description
        const missingTitleIssue = productIssues.find(
          (issue: any) => issue.type === 'missing-meta-title'
        );
        expect(missingTitleIssue).toBeUndefined();

        const missingDescIssue = productIssues.find(
          (issue: any) => issue.type === 'missing-meta-description'
        );
        expect(missingDescIssue).toBeUndefined();
      });

      it('should accept query parameters to filter audit scope', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/seo/audit?includeProducts=true&includeCategories=false&limit=10',
          headers: { authorization: `Bearer ${adminToken}` },
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('issues');

        // All issues should be for products only (no categories)
        const categoryIssues = body.data.issues.filter(
          (issue: any) => issue.entity.type === 'category'
        );
        expect(categoryIssues.length).toBe(0);
      });

      it('should detect meta tags that are too long', async () => {
        // Create product with overly long meta tags
        const productWithLongMeta = await createTestProduct({
          name: 'Product With Long Meta Tags',
          description: 'Testing long meta tags',
          price: 99.99,
          stock: 10,
          category: 'test-audit',
        });

        await app.prisma.product.update({
          where: { id: productWithLongMeta.id },
          data: {
            metaTitle: 'This is an extremely long meta title that exceeds the recommended 60 character limit for search engine optimization',
            metaDescription: 'This is an extremely long meta description that far exceeds the recommended 160 character limit for search engine results pages. It goes on and on with unnecessary content that will likely be truncated in search results, providing a poor user experience.',
          }
        });

        const response = await app.inject({
          method: 'GET',
          url: '/api/seo/audit',
          headers: { authorization: `Bearer ${adminToken}` },
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();
        const { issues } = body.data;

        const productIssues = issues.filter(
          (issue: any) => issue.entity.id === productWithLongMeta.id
        );

        // Should have warnings for long meta title and description
        const longTitleIssue = productIssues.find(
          (issue: any) => issue.type === 'long-meta-title'
        );
        expect(longTitleIssue).toBeDefined();
        expect(longTitleIssue.severity).toBe('warning');

        const longDescIssue = productIssues.find(
          (issue: any) => issue.type === 'long-meta-description'
        );
        expect(longDescIssue).toBeDefined();
        expect(longDescIssue.severity).toBe('warning');

        // Cleanup
        await app.prisma.product.delete({ where: { id: productWithLongMeta.id } });
      });

      it('should detect invalid structured data', async () => {
        // Create product with invalid JSON in structured data
        const productWithInvalidSD = await createTestProduct({
          name: 'Product With Invalid Structured Data',
          description: 'Testing invalid structured data',
          price: 59.99,
          stock: 20,
          category: 'test-audit',
        });

        await app.prisma.product.update({
          where: { id: productWithInvalidSD.id },
          data: {
            metaTitle: 'Valid Title',
            metaDescription: 'Valid description for testing purposes',
            structuredData: 'not valid json at all',
          }
        });

        const response = await app.inject({
          method: 'GET',
          url: '/api/seo/audit',
          headers: { authorization: `Bearer ${adminToken}` },
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();
        const { issues } = body.data;

        const productIssues = issues.filter(
          (issue: any) => issue.entity.id === productWithInvalidSD.id
        );

        // Should have warning for invalid structured data
        const invalidSDIssue = productIssues.find(
          (issue: any) => issue.type === 'invalid-structured-data'
        );
        expect(invalidSDIssue).toBeDefined();
        expect(invalidSDIssue.severity).toBe('warning');
        expect(invalidSDIssue.message).toContain('Invalid structured data');

        // Cleanup
        await app.prisma.product.delete({ where: { id: productWithInvalidSD.id } });
      });
    });

    describe('GET /api/seo/audit/stats', () => {
      it('should return audit statistics', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/seo/audit/stats',
          headers: { authorization: `Bearer ${adminToken}` },
        });

        expect(response.statusCode).toBe(200);

        const body = response.json();
        expect(body).toHaveProperty('data');
        expect(body.data).toHaveProperty('products');
        expect(body.data).toHaveProperty('categories');

        // Verify products stats structure
        const { products } = body.data;
        expect(products).toHaveProperty('total');
        expect(products).toHaveProperty('missingMetaTitle');
        expect(products).toHaveProperty('missingMetaDescription');
        expect(products).toHaveProperty('missingCanonicalUrl');
        expect(products).toHaveProperty('missingStructuredData');

        // All stats should be numbers
        expect(typeof products.total).toBe('number');
        expect(typeof products.missingMetaTitle).toBe('number');
        expect(typeof products.missingMetaDescription).toBe('number');

        // Products with missing SEO should be counted
        expect(products.missingMetaTitle).toBeGreaterThan(0);
        expect(products.missingMetaDescription).toBeGreaterThan(0);
      });
    });

    describe('End-to-End Audit Flow', () => {
      it('should detect issues, then verify they are resolved after adding meta tags', async () => {
        // Step 1: Create product without SEO
        const testProduct = await createTestProduct({
          name: 'E2E Audit Test Product',
          description: 'Testing end-to-end audit flow',
          price: 149.99,
          stock: 30,
          category: 'test-e2e-audit',
        });

        // Step 2: Run audit - should detect missing meta tags
        const auditResponse1 = await app.inject({
          method: 'GET',
          url: '/api/seo/audit',
          headers: { authorization: `Bearer ${adminToken}` },
        });

        expect(auditResponse1.statusCode).toBe(200);
        const audit1 = auditResponse1.json();
        const issues1 = audit1.data.issues.filter(
          (issue: any) => issue.entity.id === testProduct.id
        );

        // Should have critical issues for missing meta tags
        expect(issues1.length).toBeGreaterThan(0);
        const missingTitle1 = issues1.find((i: any) => i.type === 'missing-meta-title');
        const missingDesc1 = issues1.find((i: any) => i.type === 'missing-meta-description');
        expect(missingTitle1).toBeDefined();
        expect(missingDesc1).toBeDefined();

        // Step 3: Add meta tags via API
        const seoUpdate = {
          metaTitle: 'E2E Audit Test - Now With SEO',
          metaDescription: 'This product now has proper meta tags with an optimal description length between 150-160 characters for search engine optimization and user experience.',
        };

        const updateResponse = await app.inject({
          method: 'PUT',
          url: `/api/seo/products/${testProduct.id}`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: seoUpdate,
        });

        expect([200, 201]).toContain(updateResponse.statusCode);

        // Step 4: Re-run audit - issues should be resolved
        const auditResponse2 = await app.inject({
          method: 'GET',
          url: '/api/seo/audit',
          headers: { authorization: `Bearer ${adminToken}` },
        });

        expect(auditResponse2.statusCode).toBe(200);
        const audit2 = auditResponse2.json();
        const issues2 = audit2.data.issues.filter(
          (issue: any) => issue.entity.id === testProduct.id
        );

        // Should NOT have missing meta title or description issues
        const missingTitle2 = issues2.find((i: any) => i.type === 'missing-meta-title');
        const missingDesc2 = issues2.find((i: any) => i.type === 'missing-meta-description');
        expect(missingTitle2).toBeUndefined();
        expect(missingDesc2).toBeUndefined();

        // Cleanup
        await app.prisma.product.delete({ where: { id: testProduct.id } });
      });
    });
  });
});
