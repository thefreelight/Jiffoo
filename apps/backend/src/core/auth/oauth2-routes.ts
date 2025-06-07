/**
 * OAuth 2.0 Routes for Jiffoo Mall
 * Handles third-party login plugins and SaaS app authentication
 */

import { FastifyInstance } from 'fastify';
import { OAuth2Service } from './oauth2-service';
import { AuthPluginRegistry } from '../../plugins/auth-providers/base-auth-plugin';

export async function oauth2Routes(fastify: FastifyInstance) {
  // Get available authentication providers (plugins)
  fastify.get('/auth/providers', async (request, reply) => {
    try {
      const providers = AuthPluginRegistry.getLicensed().map(plugin => {
        const info = plugin.getPluginInfo();
        return {
          id: info.id,
          name: info.name,
          version: info.version,
          isConfigured: plugin.isConfigured(),
          isLicensed: info.isLicensed,
        };
      });

      return {
        success: true,
        data: providers,
      };
    } catch (error) {
      fastify.log.error('Failed to get auth providers:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get authentication providers',
      });
    }
  });

  // Initiate OAuth 2.0 authorization flow for third-party login
  fastify.get('/auth/:provider/authorize', async (request, reply) => {
    try {
      const { provider } = request.params as { provider: string };
      const { redirect_uri, state } = request.query as { redirect_uri?: string; state?: string };

      const plugin = AuthPluginRegistry.get(provider);
      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: `Authentication provider '${provider}' not found`,
        });
      }

      if (!plugin.getPluginInfo().isLicensed) {
        return reply.status(403).send({
          success: false,
          error: `Authentication provider '${provider}' requires a valid license`,
          purchaseUrl: `/plugins/${provider}`,
        });
      }

      if (!plugin.isConfigured()) {
        return reply.status(400).send({
          success: false,
          error: `Authentication provider '${provider}' is not properly configured`,
        });
      }

      const authUrl = plugin.generateAuthUrl(state || 'default');

      return {
        success: true,
        data: {
          authUrl,
          provider,
          state,
        },
      };
    } catch (error) {
      fastify.log.error('OAuth authorization failed:', error);
      return reply.status(500).send({
        success: false,
        error: (error as any)?.message || 'Authorization failed',
      });
    }
  });

  // Handle OAuth 2.0 callback from third-party providers
  fastify.get('/auth/:provider/callback', async (request, reply) => {
    try {
      const { provider } = request.params as { provider: string };
      const { code, state, error } = request.query as {
        code?: string;
        state?: string;
        error?: string;
      };

      if (error) {
        return reply.status(400).send({
          success: false,
          error: `OAuth error: ${error}`,
        });
      }

      if (!code) {
        return reply.status(400).send({
          success: false,
          error: 'Authorization code is required',
        });
      }

      const result = await OAuth2Service.handleProviderCallback(provider, code, state || 'default');

      // Set authentication cookie
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      };

      (reply as any).setCookie('auth_token', result.token, cookieOptions);

      return {
        success: true,
        data: {
          user: result.user,
          token: result.token,
          provider,
        },
      };
    } catch (error) {
      fastify.log.error('OAuth callback failed:', error);
      return reply.status(500).send({
        success: false,
        error: (error as any)?.message || 'Authentication failed',
      });
    }
  });

  // OAuth 2.0 token endpoint (for SaaS apps)
  fastify.post('/oauth2/token', async (request, reply) => {
    try {
      const {
        grant_type,
        code,
        client_id,
        client_secret,
        redirect_uri,
        refresh_token
      } = request.body as any;

      if (grant_type === 'authorization_code') {
        // Authorization code flow
        if (!code || !client_id) {
          return reply.status(400).send({
            error: 'invalid_request',
            error_description: 'Missing required parameters',
          });
        }

        const result = await OAuth2Service.handleAuthorizationCode(code, '', client_id);

        return {
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
          token_type: result.tokenType,
          expires_in: result.expiresIn,
          scope: result.scope.join(' '),
        };
      } else if (grant_type === 'refresh_token') {
        // Refresh token flow
        if (!refresh_token) {
          return reply.status(400).send({
            error: 'invalid_request',
            error_description: 'Missing refresh token',
          });
        }

        const result = await OAuth2Service.refreshAccessToken(refresh_token);

        return {
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
          token_type: result.tokenType,
          expires_in: result.expiresIn,
          scope: result.scope.join(' '),
        };
      } else {
        return reply.status(400).send({
          error: 'unsupported_grant_type',
          error_description: 'Grant type not supported',
        });
      }
    } catch (error) {
      fastify.log.error('OAuth token exchange failed:', error);
      return reply.status(500).send({
        error: 'server_error',
        error_description: 'Token exchange failed',
      });
    }
  });

  // Revoke OAuth 2.0 token
  fastify.post('/oauth2/revoke', async (request, reply) => {
    try {
      const { token } = request.body as { token: string };

      if (!token) {
        return reply.status(400).send({
          error: 'invalid_request',
          error_description: 'Token is required',
        });
      }

      await OAuth2Service.revokeToken(token);

      return reply.status(200).send({
        success: true,
        message: 'Token revoked successfully',
      });
    } catch (error) {
      fastify.log.error('Token revocation failed:', error);
      return reply.status(500).send({
        error: 'server_error',
        error_description: 'Token revocation failed',
      });
    }
  });

  // Get OAuth 2.0 authorization info (for debugging)
  fastify.get('/oauth2/authorize', async (request, reply) => {
    try {
      const {
        response_type,
        client_id,
        redirect_uri,
        scope,
        state
      } = request.query as any;

      if (response_type !== 'code') {
        return reply.status(400).send({
          error: 'unsupported_response_type',
          error_description: 'Only authorization code flow is supported',
        });
      }

      if (!client_id || !redirect_uri) {
        return reply.status(400).send({
          error: 'invalid_request',
          error_description: 'Missing required parameters',
        });
      }

      // This would typically show an authorization page
      // For now, return the authorization parameters
      return {
        success: true,
        data: {
          response_type,
          client_id,
          redirect_uri,
          scope: scope ? scope.split(' ') : [],
          state,
          authorization_url: `/oauth2/authorize?${new URLSearchParams(request.query as any).toString()}`,
        },
      };
    } catch (error) {
      fastify.log.error('OAuth authorization failed:', error);
      return reply.status(500).send({
        error: 'server_error',
        error_description: 'Authorization failed',
      });
    }
  });

  // Get provider configuration
  fastify.get('/auth/:provider/config', async (request, reply) => {
    try {
      const { provider } = request.params as { provider: string };

      const plugin = AuthPluginRegistry.get(provider);
      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: `Authentication provider '${provider}' not found`,
        });
      }

      // Return current configuration (without secrets for security)
      return {
        success: true,
        data: {
          clientId: process.env[`${provider.toUpperCase()}_CLIENT_ID`] || '',
          redirectUri: process.env[`${provider.toUpperCase()}_REDIRECT_URI`] || `${process.env.FRONTEND_URL || 'http://localhost:3003'}/auth/${provider}/callback`,
          enabled: plugin.isConfigured(),
        },
      };
    } catch (error) {
      fastify.log.error('Failed to get provider config:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get provider configuration',
      });
    }
  });

  // Update provider configuration
  fastify.put('/auth/:provider/config', async (request, reply) => {
    try {
      const { provider } = request.params as { provider: string };
      const { clientId, clientSecret, redirectUri, enabled } = request.body as any;

      const plugin = AuthPluginRegistry.get(provider);
      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: `Authentication provider '${provider}' not found`,
        });
      }

      // In a real implementation, you would save these to a secure configuration store
      // For demo purposes, we'll just validate and return success
      if (!clientId || !clientSecret) {
        return reply.status(400).send({
          success: false,
          error: 'Client ID and Client Secret are required',
        });
      }

      // Update environment variables (in production, use a secure config store)
      process.env[`${provider.toUpperCase()}_CLIENT_ID`] = clientId;
      process.env[`${provider.toUpperCase()}_CLIENT_SECRET`] = clientSecret;
      process.env[`${provider.toUpperCase()}_REDIRECT_URI`] = redirectUri;

      return {
        success: true,
        message: 'Configuration updated successfully',
      };
    } catch (error) {
      fastify.log.error('Failed to update provider config:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update provider configuration',
      });
    }
  });

  // Disconnect social account
  fastify.delete('/auth/:provider/disconnect', async (request, reply) => {
    try {
      const { provider } = request.params as { provider: string };
      const userId = 'demo-user'; // Mock user ID for demo

      // This would be implemented to remove social account connection
      // For now, return success
      return {
        success: true,
        message: `${provider} account disconnected successfully`,
      };
    } catch (error) {
      fastify.log.error('Account disconnection failed:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to disconnect account',
      });
    }
  });
}
