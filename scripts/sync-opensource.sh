#!/bin/bash
# scripts/sync-opensource.sh

set -euo pipefail

# Configuration
PRIVATE_REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OPENSOURCE_REPO_DIR="${OPENSOURCE_REPO_DIR:-../jiffoo}"
DRY_RUN="${DRY_RUN:-false}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Jiffoo Opensource Sync"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Private repo: ${PRIVATE_REPO_DIR}"
echo "Opensource repo: ${OPENSOURCE_REPO_DIR}"
echo "Dry run: ${DRY_RUN}"
echo ""

# Check if opensource repo exists
if [ ! -d "${OPENSOURCE_REPO_DIR}" ]; then
  echo "ERROR: Opensource repo not found: ${OPENSOURCE_REPO_DIR}"
  echo "Please clone or create the opensource repo first"
  exit 1
fi

# Define directories to sync
SYNC_DIRS=(
  "apps/api"
  "apps/admin"
  "apps/shop"
  "packages/core-api-sdk"
  "packages/create-jiffoo-app"
  "packages/plugin-sdk"
  "packages/shared"
  "packages/theme-api-sdk"
  "packages/ui"
  "docs"
  "tests/e2e/core"
  "tests/performance"
)

# Define directories that must never exist in the opensource mirror.
BLOCKED_DIRS=(
  "apps/docs"
  "apps/platform-api"
  "apps/super-admin"
  "apps/developer-portal"
  "packages/shop-themes"
)

# Define files to sync
SYNC_FILES=(
  ".env.example"
  ".gitignore"
  "LICENSE"
  "README.md"
  "package.json"
  "pnpm-lock.yaml"
  "pnpm-workspace.yaml"
  "tsconfig.json"
  "turbo.json"
)

SYNC_SCRIPT_FILES=(
  "scripts/check-code-isolation.sh"
  "scripts/check-no-tenant-id.sh"
  "scripts/check-opensource-isolation.sh"
  "scripts/seed-remote.sh"
  "scripts/sync-opensource.sh"
  "scripts/test-opensource-build.sh"
)

SYNC_WORKFLOW_FILES=(
  ".github/workflows/opensource-sync.yml"
)

# Rsync options
RSYNC_OPTS=(
  -av
  --delete
  --prune-empty-dirs
  --exclude=node_modules
  --exclude=.next
  --exclude=dist
  --exclude=.turbo
  --exclude=/extensions
  --exclude=coverage
  --exclude=logs
  --exclude=data
  --exclude=.env
  --exclude=.env.local
  --exclude=.DS_Store
  --exclude=*.log
  --exclude=*.zip
  --exclude=*.tsbuildinfo
)

if [ "${DRY_RUN}" = "true" ]; then
  RSYNC_OPTS+=(--dry-run)
fi

# Sync directories
echo "Syncing directories..."
for dir in "${SYNC_DIRS[@]}"; do
  if [ -d "${PRIVATE_REPO_DIR}/${dir}" ]; then
    echo "  ✓ ${dir}"
    mkdir -p "${OPENSOURCE_REPO_DIR}/$(dirname ${dir})"
    rsync "${RSYNC_OPTS[@]}" \
      "${PRIVATE_REPO_DIR}/${dir}/" \
      "${OPENSOURCE_REPO_DIR}/${dir}/"
  else
    echo "  ⚠ ${dir} (not found, skipping)"
  fi
done

# Remove blocked closed-source directories from the opensource mirror
echo ""
echo "Pruning blocked directories..."
for dir in "${BLOCKED_DIRS[@]}"; do
  TARGET_DIR="${OPENSOURCE_REPO_DIR}/${dir}"
  if [ -e "${TARGET_DIR}" ]; then
    echo "  ✗ ${dir}"
    if [ "${DRY_RUN}" != "true" ]; then
      rm -rf "${TARGET_DIR}"
    fi
  else
    echo "  ✓ ${dir} (already absent)"
  fi
done

# Sync files
echo ""
echo "Syncing files..."
for file in "${SYNC_FILES[@]}"; do
  if [ -f "${PRIVATE_REPO_DIR}/${file}" ]; then
    echo "  ✓ ${file}"
    cp "${PRIVATE_REPO_DIR}/${file}" "${OPENSOURCE_REPO_DIR}/${file}"
  else
    echo "  ⚠ ${file} (not found, skipping)"
  fi
