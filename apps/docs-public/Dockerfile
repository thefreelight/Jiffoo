# Docusaurus Public Documentation Site
FROM node:18-alpine AS base

# Build-time proxy configuration
ARG HTTP_PROXY=http://192.168.0.106:7890
ARG HTTPS_PROXY=http://192.168.0.106:7890
ARG NO_PROXY=localhost,127.0.0.1,192.168.0.0/16,10.0.0.0/8

# Install system packages BEFORE setting proxy (Alpine repos don't need proxy)
RUN apk add --no-cache libc6-compat

# Set proxy environment variables for npm (after apk)
ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install pnpm with proxy and npm mirror
RUN npm config set proxy ${HTTP_PROXY} && \
    npm config set https-proxy ${HTTPS_PROXY} && \
    npm config set registry https://registry.npmmirror.com && \
    npm install -g pnpm@9.0.0

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/docs-public/package.json ./apps/docs-public/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies with npm mirror and retry settings
# Override .npmrc registry which may point to internal mirror
RUN sed -i 's|registry=http://npm.lafdru.local/|registry=https://registry.npmmirror.com/|g' .npmrc && \
    pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-mintimeout 20000 && \
    pnpm config set fetch-retry-maxtimeout 120000 && \
    pnpm install --no-frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install pnpm in builder stage (same version as deps stage)
RUN npm install -g pnpm@9.0.0

# Copy node_modules from deps stage (pnpm hoists dependencies to root)
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure packages/shared is built if needed
RUN if [ -f packages/shared/package.json ]; then \
      cd packages/shared && pnpm run build 2>/dev/null || true; \
    fi

# Build the Docusaurus site
WORKDIR /app/apps/docs-public
RUN pnpm run build

# Production image, copy all the files and run nginx
FROM nginx:alpine AS runner
WORKDIR /usr/share/nginx/html

# Remove default nginx static assets
RUN rm -rf ./*

# Copy static assets from builder stage
COPY --from=builder /app/apps/docs-public/build .

# Create nginx configuration for non-privileged port and non-root user
# Enable autoindex for Docusaurus sites and support SPA routing
RUN echo 'pid /tmp/nginx.pid; events { worker_connections 1024; } http { include /etc/nginx/mime.types; default_type application/octet-stream; sendfile on; keepalive_timeout 65; server { listen 3009; location / { root /usr/share/nginx/html; index index.html; autoindex on; try_files $uri $uri/ $uri.html /docs/intro/index.html =404; } } }' > /etc/nginx/nginx.conf

# Fix nginx permissions - create cache directories and set ownership
RUN mkdir -p /var/cache/nginx/client_temp \
    /var/cache/nginx/proxy_temp \
    /var/cache/nginx/fastcgi_temp \
    /var/cache/nginx/uwsgi_temp \
    /var/cache/nginx/scgi_temp \
    && chown -R nginx:nginx /var/cache/nginx /usr/share/nginx/html \
    && chmod -R 755 /var/cache/nginx \
    && chmod 1777 /tmp

# Switch to non-root user
USER nginx

EXPOSE 3009

CMD ["nginx", "-g", "daemon off;"]
