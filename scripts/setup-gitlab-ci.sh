#!/bin/bash
# Jiffoo Opensource - GitLab CI/CD Variables Setup Script
# Usage: ./scripts/setup-gitlab-ci.sh

set -e

# === Configuration ===
GITLAB_URL="https://git.lafdru.local"
PROJECT_PATH="lafdru/Jiffoo"
PROJECT_PATH_ENCODED="lafdru%2FJiffoo"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  🚀 Jiffoo Opensource - GitLab CI/CD Setup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# === Step 1: Get GitLab Token ===
echo -e "\n${YELLOW}Step 1: GitLab Personal Access Token${NC}"
echo "Create a token at: ${GITLAB_URL}/-/user_settings/personal_access_tokens"
echo "Required scopes: api, read_api"
echo ""
read -p "Enter your GitLab Personal Access Token: " GITLAB_TOKEN

if [ -z "$GITLAB_TOKEN" ]; then
  echo -e "${RED}Error: Token is required${NC}"
  exit 1
fi

# === Step 2: Get Feishu Webhook URL ===
echo -e "\n${YELLOW}Step 2: Feishu Webhook URL${NC}"
echo "Create a webhook bot in Feishu/Lark Group Settings"
echo "Example: https://open.feishu.cn/open-apis/bot/v2/hook/xxx-xxx-xxx"
echo ""
read -p "Enter Feishu Webhook URL (or press Enter to skip): " FEISHU_WEBHOOK_URL

# === Step 3: Prepare Kubeconfig ===
echo -e "\n${YELLOW}Step 3: Preparing Kubeconfig${NC}"

KUBECONFIG_FILE=~/.kube/config
if [ ! -f "$KUBECONFIG_FILE" ]; then
  echo -e "${RED}Error: Kubeconfig not found at $KUBECONFIG_FILE${NC}"
  exit 1
fi

KUBECONFIG_CONTENT=$(cat "$KUBECONFIG_FILE" | base64 | tr -d '\n')
echo -e "${GREEN}✓ Kubeconfig encoded${NC}"

# === Step 4: Create GitLab Variables ===
echo -e "\n${YELLOW}Step 4: Creating GitLab CI/CD Variables${NC}"

API_URL="$GITLAB_URL/api/v4/projects/$PROJECT_PATH_ENCODED/variables"

create_variable() {
  local key=$1
  local value=$2
  local protected=${3:-false}
  local masked=${4:-false}
  
  curl -s -k --request DELETE \
    --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    "$API_URL/$key" 2>/dev/null || true
  
  response=$(curl -s -k --request POST \
    --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    --form "key=$key" \
    --form "value=$value" \
    --form "protected=$protected" \
    --form "masked=$masked" \
    "$API_URL")
  
  if echo "$response" | grep -q '"key"'; then
    echo -e "  ${GREEN}✓${NC} $key"
  else
    echo -e "  ${RED}✗${NC} $key - Failed"
  fi
}

echo "Creating variables..."
create_variable "KUBECONFIG_CONTENT" "$KUBECONFIG_CONTENT" false true

if [ -n "$FEISHU_WEBHOOK_URL" ]; then
  create_variable "FEISHU_WEBHOOK_URL" "$FEISHU_WEBHOOK_URL" false true
fi

echo -e "\n${GREEN}✅ Setup Complete!${NC}"
echo ""
echo "Next: git push gitlab main"
