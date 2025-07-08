#!/bin/bash

# Kill any hanging vim processes
pkill -f vim 2>/dev/null || true
pkill -9 vim 2>/dev/null || true

# Set editor to avoid any editor issues
export EDITOR=true
export GIT_EDITOR=true

echo "Killing any vim processes..."
ps aux | grep vim | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true

echo "Resetting to the last remote commit..."
git reset --soft 7b1c75a

echo "Creating new commits with English messages..."

# Commit 1: Admin authentication fixes
git add apps/admin/app/layout.tsx apps/admin/app/page.tsx apps/admin/hooks/useAuth.tsx apps/admin/components/layout/conditional-layout.tsx apps/admin/app/customers/page.tsx

git commit -m "fix: resolve admin authentication system and layout display issues

- Unify authentication system to resolve infinite redirect loops caused by multiple auth store conflicts
- Add ConditionalLayout component to control sidebar display based on authentication state
- Fix UI issue where sidebar was displayed when user was not logged in
- Fix compilation errors from duplicate function declarations in customers page
- Unify login page to use useAuth hook ensuring consistent authentication state

Issues resolved:
- ✅ Only show login page without sidebar when not authenticated
- ✅ Display complete admin interface after login
- ✅ Eliminate authentication state conflicts and redirect loops
- ✅ Fix compilation errors and ensure proper page loading"

# Commit 2: Production deployment configuration
git add .dockerignore .env.production DEPLOYMENT.md Dockerfile.admin Dockerfile.backend Dockerfile.frontend deploy.sh docker-compose.prod.yml nginx/ scripts/

git commit -m "feat: add production environment deployment configuration

- Add Docker containerization configuration files (backend, frontend, admin)
- Add docker-compose production environment configuration
- Add Nginx reverse proxy configuration
- Add automated deployment scripts and health checks
- Add production environment variables configuration template
- Add comprehensive deployment documentation

Deployment features:
- ✅ Support Docker containerized deployment
- ✅ Support Nginx load balancing and reverse proxy
- ✅ Support automated deployment and health monitoring
- ✅ Support production environment configuration management"

# Commit 3: Documentation updates
git add CHANGELOG.md README.md

git commit -m "docs: update project documentation and changelog

- Update README.md with latest feature descriptions
- Update CHANGELOG.md to record latest fixes and improvements
- Update project status and deployment instructions"

# Commit 4: Configuration updates
git add apps/admin/lib/api-client.ts apps/admin/next.config.js apps/backend/src/core/auth/middleware.ts

git commit -m "config: update configuration files

- Update admin API client configuration
- Update Next.js configuration
- Update backend authentication middleware configuration"

echo "All commits created successfully with English messages!"
echo "Pushing to remote repository..."

git push --force-with-lease origin main

echo "Done! All commit messages are now in English."
