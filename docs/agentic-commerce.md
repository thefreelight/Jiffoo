# Agentic Commerce — MCP Server Guide

> Jiffoo's MCP (Model Context Protocol) server enables AI agents to interact with your store programmatically — browsing products, managing carts, and creating orders.

## Overview

The `@jiffoo/mcp-server` package provides a standards-compliant MCP server that exposes Jiffoo's commerce capabilities to AI agents. It supports both **stdio** transport (for local tools like Claude Desktop) and **streamable HTTP** transport (for remote agent connections).

## Architecture

```
┌──────────────────┐     MCP Protocol      ┌──────────────────┐     HTTP/REST      ┌──────────────┐
│  Claude Desktop  │ ◄──────────────────► │  @jiffoo/mcp     │ ◄────────────────► │  Jiffoo API  │
│  Claude Code     │     (stdio or HTTP)   │  -server         │     (Bearer token)  │  (Fastify)   │
│  Custom Agents   │                       │                  │                     │              │
└──────────────────┘                       └──────────────────┘                     └──────────────┘
```

## Getting Started

### 1. Install and Run the MCP Server

```bash
# Install globally (optional)
npm install -g @jiffoo/mcp-server

# Or use npx
npx @jiffoo/mcp-server --api-url http://localhost:3001/api/v1 --token jiffoo_your_token
```

### 2. Generate an API Token

Tokens are managed in Admin → Settings → API Tokens. Available scopes:

| Scope | Capabilities |
|-------|-------------|
| `catalog:read` | Search products, get product details, list categories |
| `cart:write` | Get cart, add items to cart |
| `checkout:create` | Create orders, generate payment URLs |
| `orders:read` | View order history (future) |
| `*` | All capabilities (admin-level) |

### 3. Connect Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

Restart Claude Desktop. You can now ask Claude to:
- "Search for eSIM data plans for Japan"
- "Add the $50 Amazon gift card to my cart"
- "Show me what's in my cart"
- "Create an order and give me the payment link"

### 4. Connect Claude Code

Create a `.mcp.json` in your project root:

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

## Security Boundaries

### What the MCP Server CAN Do

- Browse the product catalog (read-only, no token needed)
- Manage a shopping cart (requires `cart:write` scope)
- Create orders and get payment URLs (requires `checkout:create` scope)
- Return product recommendations based on search

### What the MCP Server CANNOT Do

- **Handle payment credentials**: The `create_checkout` tool returns a hosted payment URL (Stripe Checkout). The agent never sees credit card details.
- **Access admin functions**: No access to admin dashboard, user management, or system settings.
- **Modify products**: No product creation, editing, or deletion.
- **Access other users' data**: The token is scoped to a single user's cart and orders.

## Available Tools

### search_products

Search the product catalog with flexible filters.

**Parameters:**
- `q` (string, optional): Search query — matches product name and description
- `category` (string, optional): Category ID filter
- `minPrice` / `maxPrice` (number, optional): Price range filter
- `inStock` (boolean, optional): Only return in-stock products
- `sortBy` (string, optional): `price`, `name`, `createdAt`, `stock`
- `page` / `limit` (number, optional): Pagination

**Example:** "Find gift cards under $100"

### get_product

Get full details for a specific product, including all variants and stock levels.

**Parameters:**
- `productId` (string, required): Product ID from search results

### get_categories

List all product categories with product counts.

### get_cart

View the current shopping cart, including items, quantities, subtotals, and applied discounts.

### add_to_cart

Add a product to the cart.

**Parameters:**
- `productId` (string, required): Product ID
- `variantId` (string, optional): Specific variant ID
- `quantity` (number, optional): Quantity (default: 1)

### create_checkout

Create an order from the cart and generate a payment URL.

**Parameters:**
- `customerEmail` (string): Email for order confirmation and digital delivery
- `shippingAddress` (object, optional): Required for physical goods only
- `discountCodes` (array, optional): Coupon codes to apply

**Returns:** Order number, total, and a hosted payment URL.

## HTTP Transport Mode

For remote deployments or multi-agent scenarios:

```bash
# Start the server in HTTP mode
npx @jiffoo/mcp-server --http --port 3100 --api-url http://localhost:3001/api/v1

# Health check
curl http://localhost:3100/health
# → {"status":"ok","version":"0.1.0"}
```

## Token Management

### Create a Token

```bash
# Via API (requires admin JWT)
curl -X POST http://localhost:3001/api/v1/admin/api-tokens \
  -H "Authorization: Bearer <admin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Claude Desktop - Personal",
    "scopes": ["catalog:read", "cart:write", "checkout:create"]
  }'
```

### Revoke a Token

```bash
curl -X DELETE http://localhost:3001/api/v1/admin/api-tokens/<tokenId> \
  -H "Authorization: Bearer <admin_jwt>"
```

## Example Agent Conversations

### Browsing Products

```
User: "What eSIM plans do you have for Japan?"

Agent: [calls search_products with q="Japan eSIM"]
       "I found 3 eSIM plans for Japan:
        - Japan eSIM 10GB / 14 Days — $21.99
        - Japan eSIM 5GB / 7 Days — $14.99
        - Asia eSIM 6GB / 10 Days (covers Japan) — $17.99"

User: "Tell me more about the 10GB plan."

Agent: [calls get_product with productId from search results]
       "Japan eSIM — 10GB / 14 Days
        Price: $21.99
        Covers: Japan only
        Network: NTT Docomo 4G
        Delivery: Instant QR code via email
        Validity: 14 days from activation"
```

### Purchasing

```
User: "Add the 10GB Japan plan to my cart and check out."

Agent: [calls add_to_cart with productId and quantity=1]
       "Added Japan eSIM 10GB / 14 Days to your cart. Total: $21.99"

Agent: [calls create_checkout with customerEmail]
       "Order created! Here's your payment link:
        https://checkout.stripe.com/c/pay/cs_xxx
        
        After payment, your eSIM QR code will be delivered
        to your email instantly."
```

## Troubleshooting

### "Missing API token" error

The MCP server requires a token for cart and checkout operations. Set `JIFFOO_API_TOKEN` in your environment or use `--token` flag.

### "Invalid token" error

The token may have been revoked. Generate a new one in Admin → Settings → API Tokens.

### Products not showing up

Ensure the API URL is correct and the server is running. Products must be marked as `isActive: true` in the admin to appear in search results.
