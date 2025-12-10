#!/bin/bash

# 🚀 Push to both GitLab and GitHub
# Usage: ./scripts/push-all.sh [branch]

set -e

BRANCH=${1:-main}

echo "🚀 Pushing to both GitLab and GitHub..."
echo "📦 Branch: $BRANCH"
echo ""

# Push to GitLab
echo "📤 Pushing to GitLab (git.lafdru.local)..."
if git push gitlab "$BRANCH"; then
    echo "✅ GitLab push successful"
else
    echo "❌ GitLab push failed"
    exit 1
fi

echo ""

# Push to GitHub
echo "📤 Pushing to GitHub (github.com)..."
if git push origin "$BRANCH"; then
    echo "✅ GitHub push successful"
else
    echo "❌ GitHub push failed"
    exit 1
fi

echo ""
echo "🎉 Successfully pushed to both repositories!"

