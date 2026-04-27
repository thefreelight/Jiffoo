#!/bin/bash
# scripts/check-opensource-isolation.sh

set -euo pipefail

OPENSOURCE_DIR="${1:-.}"
ERRORS=0

OPEN_SOURCE_CODE_SCOPES=(
  "apps/api/src"
  "apps/admin/app"
  "apps/admin/components"
  "apps/admin/lib"
  "apps/shop/app"
  "apps/shop/components"
  "apps/shop/lib"
  "packages/shared/src"
  "packages/plugin-sdk/src"
  "packages/shop-themes/default/src"
  "packages/ui/src"
  "scripts"
  ".github/workflows"
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

ALLOWED_SHOP_THEME_DIRS=(
  "default"
  "bokmoo"
  "digital-vault"
  "esim-mall"
  "imagic-studio"
  "navtoai"
  "yevbi"
)

is_allowed_shop_theme_dir() {
  local theme_name="$1"
  for allowed in "${ALLOWED_SHOP_THEME_DIRS[@]}"; do
    if [ "${theme_name}" = "${allowed}" ]; then
      return 0
    fi
  done
  return 1
}

contains_non_gitkeep_files() {
  local dir="$1"
  if [ ! -d "$dir" ]; then
    return 1
  fi

  find "$dir" -mindepth 1 ! -name ".gitkeep" -print -quit | grep -q .
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Opensource Isolation Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Checking: ${OPENSOURCE_DIR}"
echo ""
# Check 0.1: No /api/internal in code
echo "[0.1/8] Checking for /api/internal paths..."
if grep -r "/api/internal" "${OPENSOURCE_DIR}" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.md" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=dist; then
  echo "  ❌ FAILED: Found /api/internal paths in code/docs"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASSED"
fi

# Check 0.2: No X-Internal-Token header
echo ""
echo "[0.2/8] Checking for X-Internal-Token header..."
if grep -r "X-Internal-Token" "${OPENSOURCE_DIR}" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.md" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=dist \
  --exclude="check-opensource-isolation.sh"; then
  echo "  ❌ FAILED: Found X-Internal-Token header in code/docs"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASSED"
fi

# Check 0.3: No internal-auth keywords
echo ""
echo "[0.3/8] Checking for internal-auth keywords..."
if grep -r "internal-auth" "${OPENSOURCE_DIR}" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.md" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=dist \
  --exclude="check-opensource-isolation.sh"; then
  echo "  ❌ FAILED: Found internal-auth identifier in code/docs"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASSED"
fi
echo "[1/8] Checking for tenantId..."
if grep -r "tenantId" "${OPENSOURCE_DIR}" \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.prisma" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=dist \
  --exclude-dir=examples \
  --exclude-dir=e2e \
  --exclude-dir=tests \
  --exclude="mall-context.ts"; then
  echo "  ❌ FAILED: Found tenantId in code"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASSED"
fi

# Check 2: No X-Tenant-Id header
echo ""
echo "[2/8] Checking for X-Tenant-Id header..."
if grep -r "X-Tenant-Id" "${OPENSOURCE_DIR}" \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=dist; then
  echo "  ❌ FAILED: Found X-Tenant-Id header"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASSED"
fi

# Check 3: No platform-api imports
echo ""
echo "[3/8] Checking for platform-api imports..."
if grep -r "from.*platform-api" "${OPENSOURCE_DIR}" \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=dist; then
  echo "  ❌ FAILED: Found platform-api imports"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASSED"
fi

# Check 4: No super-admin imports
echo ""
echo "[4/8] Checking for super-admin imports..."
if grep -r "from.*super-admin" "${OPENSOURCE_DIR}" \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=dist; then
  echo "  ❌ FAILED: Found super-admin imports"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASSED"
fi

# Check 5: No developer-portal imports
echo ""
echo "[5/8] Checking for developer-portal imports..."
if grep -r "from.*developer-portal" "${OPENSOURCE_DIR}" \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=dist; then
  echo "  ❌ FAILED: Found developer-portal imports"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASSED"
fi

# Check 6: Only registered embedded shop theme runtime mirrors are allowed.
echo ""
echo "[6/10] Checking shop theme runtime mirrors..."
THEME_ROOT="${OPENSOURCE_DIR}/packages/shop-themes"
if [ -d "${THEME_ROOT}" ]; then
  THEME_ERRORS=0
  while IFS= read -r theme_dir; do
    theme_name="$(basename "${theme_dir}")"
    if ! is_allowed_shop_theme_dir "${theme_name}"; then
      echo "  ❌ FAILED: unexpected shop theme runtime mirror present: packages/shop-themes/${theme_name}"
      THEME_ERRORS=$((THEME_ERRORS + 1))
    fi
  done < <(find "${THEME_ROOT}" -mindepth 1 -maxdepth 1 -type d | sort)

  if [ $THEME_ERRORS -gt 0 ]; then
    ERRORS=$((ERRORS + THEME_ERRORS))
  else
    echo "  ✅ PASSED"
  fi
else
  echo "  ✅ PASSED"
fi

# Check 6.5: No stale package directories outside the approved OSS set
echo ""
echo "[6.5/10] Checking for stale package directories..."
PACKAGE_ROOT="${OPENSOURCE_DIR}/packages"
if [ -d "${PACKAGE_ROOT}" ]; then
  PACKAGE_ERRORS=0
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
      echo "  ❌ FAILED: stale package directory present: packages/${package_name}"
      PACKAGE_ERRORS=$((PACKAGE_ERRORS + 1))
    fi
  done < <(find "${PACKAGE_ROOT}" -mindepth 1 -maxdepth 1 -type d | sort)

  if [ $PACKAGE_ERRORS -gt 0 ]; then
    ERRORS=$((ERRORS + PACKAGE_ERRORS))
  else
    echo "  ✅ PASSED"
  fi
else
  echo "  ✅ PASSED"
fi

# Check 7: Runtime extension directories should only contain .gitkeep
echo ""
echo "[7/10] Checking runtime extension directories..."
RUNTIME_ERRORS=0
if contains_non_gitkeep_files "${OPENSOURCE_DIR}/extensions/plugins"; then
  echo "  ❌ FAILED: extensions/plugins contains synced package contents"
  RUNTIME_ERRORS=$((RUNTIME_ERRORS + 1))
fi
if contains_non_gitkeep_files "${OPENSOURCE_DIR}/extensions/themes"; then
  echo "  ❌ FAILED: extensions/themes contains synced package contents"
  RUNTIME_ERRORS=$((RUNTIME_ERRORS + 1))
fi
if [ $RUNTIME_ERRORS -gt 0 ]; then
  ERRORS=$((ERRORS + RUNTIME_ERRORS))
else
  echo "  ✅ PASSED"
fi

# Check 8: No Chinese comments
echo ""
echo "[8/10] Checking for Chinese comments..."
if python3 - "$OPENSOURCE_DIR" "${OPEN_SOURCE_CODE_SCOPES[@]}" <<'PY'
import os
import re
import sys

root = sys.argv[1]
scopes = [scope for scope in sys.argv[2:] if os.path.exists(os.path.join(root, scope))]
pattern = re.compile(r'[\u4e00-\u9fff]')
allowed_dir_markers = (
    os.sep + "i18n" + os.sep,
    os.sep + "messages" + os.sep,
)
allowed_suffixes = (".json",)

for scope in scopes:
    scope_root = os.path.join(root, scope)
    for current_root, dirs, files in os.walk(scope_root):
        dirs[:] = [d for d in dirs if d not in {"node_modules", ".next", "dist"}]
        for file_name in files:
            if not file_name.endswith((".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".md", ".sh", ".yaml", ".yml")):
                continue
            path = os.path.join(current_root, file_name)
            if path.endswith(allowed_suffixes):
                continue
            if any(marker in path for marker in allowed_dir_markers):
                continue
            try:
                with open(path, "r", encoding="utf-8") as handle:
                    content = handle.read()
            except UnicodeDecodeError:
                continue
            if pattern.search(content):
                print(path)
                sys.exit(0)
sys.exit(1)
PY
then
  echo "  ❌ FAILED: Found Chinese comments in code"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASSED"
fi

# Check 9: LICENSE is GPLv2+
echo ""
echo "[9/10] Checking LICENSE..."
if [ ! -f "${OPENSOURCE_DIR}/LICENSE" ]; then
  echo "  ❌ FAILED: LICENSE file not found"
  ERRORS=$((ERRORS + 1))
elif ! grep -q "GNU GENERAL PUBLIC LICENSE" "${OPENSOURCE_DIR}/LICENSE"; then
  echo "  ❌ FAILED: LICENSE is not GPLv2+"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASSED"
fi

# Check 10: No .kiro directory
echo ""
echo "[10/10] Checking for .kiro directory..."
if [ -d "${OPENSOURCE_DIR}/.kiro" ]; then
  echo "  ❌ FAILED: .kiro directory found (should not be in opensource)"
  ERRORS=$((ERRORS + 1))
else
  echo "  ✅ PASSED"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo "✅ All checks passed!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo "❌ ${ERRORS} check(s) failed"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
