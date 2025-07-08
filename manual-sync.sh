#!/bin/bash

echo "🔄 Manual sync to opensource repository..."

# Kill any existing vim processes
sudo pkill -9 vim 2>/dev/null || true

# Set environment to avoid vim
export EDITOR=true
export GIT_EDITOR=true

echo "📝 Copying updated files to opensource repository..."

# Copy README
cp README.md ../Jiffoo/README.md

echo "✅ Files copied successfully!"

# Navigate to opensource repository
cd ../Jiffoo

echo "📊 Checking git status..."
git status --porcelain

echo "📝 Adding changes..."
git add .

echo "💾 Committing changes..."
git -c core.editor=true commit -m "docs: remove Chinese content from README for international open source project

- Remove all Chinese documentation sections  
- Keep only English content for global accessibility
- Prepare for international open source community
- Ensure consistent documentation across repositories"

echo "🚀 Pushing to remote..."
git push origin main

echo "✅ Sync completed successfully!"

# Return to original directory
cd ../jiffoo-mall-core

echo "🎉 All done! Opensource repository has been updated."
