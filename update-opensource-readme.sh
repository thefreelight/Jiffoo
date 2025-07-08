#!/bin/bash

# Script to update opensource repository README
echo "🔄 Updating opensource repository README..."

# Set environment to avoid vim
export EDITOR=true
export GIT_EDITOR=true

# Navigate to opensource repository
cd ../Jiffoo

# Check git status
echo "📊 Checking git status..."
git status --porcelain

# Add README changes
echo "📝 Adding README changes..."
git add README.md

# Commit with English message
echo "💾 Committing changes..."
git commit -m "docs: remove Chinese content from README for international open source project

- Remove all Chinese documentation sections
- Keep only English content for global accessibility
- Prepare for international open source community"

# Push to remote
echo "🚀 Pushing to remote repository..."
git push origin main

echo "✅ Opensource repository README updated successfully!"
