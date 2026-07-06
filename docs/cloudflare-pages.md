# Deploy to Cloudflare

Jiffoo Shop can be deployed to Cloudflare Pages in minutes. This guide walks you through the process.

## Prerequisites

- A running Jiffoo API instance (self-hosted or managed)
- A Cloudflare account (free tier works)
- Node.js 18+ and pnpm installed locally

## Option 1: Deploy via Cloudflare Pages Dashboard

1. **Push your Jiffoo project to GitHub/GitLab**

2. **Create a new Pages project**
   - Go to [Cloudflare Dashboard → Pages](https://dash.cloudflare.com/?to=/:account/pages)
   - Click "Create a project" → "Connect to Git"
   - Select your repository

3. **Configure build settings**
   - **Framework preset:** Next.js
   - **Build command:** `pnpm install --frozen-lockfile && pnpm --filter shop build`
   - **Build output directory:** `apps/shop/.next`
   - **Environment variables:**
     ```
     NEXT_PUBLIC_API_URL=https://api.yourdomain.com
     NEXT_PUBLIC_SHOP_URL=https://shop.yourdomain.com
     NODE_VERSION=20
     ```

4. **Deploy**
   - Click "Save and Deploy"
   - Wait for the build to complete (typically 3-5 minutes)

## Option 2: Deploy via Wrangler CLI

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Build the shop
cd apps/shop
pnpm install
NEXT_PUBLIC_API_URL=https://api.yourdomain.com pnpm build

# Deploy
wrangler pages deploy .next --project-name jiffoo-shop
```

## Connecting Your API

After deploying the shop, you need to connect it to your Jiffoo API:

### If you deployed the API separately:
1. Set `NEXT_PUBLIC_API_URL` to your API's public URL
2. Ensure CORS is configured on the API to allow your shop domain

### If you haven't deployed the API yet:
1. Visit your shop URL — it will show a **Setup page**
2. Enter your API URL in the input field
3. Or click "Deploy with Jiffoo Cloud" for managed hosting

## Custom Domain

1. In Cloudflare Pages → your project → Custom domains
2. Add your domain (e.g., `shop.yourdomain.com`)
3. Cloudflare will handle SSL automatically

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | URL of your Jiffoo API instance |
| `NEXT_PUBLIC_SHOP_URL` | No | Public URL of the shop (for canonical links) |
| `NEXT_PUBLIC_ENABLE_REMOTE_LOGS` | No | Set to `true` to enable remote log reporting |

## Troubleshooting

### Build fails with "Module not found"
Ensure `pnpm install` runs before the build. If using a monorepo, make sure workspace packages are built first:
```bash
pnpm --filter shared build && pnpm --filter ui build && pnpm --filter shop build
```

### API connection refused
- Check that `NEXT_PUBLIC_API_URL` is set correctly (no trailing slash)
- Verify CORS settings on the API allow your shop domain
- Ensure the API is accessible from the public internet

### Page shows "Setup" screen
This means `NEXT_PUBLIC_API_URL` was not set at build time. Either:
1. Set it as an environment variable in Cloudflare Pages and rebuild
2. Or use the setup page to enter the API URL manually (saved in browser localStorage)

## Next Steps

- [Configure your theme](./themes.md)
- [Set up payment providers](./payments.md)
- [Enable AI agent commerce (MCP)](./agentic-commerce.md)
