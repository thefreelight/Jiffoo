#!/bin/bash

# Force kill any vim processes
sudo pkill -9 vim 2>/dev/null || true

# Set environment to avoid vim
export EDITOR=true
export GIT_EDITOR=true

echo "🔄 Committing README changes and syncing to opensource repository..."

# Add and commit README changes
git add README.md

git commit -m "docs: remove Chinese content from README for international open source project

- Remove all Chinese documentation sections
- Keep only English content for global accessibility
- Prepare for open source repository synchronization"

echo "✅ README changes committed"

# Check if opensource repository exists
OPENSOURCE_DIR="../Jiffoo"
if [ ! -d "$OPENSOURCE_DIR" ]; then
    echo "⚠️  Opensource repository directory not found: $OPENSOURCE_DIR"
    echo "Creating directory and cloning..."
    cd ..
    git clone https://github.com/thefreelight/Jiffoo.git
    cd jiffoo-mall-core
fi

echo "🚀 Running sync script..."
bash scripts/sync-to-opensource.sh

echo "✅ Sync completed!"
