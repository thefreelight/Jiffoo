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
  "packages/shop-themes/default"
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
)

ALLOWED_PACKAGE_DIRS=(
  "core-api-sdk"
  "create-jiffoo-app"
  "plugin-sdk"
  "shared"
  "shop-themes"
  "theme-api-sdk"
  "ui"
)

BLOCKED_FILES=(
  "apps/api/.gitlab-ci.yml"
  "apps/admin/.gitlab-ci.yml"
  "apps/shop/.gitlab-ci.yml"
  "apps/api/pipeline"
  "apps/admin/pipeline"
  "apps/shop/pipeline"
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
  --exclude=pipeline
  --exclude=.gitlab-ci.yml
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

echo ""
echo "Pruning blocked files..."
for path in "${BLOCKED_FILES[@]}"; do
  TARGET_PATH="${OPENSOURCE_REPO_DIR}/${path}"
  if [ -e "${TARGET_PATH}" ]; then
    echo "  ✗ ${path}"
    if [ "${DRY_RUN}" != "true" ]; then
      rm -rf "${TARGET_PATH}"
    fi
  else
    echo "  ✓ ${path} (already absent)"
  fi
done

echo ""
echo "Pruning official marketplace themes..."
THEME_ROOT="${OPENSOURCE_REPO_DIR}/packages/shop-themes"
if [ -d "${THEME_ROOT}" ]; then
  while IFS= read -r theme_dir; do
    theme_name="$(basename "${theme_dir}")"
    if [ "${theme_name}" != "default" ]; then
      echo "  ✗ packages/shop-themes/${theme_name}"
      if [ "${DRY_RUN}" != "true" ]; then
        rm -rf "${theme_dir}"
      fi
    fi
  done < <(find "${THEME_ROOT}" -mindepth 1 -maxdepth 1 -type d | sort)
else
  echo "  ✓ packages/shop-themes (not present)"
fi

echo ""
echo "Pruning stale package directories..."
PACKAGE_ROOT="${OPENSOURCE_REPO_DIR}/packages"
if [ -d "${PACKAGE_ROOT}" ]; then
  while IFS= read -r package_dir; do
    package_name="$(basename "${package_dir}")"
    keep="false"
    for allowed in "${ALLOWED_PACKAGE_DIRS[@]}"; do
      if [ "${package_name}" = "${allowed}" ]; then
        keep="true"
        break
      fi
    done
    if [ "${keep}" != "true" ]; then
      echo "  ✗ packages/${package_name}"
      if [ "${DRY_RUN}" != "true" ]; then
        rm -rf "${package_dir}"
      fi
    fi
  done < <(find "${PACKAGE_ROOT}" -mindepth 1 -maxdepth 1 -type d | sort)
else
  echo "  ✓ packages (not present)"
fi

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
    const openSourceVersion = process.env.OPENSOURCE_VERSION;
    const allowedScripts = new Set([
      'dev',
      'dev:core',
      'dev:minimal',
      'dev:api-only',
      'dev:shop-only',
      'dev:admin-only',
      'dev:packages',
      'dev:api',
      'dev:shop',
      'build',
      'build:core',
      'build:official-artifacts',
      'start',
      'lint',
      'type-check',
      'clean',
      'db:generate',
      'db:migrate',
      'db:studio',
      'db:reset',
      'db:seed',
      'test',
      'test:api:quality',
      'test:e2e',
      'test:e2e:shop',
      'test:e2e:admin',
      'test:e2e:all',
      'test:e2e:ui',
      'test:e2e:report',
      'changeset',
      'version:bump',
      'release',
    ]);
    
    // Update workspaces to only include opensource packages
    pkg.workspaces = [
      'apps/api',
      'apps/admin',
      'apps/shop',
      'packages/*',
      'packages/shop-themes/*'
    ];
    
    if (openSourceVersion) {
      pkg.version = openSourceVersion;
    }

    pkg.description = 'Jiffoo open-source core for self-hosted commerce deployments';

    // Update license
    pkg.license = 'GPL-2.0-or-later';
    
    // Remove private flag
    delete pkg.private;

    if (pkg.scripts) {
      pkg.scripts = Object.fromEntries(
        Object.entries(pkg.scripts).filter(([name]) => allowedScripts.has(name))
      );
      pkg.scripts['smoke:opensource-build'] = 'bash scripts/test-opensource-build.sh';
    }
    
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
  - 'packages/shop-themes/*'
EOF
fi

echo ""
echo "Normalizing opensource package metadata..."
if [ "${DRY_RUN}" != "true" ]; then
  OPENSOURCE_REPO_DIR="${OPENSOURCE_REPO_DIR}" node <<'EOF'
const fs = require('fs');
const path = require('path');

const root = process.env.OPENSOURCE_REPO_DIR;
const dependencyReplacements = {
  react: '19.2.1',
  'react-dom': '19.2.1',
  'react-hook-form': '7.68.0',
  '@hookform/resolvers': '3.10.0',
  '@fortawesome/fontawesome-free': '7.2.0',
};

const packageFiles = [
  'apps/admin/package.json',
  'apps/shop/package.json',
  'packages/ui/package.json',
  'packages/shop-themes/default/package.json',
];

for (const relativePath of packageFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) continue;

  const pkg = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = pkg[section];
    if (!deps) continue;
    for (const [name, replacement] of Object.entries(dependencyReplacements)) {
      if (typeof deps[name] === 'string' && deps[name].includes('.tools/npm/')) {
        deps[name] = replacement;
      }
    }
  }

  fs.writeFileSync(absolutePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

const npmrcPath = path.join(root, '.npmrc');
fs.writeFileSync(
  npmrcPath,
  [
    '# pnpm configuration for monorepo compatibility',
    'node-linker=hoisted',
    'shamefully-hoist=true',
    'auto-install-peers=true',
    'strict-peer-dependencies=false',
    'symlink=true',
    'link-workspace-packages=true',
    'registry=https://registry.npmmirror.com/',
    '',
  ].join('\n'),
);

const dockerfilePaths = [
  'apps/api/Dockerfile',
  'apps/admin/Dockerfile',
  'apps/shop/Dockerfile',
];

for (const relativePath of dockerfilePaths) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) continue;

  let contents = fs.readFileSync(absolutePath, 'utf8');

  contents = contents.replace(/^COPY \.tools\/npm\/.*\n/gm, '');
  contents = contents.replace(
    /COPY \.tools\/pnpm\/pnpm-9\.0\.0\.tgz \/tmp\/pnpm-9\.0\.0\.tgz\nRUN npm config set proxy \$\{HTTP_PROXY\} && \\\n    npm config set https-proxy \$\{HTTPS_PROXY\} && \\\n    npm config set registry \$\{NPM_REGISTRY\} && \\\n    npm install -g \/tmp\/pnpm-9\.0\.0\.tgz/g,
    'RUN corepack enable && corepack prepare pnpm@9.0.0 --activate',
  );
  contents = contents.replace(/^COPY packages\/shop-themes\/(?!default\/).*$/gm, '');
  contents = contents.replace(/^COPY --from=deps \/app\/packages\/shop-themes\/(?!default\/).*$/gm, '');
  contents = contents.replace('pnpm config set network-concurrency 1 && \\\n    pnpm config set child-concurrency 1 && \\\n', 'pnpm config set network-concurrency 8 && \\\n    pnpm config set child-concurrency 4 && \\\n');
  contents = contents.replace(/\n{3,}/g, '\n\n');

  fs.writeFileSync(absolutePath, contents);
}

