#!/bin/bash

# Simple commit script to avoid vim issues
export EDITOR=true
export GIT_EDITOR=true

echo "📝 Committing README changes..."

# Use git commit with -m to avoid opening editor
git commit -m "docs: remove Chinese content from README for international open source project

- Remove all Chinese documentation sections
- Keep only English content for global accessibility  
- Prepare for open source repository synchronization"

echo "✅ Commit completed!"

# Show the commit
git log --oneline -1

echo "🚀 Ready for synchronization!"
