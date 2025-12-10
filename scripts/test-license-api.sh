#!/bin/bash
# Test License API

echo "=== Killing existing processes ==="
pkill -9 -f "tsx" 2>/dev/null || true
pkill -9 -f "node.*server" 2>/dev/null || true
sleep 2

echo "=== Starting server ==="
cd /Users/jordan/Projects/jiffoo-mall-core/apps/api
npm run dev > /tmp/server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

echo "=== Waiting for server to start ==="
sleep 12

echo ""
echo "=== Testing health endpoint ==="
curl -s http://localhost:3001/health
echo ""

echo ""
echo "=== Getting auth token ==="
TOKEN=$(curl -s -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@jiffoo.com","password":"admin123"}' | jq -r '.data.accessToken')
echo "Token: ${TOKEN:0:40}..."

echo ""
echo "=== 1. GET /api/admin/licenses ==="
curl -s "http://localhost:3001/api/admin/licenses" -H "Authorization: Bearer $TOKEN"
echo ""

echo ""
echo "=== 2. GET /api/admin/plugins/stripe/license ==="
curl -s "http://localhost:3001/api/admin/plugins/stripe/license" -H "Authorization: Bearer $TOKEN"
echo ""

echo ""
echo "=== 3. POST /api/admin/plugins/stripe/license/activate ==="
curl -s -X POST "http://localhost:3001/api/admin/plugins/stripe/license/activate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"licenseKey":"TEST-KEY-12345"}'
echo ""

echo ""
echo "=== Done ==="

