#!/bin/bash

# Performance Test Script for CI/CD
# 
# Usage:
#   ./scripts/performance-test.sh [smoke|load|stress|full]
#
# Environment Variables:
#   BASE_URL        - Target URL (default: http://localhost:3000)
#   VUS             - Number of virtual users (default: 10)
#   DURATION        - Test duration (default: 30s)
#   P95_THRESHOLD   - P95 latency threshold in ms (default: 500)
#   P99_THRESHOLD   - P99 latency threshold in ms (default: 1000)
#   ERROR_THRESHOLD - Error rate threshold (default: 0.01)

set -e

# Configuration
TEST_TYPE="${1:-smoke}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
VUS="${VUS:-10}"
DURATION="${DURATION:-30s}"
P95_THRESHOLD="${P95_THRESHOLD:-500}"
P99_THRESHOLD="${P99_THRESHOLD:-1000}"
ERROR_THRESHOLD="${ERROR_THRESHOLD:-0.01}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PERFORMANCE_DIR="$PROJECT_ROOT/performance"
REPORTS_DIR="$PERFORMANCE_DIR/reports"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Performance Test Runner${NC}"
echo "=========================================="
echo "Test Type: $TEST_TYPE"
echo "Target URL: $BASE_URL"
echo "VUs: $VUS"
echo "Duration: $DURATION"
echo "=========================================="

# Create reports directory
mkdir -p "$REPORTS_DIR"

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${YELLOW}⚠️  k6 not found, running simulated tests${NC}"
    USE_SIMULATED=true
else
    USE_SIMULATED=false
fi

# Function to run k6 test
run_k6_test() {
    local scenario=$1
    local output_file="$REPORTS_DIR/${scenario}-$(date +%Y%m%d-%H%M%S).json"
    
    if [ "$USE_SIMULATED" = true ]; then
        echo -e "${YELLOW}Running simulated $scenario test...${NC}"
        cd "$PERFORMANCE_DIR" && pnpm tsx src/cli.ts $scenario --url "$BASE_URL" --vus "$VUS" --duration "$DURATION"
    else
        echo -e "${GREEN}Running k6 $scenario test...${NC}"
        k6 run \
            -e BASE_URL="$BASE_URL" \
            -e VUS="$VUS" \
            -e DURATION="$DURATION" \
            --out json="$output_file" \
            "$PERFORMANCE_DIR/k6/scenarios/${scenario}.js"
    fi
}

# Run tests based on type
case $TEST_TYPE in
    smoke)
        echo -e "\n${GREEN}Running smoke test...${NC}"
        VUS=1 DURATION=10s run_k6_test "load-test"
        ;;
    load)
        echo -e "\n${GREEN}Running load test...${NC}"
        run_k6_test "load-test"
        ;;
    stress)
        echo -e "\n${GREEN}Running stress test...${NC}"
        run_k6_test "stress-test"
        ;;
    api)
        echo -e "\n${GREEN}Running API benchmark...${NC}"
        run_k6_test "api-benchmark"
        ;;
    full)
        echo -e "\n${GREEN}Running full test suite...${NC}"
        VUS=1 DURATION=10s run_k6_test "load-test"
        run_k6_test "load-test"
        run_k6_test "api-benchmark"
        ;;
    *)
        echo -e "${RED}Unknown test type: $TEST_TYPE${NC}"
        echo "Available types: smoke, load, stress, api, full"
        exit 1
        ;;
esac

echo -e "\n${GREEN}✅ Performance tests completed${NC}"
echo "Reports saved to: $REPORTS_DIR"

