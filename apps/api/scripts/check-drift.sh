#!/usr/bin/env bash
# CI Drift Gate (Task 3.5.1)
#
# Verifies that the Prisma schema is in sync with migrations.
# Exit 0 = no drift, exit 1 = drift detected.
#
# Usage: pnpm db:check-drift
# Requires: DATABASE_URL environment variable

set -euo pipefail

cd "$(dirname "$0")/.."

# Fail fast if DATABASE_URL is not set
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL is not set. Cannot run drift check."
  echo "   Set DATABASE_URL to a PostgreSQL connection string (can be a throwaway shadow DB)."
  exit 1
fi

echo "🔍 Checking Prisma schema drift..."

# Run migrate diff: compare migrations dir vs schema datamodel
# --to-schema-datamodel accepts a directory when using prismaSchemaFolder
DIFF=$(npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema \
  --shadow-database-url "$DATABASE_URL" \
  2>&1)

# Check the exit code of prisma migrate diff
DIFF_EXIT=$?
if [ $DIFF_EXIT -ne 0 ]; then
  # prisma migrate diff returns non-zero when differences are found
  # but also on errors. Check if output contains "No difference" for success.
  if echo "$DIFF" | grep -q "No difference detected"; then
    echo "✅ No schema drift detected. Schema and migrations are in sync."
    exit 0
  fi
  # If output contains actual diff lines (not just comments/blanks), it's drift
  if [ -n "$(echo "$DIFF" | grep -v '^$' | grep -v '^--')" ]; then
    echo "❌ Schema drift detected!"
    echo ""
    echo "The following differences were found between migrations and schema/:"
    echo "$DIFF"
    echo ""
    echo "To fix: create a new migration with 'pnpm --filter api exec prisma migrate dev --name <descriptive-name>'"
    exit 1
  fi
  # Otherwise it was an error
  echo "❌ prisma migrate diff failed with error:"
  echo "$DIFF"
  exit 1
fi

# Exit code 0 means no differences
echo "✅ No schema drift detected. Schema and migrations are in sync."
exit 0
