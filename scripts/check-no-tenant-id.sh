#!/bin/bash
# scripts/check-no-tenant-id.sh

# Directories to check for opensource compliance
OPENSOURCE_DIRS="apps/api apps/admin apps/shop packages/shared packages/plugin-sdk packages/theme-sdk packages/ui"

echo "Checking for tenantId in opensource scope..."

FOUND=0
for dir in $OPENSOURCE_DIRS; do
  if [ -d "$dir" ]; then
    # Check for tenantId in code, excluding this script and node_modules
    # We use grep with exclusion for common false positives if needed, but strict is better for now.
    
    if grep -r "tenantId" "$dir" --include="*.ts" --include="*.tsx" --include="*.prisma" --exclude-dir="node_modules" --exclude-dir=".next" --exclude-dir="dist"; then
      echo "ERROR: Found tenantId in $dir"
      FOUND=1
    fi
    
    # Check for X-Tenant-Id header
    if grep -r "X-Tenant-Id" "$dir" --include="*.ts" --include="*.tsx"; then
      echo "ERROR: Found X-Tenant-Id header in $dir"
      FOUND=1
    fi
  fi
done

if [ $FOUND -eq 1 ]; then
  echo "FAILED: tenantId found in opensource scope"
  exit 1
else
  echo "PASSED: No tenantId in opensource scope"
  exit 0
fi
