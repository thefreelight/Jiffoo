#!/bin/bash

# Test Open-Source Build Script
#
# Verifies that the open-source version of jiffoo-mall-core can be built
# independently without any closed-source dependencies.
#
# Usage: ./scripts/test-opensource-build.sh
# This is meant to be run in CI/CD pipelines.

set -euo pipefail

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

# Step 2: Generate a fresh opensource mirror
echo ""
echo "📦 Syncing open-source mirror into test directory..."
OPENSOURCE_REPO_DIR="$TEST_DIR" bash "$ROOT_DIR/scripts/sync-opensource.sh"
echo "   ✅ Open-source mirror synced"

# Step 3: Run strict isolation checks
echo ""
echo "👮 Running strict isolation checks..."
if [ -f "$ROOT_DIR/scripts/check-opensource-isolation.sh" ]; then
    bash "$ROOT_DIR/scripts/check-opensource-isolation.sh" "$TEST_DIR" || {
        echo "   ❌ Isolation checks failed"
        exit 1
    }
    echo "   ✅ Isolation checks passed"
else
    echo "   ⚠️ Warning: Isolation check script not found"
fi

# Step 4: Install dependencies
echo ""
echo "📥 Installing dependencies..."
cd "$TEST_DIR"
pnpm install --frozen-lockfile
echo "   ✅ Dependencies installed"

# Step 5: Build shared workspace packages
echo ""
echo "🔨 Building shared packages..."
pnpm --dir "$TEST_DIR/packages/shared" build
pnpm --dir "$TEST_DIR/packages/core-api-sdk" build
pnpm --dir "$TEST_DIR/packages/theme-api-sdk" build
pnpm --dir "$TEST_DIR/packages/ui" build
echo "   ✅ Shared packages built"

# Step 6: Generate Prisma client and type-check Core API
echo ""
echo "🔨 Generating Prisma client and type-checking Core API..."
cd "$TEST_DIR/apps/api"
pnpm exec prisma generate 2>&1 | tail -10
pnpm tsc --noEmit || {
    echo "   ❌ Core API type-check failed"
    exit 1
}
echo "   ✅ Core API type-check passed"

# Step 7: Build Admin
echo ""
echo "🛍️ Building Merchant Admin..."
cd "$TEST_DIR/apps/admin"
pnpm run build || {
    echo "   ❌ Admin build failed"
    exit 1
}
echo "   ✅ Merchant Admin build passed"

# Step 8: Build Shop
echo ""
echo "🛒 Building Shop..."
cd "$TEST_DIR/apps/shop"
pnpm run build || {
    echo "   ❌ Shop build failed"
    exit 1
}
echo "   ✅ Shop build passed"

# Step 9: Summary
echo ""
echo "=============================="
echo "✅ Open-Source Build Test PASSED"
echo ""
echo "Tested components:"
echo "  - apps/api"
echo "  - apps/admin"
echo "  - apps/shop"
echo "  - packages/shared"
echo "  - packages/core-api-sdk"
echo "  - packages/theme-api-sdk"
echo "  - packages/ui"
echo "  - packages/shop-themes/default"
echo "  - packages/shop-themes/bokmoo"
echo "  - packages/shop-themes/digital-vault"
echo "  - packages/shop-themes/esim-mall"
echo "  - packages/shop-themes/imagic-studio"
echo "  - packages/shop-themes/navtoai"
echo "  - packages/shop-themes/yevbi"
echo ""
echo "The open-source version builds successfully!"