done

# Reset mirrored scripts and workflows to the approved open-source subset
echo ""
echo "Syncing open-source scripts and workflows..."
if [ "${DRY_RUN}" != "true" ]; then
  rm -rf "${OPENSOURCE_REPO_DIR}/scripts"
  rm -rf "${OPENSOURCE_REPO_DIR}/.github/workflows"
  mkdir -p "${OPENSOURCE_REPO_DIR}/scripts"
  mkdir -p "${OPENSOURCE_REPO_DIR}/.github/workflows"
fi

for file in "${SYNC_SCRIPT_FILES[@]}" "${SYNC_WORKFLOW_FILES[@]}"; do
  if [ -f "${PRIVATE_REPO_DIR}/${file}" ]; then
    echo "  ✓ ${file}"
    if [ "${DRY_RUN}" != "true" ]; then
      mkdir -p "${OPENSOURCE_REPO_DIR}/$(dirname ${file})"
      cp "${PRIVATE_REPO_DIR}/${file}" "${OPENSOURCE_REPO_DIR}/${file}"
    fi
  else
    echo "  ⚠ ${file} (not found, skipping)"
  fi
done

# Create extensions directory structure (empty, .gitkeep only)
echo ""
echo "Creating extensions directory..."
if [ "${DRY_RUN}" != "true" ]; then
  mkdir -p "${OPENSOURCE_REPO_DIR}/extensions/plugins"
  mkdir -p "${OPENSOURCE_REPO_DIR}/extensions/themes"
  find "${OPENSOURCE_REPO_DIR}/extensions/plugins" -mindepth 1 ! -name ".gitkeep" -exec rm -rf {} +
  find "${OPENSOURCE_REPO_DIR}/extensions/themes" -mindepth 1 ! -name ".gitkeep" -exec rm -rf {} +
  touch "${OPENSOURCE_REPO_DIR}/extensions/plugins/.gitkeep"
  touch "${OPENSOURCE_REPO_DIR}/extensions/themes/.gitkeep"
fi

# Update package.json workspaces (remove private packages)
echo ""
echo "Updating package.json workspaces..."
if [ "${DRY_RUN}" != "true" ]; then
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('${OPENSOURCE_REPO_DIR}/package.json', 'utf8'));
    
    // Update workspaces to only include opensource packages
    pkg.workspaces = [
      'apps/api',
      'apps/admin',
      'apps/shop',
      'packages/*'
    ];
    
    // Update license
    pkg.license = 'GPL-2.0-or-later';
    
    // Remove private flag
    delete pkg.private;
    
    fs.writeFileSync(
      '${OPENSOURCE_REPO_DIR}/package.json',
      JSON.stringify(pkg, null, 2) + '\n'
    );
  "
fi

# Update pnpm-workspace.yaml
echo ""
echo "Updating pnpm-workspace.yaml..."
if [ "${DRY_RUN}" != "true" ]; then
  cat > "${OPENSOURCE_REPO_DIR}/pnpm-workspace.yaml" <<EOF
packages:
  - 'apps/api'
  - 'apps/admin'
  - 'apps/shop'
  - 'packages/*'
EOF
fi

if [ "${DRY_RUN}" = "true" ]; then
  echo ""
  echo "Dry-run mode: skipped target mutation verification and isolation checks."
else
  # Verify LICENSE is GPLv2+
  echo ""
  echo "Verifying LICENSE..."
  if ! grep -q "GNU GENERAL PUBLIC LICENSE" "${OPENSOURCE_REPO_DIR}/LICENSE"; then
    echo "  ⚠ WARNING: LICENSE file does not appear to be GPLv2+"
    echo "  Please ensure the LICENSE file is correct"
  fi

  # Run isolation checks
  echo ""
  echo "Running isolation checks..."
  bash "${PRIVATE_REPO_DIR}/scripts/check-opensource-isolation.sh" "${OPENSOURCE_REPO_DIR}"

  if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Isolation checks failed!"
    echo "Please fix the issues before committing"
    exit 1
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Sync completed successfully"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. cd ${OPENSOURCE_REPO_DIR}"
echo "2. Review changes: git status"
echo "3. Commit and push: git add . && git commit -m 'Sync from private repo' && git push"

exit 0
