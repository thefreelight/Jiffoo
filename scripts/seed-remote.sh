#!/bin/bash

# Jiffoo Mall Remote Seed Script
# Run seed initialization inside a Kubernetes pod.
#
# Usage: ./scripts/seed-remote.sh [--namespace jiffoo-mall-dev]

set -e

NAMESPACE="${1:-jiffoo-mall-dev}"

echo "🌱 Jiffoo Mall Remote Seed Script"
echo "================================="
echo "Namespace: $NAMESPACE"
echo ""

# Find the API pod name
echo "🔍 Finding API pod..."
API_POD=$(kubectl get pods -n "$NAMESPACE" -l app=api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

if [ -z "$API_POD" ]; then
    echo "❌ No API pod found in namespace $NAMESPACE"
    echo "   Available pods:"
    kubectl get pods -n "$NAMESPACE"
    exit 1
fi

echo "✅ Found API pod: $API_POD"
echo ""

# Run the seed command
echo "🚀 Running database seed..."
echo "----------------------------"

kubectl exec -n "$NAMESPACE" "$API_POD" -- sh -c "cd /app && npx tsx prisma/seed.ts"

echo ""
echo "----------------------------"
echo "✅ Seed completed successfully!"
echo ""
echo "📋 Summary:"
echo "   - Admin: admin@jiffoo.com / admin123"
echo "   - User: user@jiffoo.com / admin123"
echo "   - Super Admin: superadmin@jiffoo.com / admin123"
echo "   - 10 sample products created"
