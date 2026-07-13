# @jiffoo/mcp-server

MCP (Model Context Protocol) Server for Jiffoo e-commerce.

Enables AI agents (Claude Desktop, Claude Code, etc.) to browse products, manage carts, and create orders programmatically.

[![npm version](https://img.shields.io/npm/v/@jiffoo/mcp-server)](https://www.npmjs.com/package/@jiffoo/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Quick Start

### 1. Generate an API Token

In your Jiffoo Admin, go to **Settings → API Tokens** and create a token with the scopes you need:
- `catalog:read` — search and view products
- `cart:write` — manage shopping cart
- `checkout:create` — create orders and payment sessions

### 2. Configure Claude Desktop

Add the following to your Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "jiffoo": {
      "command": "npx",
      "args": ["-y", "@jiffoo/mcp-server"],
      "env": {
        "JIFFOO_API_URL": "http://localhost:3001/api/v1",
        "JIFFOO_API_TOKEN": "jiffoo_your_token_here"
      }
    }
  }
}
```

### 3. Use with Claude Code

```bash
# Set environment variables
export JIFFOO_API_URL=http://localhost:3001/api/v1
export JIFFOO_API_TOKEN=jiffoo_your_token_here

# Run MCP server in stdio mode
npx @jiffoo/mcp-server
```

Or add to your `.mcp.json`:

```json
{
  "servers": {
    "jiffoo": {
      "command": "npx",
      "args": ["-y", "@jiffoo/mcp-server"],
      "env": {
        "JIFFOO_API_URL": "http://localhost:3001/api/v1",
        "JIFFOO_API_TOKEN": "jiffoo_your_token_here"
      }
    }
  }
}
```

## Usage

### stdio Mode (Default)

Used by Claude Desktop and other MCP clients that spawn the server as a child process:

```bash
npx @jiffoo/mcp-server --api-url http://localhost:3001/api/v1 --token jiffoo_xxx
```

### HTTP Mode

For remote agent connections over the network:

```bash
npx @jiffoo/mcp-server --http --port 3100 --api-url http://localhost:3001/api/v1
```

Health check: `GET http://localhost:3100/health`

## Available Tools

### Read-Only Tools (require `catalog:read` scope)

| Tool | Description |
|------|-------------|
| `search_products` | Search the product catalog by keyword, category, or price range |
| `get_product` | Get detailed product information including variants and stock |
| `get_categories` | List all product categories with product counts |

### Cart Tools (require `cart:write` scope)

| Tool | Description |
|------|-------------|
| `get_cart` | Get the current shopping cart contents |
| `add_to_cart` | Add a product variant to the cart |

### Checkout Tools (require `checkout:create` scope)

| Tool | Description |
|------|-------------|
| `create_checkout` | Create an order from the cart and generate a hosted payment URL |

## Security Model

- **Never handles payment credentials**: The `create_checkout` tool creates an order and returns a hosted payment URL (e.g. Stripe Checkout). The agent never sees or handles credit card details.
- **Scoped API tokens**: Tokens have explicit scopes. A read-only token cannot modify the cart or create orders.
- **Revocable**: Tokens can be revoked at any time from the Admin dashboard.
- **Audit trail**: All token activity is logged with `tokenId` and `label`.

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JIFFOO_API_URL` | Jiffoo API base URL (e.g. `http://localhost:3001/api/v1`) | Yes |
| `JIFFOO_API_TOKEN` | API token for authentication | Yes (for cart/checkout tools) |

### CLI Options

| Option | Description |
|--------|-------------|
| `--api-url <url>` | API base URL (alternative to `JIFFOO_API_URL`) |
| `--token <token>` | API token (alternative to `JIFFOO_API_TOKEN`) |
| `--http` | Use HTTP transport instead of stdio |
| `--port <port>` | Port for HTTP transport (default: 3100) |
| `-V, --version` | Output version |
| `-h, --help` | Display help |

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run in dev mode
pnpm dev -- --api-url http://localhost:3001/api/v1

# Run tests
pnpm test
```

## License

MIT © [Jiffoo Team](https://jiffoo.com)
