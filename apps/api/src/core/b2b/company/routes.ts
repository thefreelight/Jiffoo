/**
 * Company Routes (B2B)
 */

import { FastifyInstance } from 'fastify';
import { CompanyService } from './service';
import { authMiddleware } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';

export async function companyRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all company routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);

  // Create company
  fastify.post('/', {
    schema: {
      tags: ['b2b-companies'],
      summary: 'Create company',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          taxId: { type: 'string' },
          website: { type: 'string' },
          description: { type: 'string' },
          industry: { type: 'string' },
          employeeCount: { type: 'string' },
          annualRevenue: { type: 'string' },
          isActive: { type: 'boolean' },
          accountStatus: { type: 'string', enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED'] },
          accountType: { type: 'string', enum: ['STANDARD', 'PREMIUM', 'ENTERPRISE'] },
          paymentTerms: { type: 'string', enum: ['IMMEDIATE', 'NET15', 'NET30', 'NET60', 'NET90'] },
          creditLimit: { type: 'number', minimum: 0 },
          taxExempt: { type: 'boolean' },
          taxExemptionId: { type: 'string' },
          customerGroupId: { type: 'string' },
          discountPercent: { type: 'number', minimum: 0, maximum: 100 },
          billingAddress1: { type: 'string' },
          billingAddress2: { type: 'string' },
          billingCity: { type: 'string' },
          billingState: { type: 'string' },
          billingCountry: { type: 'string' },
          billingPostalCode: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const company = await CompanyService.createCompany(request.body as any);
      return sendSuccess(reply, company, undefined, 201);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Get all companies
  fastify.get('/', {
    schema: {
      tags: ['b2b-companies'],
      summary: 'Get all companies',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          search: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page, limit, search } = request.query as any;
      const result = await CompanyService.getAllCompanies(page, limit, search);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Get company by ID
  fastify.get('/:id', {
    schema: {
      tags: ['b2b-companies'],
      summary: 'Get company by ID',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const company = await CompanyService.getCompanyById(id);
      if (!company) {
        return sendError(reply, 404, 'NOT_FOUND', 'Company not found');
      }
      return sendSuccess(reply, company);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Update company
  fastify.put('/:id', {
    schema: {
      tags: ['b2b-companies'],
      summary: 'Update company',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          taxId: { type: 'string' },
          website: { type: 'string' },
          description: { type: 'string' },
          industry: { type: 'string' },
          employeeCount: { type: 'string' },
          annualRevenue: { type: 'string' },
          isActive: { type: 'boolean' },
          accountStatus: { type: 'string', enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED'] },
          accountType: { type: 'string', enum: ['STANDARD', 'PREMIUM', 'ENTERPRISE'] },
          paymentTerms: { type: 'string', enum: ['IMMEDIATE', 'NET15', 'NET30', 'NET60', 'NET90'] },
          creditLimit: { type: 'number', minimum: 0 },
          taxExempt: { type: 'boolean' },
          taxExemptionId: { type: 'string' },
          customerGroupId: { type: 'string' },
          discountPercent: { type: 'number', minimum: 0, maximum: 100 },
          billingAddress1: { type: 'string' },
          billingAddress2: { type: 'string' },
          billingCity: { type: 'string' },
          billingState: { type: 'string' },
          billingCountry: { type: 'string' },
          billingPostalCode: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const company = await CompanyService.updateCompany(id, request.body as any);
      return sendSuccess(reply, company);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Update company status
  fastify.put('/:id/status', {
    schema: {
      tags: ['b2b-companies'],
      summary: 'Update company status',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['accountStatus'],
        properties: {
          accountStatus: { type: 'string', enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const company = await CompanyService.updateCompanyStatus(id, request.body as any);
      return sendSuccess(reply, company);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Delete company
  fastify.delete('/:id', {
    schema: {
      tags: ['b2b-companies'],
      summary: 'Delete company',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const result = await CompanyService.deleteCompany(id);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });
}