const shopRegistryPath = path.join(root, 'apps/shop/lib/themes/registry.ts');
if (fs.existsSync(shopRegistryPath)) {
  let contents = fs.readFileSync(shopRegistryPath, 'utf8');
  contents = contents.replace(
    /  \/\/ eSIM Mall theme - official embedded full theme[\s\S]*?  \/\/ NOTE: Only 'builtin-default' is the canonical built-in theme\.\n  \/\/ 'default' is kept for backwards compatibility but maps to the same package\.\n  \/\/ Third-party themes should be installed as Theme Packs\n  \/\/ via Extension Installer to extensions\/themes\/shop\//,
    "  // NOTE: The open-source core only embeds the default theme.\n  // Official marketplace themes are downloaded after deployment as Theme Packs."
  );
  fs.writeFileSync(shopRegistryPath, contents);
}

const shopNextConfigPath = path.join(root, 'apps/shop/next.config.js');
if (fs.existsSync(shopNextConfigPath)) {
  let contents = fs.readFileSync(shopNextConfigPath, 'utf8');
  contents = contents.replace(
    /  \/\/ NOTE: `default`, `esim-mall`, and `yevbi` are currently shipped as embedded full themes\.\n  \/\/ Third-party themes should still use the Theme Pack installation path\.\n  transpilePackages: \['shared', '@shop-themes\/default', '@shop-themes\/esim-mall', '@shop-themes\/yevbi', '@jiffoo\/core-api-sdk', '@jiffoo\/theme-api-sdk'\],/,
    "  // The open-source core only ships the default embedded theme.\n  // Official marketplace themes are installed later as Theme Packs.\n  transpilePackages: ['shared', '@shop-themes/default', '@jiffoo/core-api-sdk', '@jiffoo/theme-api-sdk'],"
  );
  fs.writeFileSync(shopNextConfigPath, contents);
}

const shopTsconfigPath = path.join(root, 'apps/shop/tsconfig.json');
if (fs.existsSync(shopTsconfigPath)) {
  let contents = fs.readFileSync(shopTsconfigPath, 'utf8');
  contents = contents.replace(
    /\n    "\.\.\/\.\.\/packages\/shop-themes\/esim-mall\/src\/\*\*\/\*\.ts",\n    "\.\.\/\.\.\/packages\/shop-themes\/esim-mall\/src\/\*\*\/\*\.tsx",\n    "\.\.\/\.\.\/packages\/shop-themes\/yevbi\/src\/\*\*\/\*\.ts",\n    "\.\.\/\.\.\/packages\/shop-themes\/yevbi\/src\/\*\*\/\*\.tsx",/g,
    ''
  );
  fs.writeFileSync(shopTsconfigPath, contents);
}
EOF
fi

if [ "${DRY_RUN}" != "true" ]; then
  echo ""
  echo "Refreshing pnpm lockfile..."
  (
    cd "${OPENSOURCE_REPO_DIR}"
    pnpm install --lockfile-only --ignore-scripts
  )
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
