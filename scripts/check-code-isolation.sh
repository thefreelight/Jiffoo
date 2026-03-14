#!/bin/bash

# Code Isolation Check Script
# Ensures Core API does not import from Platform API
#
# Usage: ./scripts/check-code-isolation.sh
# Exit codes: 0 = pass, 1 = violations found

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔍 Checking architectural boundaries..."
echo ""

VIOLATIONS=0

# Check Core API imports
echo "📦 Checking apps/api (Core API)..."

# Pattern 1: Direct imports from platform-api
if grep -r "from.*['\"].*platform-api" "$ROOT_DIR/apps/api/src" 2>/dev/null; then
    echo "❌ VIOLATION: Core API imports from platform-api"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# Pattern 2: Direct imports from internal platform-only directories
# Note: Importing from ../../platform/ or similar paths is NOT allowed
PLATFORM_IMPORTS=$(grep -r "from.*['\"].*\.\./.*platform-api/" "$ROOT_DIR/apps/api/src" --include="*.ts" 2>/dev/null || true)
if [ -n "$PLATFORM_IMPORTS" ]; then
    echo "$PLATFORM_IMPORTS"
    echo "❌ VIOLATION: Core API imports directly from Platform directory"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

# Pattern 3: Relative imports going up to platform-api
if grep -r "from.*['\"]\.\..*platform-api" "$ROOT_DIR/apps/api/src" 2>/dev/null; then
    echo "❌ VIOLATION: Core API has relative imports to platform-api"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

echo ""

# Check packages/shared imports (should not import from any app)
echo "📦 Checking packages/shared..."

if grep -r "from.*['\"].*apps/" "$ROOT_DIR/packages/shared/src" 2>/dev/null; then
    echo "❌ VIOLATION: Shared package imports from apps"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

echo ""

# Check packages/api-client imports
echo "📦 Checking packages/api-client..."

if grep -r "from.*['\"].*apps/" "$ROOT_DIR/packages/api-client/src" 2>/dev/null; then
    echo "❌ VIOLATION: api-client imports from apps"
    VIOLATIONS=$((VIOLATIONS + 1))
fi

echo ""

# Summary
if [ $VIOLATIONS -eq 0 ]; then
    echo "✅ Code isolation check passed - no violations found"
    exit 0
else
    echo "❌ Code isolation check failed - $VIOLATIONS violation(s) found"
    exit 1
fi
