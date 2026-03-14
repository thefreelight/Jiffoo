/**
 * CompanyUser Routes (B2B)
 */

import { FastifyInstance } from 'fastify';
import { CompanyUserService } from './service';
import { authMiddleware } from '@/core/auth/middleware';
import { sendSuccess, sendError } from '@/utils/response';

export async function companyUserRoutes(fastify: FastifyInstance) {
  // Apply auth middleware to all company user routes (before schema validation)
  fastify.addHook('onRequest', authMiddleware);

  // Get all users in a company
  fastify.get('/:companyId/users', {
    schema: {
      tags: ['b2b-company-users'],
      summary: 'Get company users',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['companyId'],
        properties: {
          companyId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          role: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { companyId } = request.params as any;
      const { page, limit, role } = request.query as any;
      const result = await CompanyUserService.getCompanyUsers(companyId, page, limit, role);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Add user to company
  fastify.post('/:companyId/users', {
    schema: {
      tags: ['b2b-company-users'],
      summary: 'Add user to company',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['companyId'],
        properties: {
          companyId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' },
          role: { type: 'string', enum: ['ADMIN', 'BUYER', 'APPROVER', 'VIEWER'] },
          permissions: { type: 'string' },
          approvalLimit: { type: 'number' },
          isActive: { type: 'boolean' },
          invitedBy: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { companyId } = request.params as any;
      const body = request.body as any;
      const companyUser = await CompanyUserService.addUserToCompany({
        ...body,
        companyId
      });
      return sendSuccess(reply, companyUser, undefined, 201);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Get company user by ID
  fastify.get('/:companyId/users/:id', {
    schema: {
      tags: ['b2b-company-users'],
      summary: 'Get company user by ID',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['companyId', 'id'],
        properties: {
          companyId: { type: 'string' },
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const companyUser = await CompanyUserService.getCompanyUserById(id);
      if (!companyUser) {
        return sendError(reply, 404, 'NOT_FOUND', 'Company user not found');
      }
      return sendSuccess(reply, companyUser);
    } catch (error: any) {
      return sendError(reply, 500, 'INTERNAL_SERVER_ERROR', error.message);
    }
  });

  // Update company user
  fastify.put('/:companyId/users/:id', {
    schema: {
      tags: ['b2b-company-users'],
      summary: 'Update company user',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['companyId', 'id'],
        properties: {
          companyId: { type: 'string' },
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['ADMIN', 'BUYER', 'APPROVER', 'VIEWER'] },
          permissions: { type: 'string' },
          approvalLimit: { type: 'number' },
          isActive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const body = request.body as any;
      const companyUser = await CompanyUserService.updateCompanyUser(id, body);
      return sendSuccess(reply, companyUser);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Update company user role (simplified)
  fastify.put('/:companyId/users/:id/role', {
    schema: {
      tags: ['b2b-company-users'],
      summary: 'Update company user role',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['companyId', 'id'],
        properties: {
          companyId: { type: 'string' },
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['ADMIN', 'BUYER', 'APPROVER', 'VIEWER'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const { role } = request.body as any;
      const companyUser = await CompanyUserService.updateCompanyUserRole(id, { role });
      return sendSuccess(reply, companyUser);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });

  // Remove user from company
  fastify.delete('/:companyId/users/:id', {
    schema: {
      tags: ['b2b-company-users'],
      summary: 'Remove user from company',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['companyId', 'id'],
        properties: {
          companyId: { type: 'string' },
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as any;
      const result = await CompanyUserService.removeUserFromCompany(id);
      return sendSuccess(reply, result);
    } catch (error: any) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
  });
}
