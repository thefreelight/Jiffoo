#!/bin/bash

# Force kill any vim processes
sudo pkill -9 vim 2>/dev/null || true

# Set environment to avoid vim
export EDITOR=true
export GIT_EDITOR=true

echo "Aborting git rebase..."
git rebase --abort

echo "Checking git status..."
git status

echo "Checking current commit..."
git log --oneline -1

echo "Done!"
