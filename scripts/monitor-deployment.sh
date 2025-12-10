#!/bin/bash

# 监控 GitHub Actions 部署状态
# 用法: ./scripts/monitor-deployment.sh <run_number>

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

GITHUB_TOKEN="${GITHUB_TOKEN:-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}"
RUN_NUMBER="${1:-168}"
CHECK_INTERVAL=30  # 每30秒检查一次

echo -e "${BLUE}🔍 开始监控 Run #${RUN_NUMBER} 部署状态...${NC}"
echo "开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

while true; do
  # 获取 Run 状态
  RESPONSE=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/thefreelight/jiffoo-mall-core/actions/runs" | \
    jq -r ".workflow_runs[] | select(.run_number == $RUN_NUMBER)")
  
  STATUS=$(echo "$RESPONSE" | jq -r '.status')
  CONCLUSION=$(echo "$RESPONSE" | jq -r '.conclusion')
  UPDATED=$(echo "$RESPONSE" | jq -r '.updated_at')
  
  CURRENT_TIME=$(date '+%H:%M:%S')
  
  echo -e "[$CURRENT_TIME] Run #${RUN_NUMBER} - Status: ${YELLOW}${STATUS}${NC}, Conclusion: ${CONCLUSION}"
  
  # 如果完成了，显示结果并退出
  if [ "$STATUS" = "completed" ]; then
    echo ""
    echo -e "${GREEN}✅ Run #${RUN_NUMBER} 已完成！${NC}"
    echo "结果: $CONCLUSION"
    echo "完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
    
    if [ "$CONCLUSION" = "success" ]; then
      echo ""
      echo -e "${GREEN}🎉 部署成功！现在可以验证 Pod 状态和服务访问。${NC}"
      exit 0
    else
      echo ""
      echo -e "${RED}❌ 部署失败！需要检查日志。${NC}"
      exit 1
    fi
  fi
  
  # 如果还在运行，继续等待
  if [ "$STATUS" = "in_progress" ]; then
    echo -e "   ${BLUE}⏳ 部署进行中...${NC}"
  elif [ "$STATUS" = "queued" ]; then
    echo -e "   ${YELLOW}⏸️  等待开始...${NC}"
  fi
  
  sleep $CHECK_INTERVAL
done

