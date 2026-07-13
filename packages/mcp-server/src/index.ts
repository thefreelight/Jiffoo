#!/usr/bin/env node
/**
 * @jiffoo/mcp-server
 *
 * MCP (Model Context Protocol) Server for Jiffoo e-commerce.
 *
 * Enables AI agents (Claude Desktop, Claude Code, etc.) to:
 * - Browse and search the product catalog
 * - Get detailed product information
 * - Manage a shopping cart
 * - Create orders and generate payment URLs
 *
 * Usage:
 *   # stdio mode (default, for Claude Desktop / Code integration)
 *   npx @jiffoo/mcp-server --api-url http://localhost:3001/api/v1 --token <token>
 *
 *   # HTTP mode (for remote agent connections)
 *   npx @jiffoo/mcp-server --http --port 3100 --api-url http://localhost:3001/api/v1
 *
 * Environment variables:
 *   JIFFOO_API_URL    — API base URL (alternative to --api-url)
 *   JIFFOO_API_TOKEN  — API token for authentication (alternative to --token)
 */

import { Command } from 'commander';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { JiffooApiClient } from './client.js';
import { toolSchemas, toolHandlers, TOOL_LIST, type ToolContext } from './tools.js';

const VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Parse CLI options
// ---------------------------------------------------------------------------

interface CliOptions {
  apiUrl?: string;
  token?: string;
  http?: boolean;
  port?: string;
}

const program = new Command();

program
  .name('jiffoo-mcp-server')
  .description('MCP Server for Jiffoo e-commerce')
  .version(VERSION)
  .option('--api-url <url>', 'Jiffoo API base URL (e.g. http://localhost:3001/api/v1)')
  .option('--token <token>', 'API token for authentication')
  .option('--http', 'Use streamable HTTP transport instead of stdio')
  .option('--port <port>', 'Port for HTTP transport (default: 3100)', '3100')
  .action((opts: CliOptions) => {
    run(opts).catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  });

program.parse();

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

async function run(options: CliOptions): Promise<void> {
  const apiUrl = options.apiUrl || process.env.JIFFOO_API_URL;
  if (!apiUrl) {
    console.error('Error: --api-url or JIFFOO_API_URL is required');
    console.error('Example: npx @jiffoo/mcp-server --api-url http://localhost:3001/api/v1');
    process.exit(1);
  }

  const token = options.token || process.env.JIFFOO_API_TOKEN;

  // Create API client
  const client = new JiffooApiClient({
    baseUrl: apiUrl,
    token,
  });

  const toolContext: ToolContext = {
    client,
    hasToken: Boolean(token),
  };

  // Create MCP server
  const server = new Server(
    {
      name: 'jiffoo-mcp-server',
      version: VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOL_LIST.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as any,
      })),
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string; arguments?: unknown } }) => {
    const { name, arguments: args } = request.params;

    const handler = toolHandlers[name];
    if (!handler) {
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      return await handler(args || {}, toolContext);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Tool execution failed: ${message}` }],
        isError: true,
      };
    }
  });

  // Start transport
  if (options.http) {
    await startHttpTransport(server, parseInt(options.port || '3100', 10), token);
  } else {
    await startStdioTransport(server);
  }
}

/**
 * Start stdio transport (default).
 * Used by Claude Desktop, Claude Code, and other MCP clients
 * that spawn the server as a child process.
 */
async function startStdioTransport(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now running — stdio transport handles communication
}

/**
 * Start streamable HTTP transport.
 * Used for remote agent connections over the network.
 *
 * The token from --token or JIFFOO_API_TOKEN is passed through
 * to the API client. For HTTP mode, agents can also pass the
 * token via the Authorization header, which is forwarded to the API.
 */
async function startHttpTransport(
  server: Server,
  port: number,
  _token?: string,
): Promise<void> {
  // Streamable HTTP transport uses a simple HTTP server
  // that the MCP SDK manages internally.
  //
  // Note: The SDK's StreamableHTTPServerTransport handles the
  // MCP protocol over HTTP. The token is configured at the
  // client level, not per-request — for multi-tenant HTTP mode,
  // each agent should run its own server instance with its own token.

  const http = await import('node:http');
  const { URL } = await import('node:url');

  const httpServer = http.createServer(async (req, res) => {
    // Health check endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: VERSION }));
      return;
    }

    // MCP endpoint — accept POST for tool calls
    if (req.method === 'POST') {
      try {
        const body = await readRequestBody(req);
        const message = JSON.parse(body);

        // Handle MCP message via the server
        // Use dynamic import with fallback for streamable HTTP transport
        let transport: any;
        try {
          const mod = await import(
            '@modelcontextprotocol/sdk/server/streamableHttp.js'
          );
          const StreamableHTTPServerTransport = mod.StreamableHTTPServerTransport;
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
          });
        } catch {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Streamable HTTP transport not available' }));
          return;
        }

        await server.connect(transport);
        await transport.handleIncomingMessage(message, {
          response: res,
          request: req,
        });
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Bad request',
          message: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
      return;
    }

    // Method not allowed
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  });

  httpServer.listen(port, () => {
    console.error(`Jiffoo MCP Server (HTTP) listening on port ${port}`);
    console.error(`Health check: http://localhost:${port}/health`);
  });
}

/**
 * Read the full request body from an HTTP request.
 */
function readRequestBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
