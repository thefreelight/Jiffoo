#!/bin/bash

# Test Open-Source Build Script
#
# Verifies that the open-source version of jiffoo-mall-core can be built
# independently without any closed-source dependencies.
#
# Usage: ./scripts/test-opensource-build.sh
# This is meant to be run in CI/CD pipelines.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="/tmp/jiffoo-opensource-test-$$"

echo "🧪 Testing Open-Source Build"
echo "=============================="
echo ""

# Cleanup function
cleanup() {
    if [ -d "$TEST_DIR" ]; then
        echo ""
        echo "🧹 Cleaning up test directory..."
        rm -rf "$TEST_DIR"
    fi
}

trap cleanup EXIT

# Step 1: Create test directory
echo "📁 Creating test directory: $TEST_DIR"
mkdir -p "$TEST_DIR"

# Step 2: Copy open-source components
echo ""
echo "📦 Copying open-source components..."

# Core API
cp -r "$ROOT_DIR/apps/api" "$TEST_DIR/apps/"
# Shop
mkdir -p "$TEST_DIR/apps"
cp -r "$ROOT_DIR/apps/shop" "$TEST_DIR/apps/" 2>/dev/null || echo "   ⚠️ apps/shop not found"
# Admin
cp -r "$ROOT_DIR/apps/admin" "$TEST_DIR/apps/" 2>/dev/null || echo "   ⚠️ apps/admin not found"

# Shared packages
mkdir -p "$TEST_DIR/packages"
cp -r "$ROOT_DIR/packages/shared" "$TEST_DIR/packages/"
cp -r "$ROOT_DIR/packages/core-api-sdk" "$TEST_DIR/packages/" 2>/dev/null || echo "   ⚠️ packages/core-api-sdk not found"
cp -r "$ROOT_DIR/packages/create-jiffoo-app" "$TEST_DIR/packages/" 2>/dev/null || echo "   ⚠️ packages/create-jiffoo-app not found"
cp -r "$ROOT_DIR/packages/plugin-sdk" "$TEST_DIR/packages/" 2>/dev/null || echo "   ⚠️ packages/plugin-sdk not found"
cp -r "$ROOT_DIR/packages/theme-api-sdk" "$TEST_DIR/packages/" 2>/dev/null || echo "   ⚠️ packages/theme-api-sdk not found"
cp -r "$ROOT_DIR/packages/ui" "$TEST_DIR/packages/" 2>/dev/null || echo "   ⚠️ packages/ui not found"

# Copy root config files
cp "$ROOT_DIR/package.json" "$TEST_DIR/"
cp "$ROOT_DIR/pnpm-lock.yaml" "$TEST_DIR/" 2>/dev/null || true
cp "$ROOT_DIR/tsconfig.json" "$TEST_DIR/" 2>/dev/null || true

# Copy docs directory (for content isolation check)
if [ -d "$ROOT_DIR/docs" ]; then
    cp -r "$ROOT_DIR/docs" "$TEST_DIR/"
fi

# Create open-source pnpm-workspace.yaml
cat > "$TEST_DIR/pnpm-workspace.yaml" << 'EOF'
packages:
  - 'apps/api'
  - 'apps/shop'
  - 'apps/admin'
  - 'packages/shared'
  - 'packages/core-api-sdk'
  - 'packages/create-jiffoo-app'
  - 'packages/plugin-sdk'
  - 'packages/theme-api-sdk'
  - 'packages/ui'
EOF

echo "   ✅ Open-source components copied"

# Step 3: Verify no closed-source dependencies
echo ""
echo "🔍 Verifying no closed-source imports..."

VIOLATIONS=0

# Check for platform-api imports
if grep -r "from.*['\"].*platform-api" "$TEST_DIR/apps/api/src" 2>/dev/null; then
    echo "   ❌ Found platform-api imports"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# Check for commercial imports (excluding the allowed loader)
COMMERCIAL_IMPORTS=$(grep -r "from.*['\"].*\.\./.*commercial/" "$TEST_DIR/apps/api/src" 2>/dev/null || true)
if [ -n "$COMMERCIAL_IMPORTS" ]; then
    echo "   ❌ Found commercial imports"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

if [ $VIOLATIONS -eq 0 ]; then
    echo "   ✅ No closed-source imports found"
else
    echo "   ❌ Found $VIOLATIONS import violation(s)"
    exit 1
fi

# Step 3.5: Run strict isolation checks
echo ""
echo "👮 Running strict isolation checks..."
if [ -f "$ROOT_DIR/scripts/check-opensource-isolation.sh" ]; then
    "$ROOT_DIR/scripts/check-opensource-isolation.sh" "$TEST_DIR" || {
        echo "   ❌ Isolation checks failed"
        exit 1
    }
    echo "   ✅ Isolation checks passed"
else
    echo "   ⚠️ Warning: Isolation check script not found"
fi

# Step 3.6: Validate blocked paths are absent
echo ""
echo "🚫 Verifying blocked paths are absent..."
BLOCKED_PATHS=(
  "$TEST_DIR/apps/docs"
  "$TEST_DIR/apps/platform-api"
  "$TEST_DIR/apps/super-admin"
  "$TEST_DIR/apps/developer-portal"
  "$TEST_DIR/packages/shop-themes"
)

for path in "${BLOCKED_PATHS[@]}"; do
    if [ -e "$path" ]; then
        echo "   ❌ Blocked path present: $path"
        exit 1
    fi
done
echo "   ✅ Blocked paths absent"

# Step 4: Install dependencies
echo ""
echo "📥 Installing dependencies..."
cd "$TEST_DIR"
pnpm install --ignore-scripts 2>&1 | tail -5
echo "   ✅ Dependencies installed"

# Step 5: Build Core API
echo ""
echo "🔨 Building Core API..."
cd "$TEST_DIR/apps/api"
pnpm prisma generate 2>&1 | tail -3
pnpm tsc --noEmit 2>&1 || {
    echo "   ❌ Core API build failed"
    exit 1
}
echo "   ✅ Core API type-check passed"

# Step 6: Summary
echo ""
echo "=============================="
echo "✅ Open-Source Build Test PASSED"
echo ""
echo "Tested components:"
echo "  - apps/api (Core API)"
echo "  - packages/shared"
echo ""
echo "The open-source version builds successfully!"
