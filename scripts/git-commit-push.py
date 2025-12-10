#!/usr/bin/env python3
"""Git commit and push script"""

import subprocess
import os

os.chdir('/Users/jordan/Projects/jiffoo-mall-core')

# Check status
print("=== Git Status ===")
result = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True)
print(result.stdout or "No changes")
print(result.stderr)

if not result.stdout.strip():
    print("\nNo changes to commit!")
    exit(0)

# Add all files
print("\n=== Adding files ===")
result = subprocess.run(['git', 'add', '-A'], capture_output=True, text=True)
print(result.stdout)
print(result.stderr)

# Commit
print("\n=== Committing ===")
commit_msg = """feat: 完成所有 4 个剩余 spec 实现

新增功能:

1. commercial-plugins (100%)
   - License Service (apps/api/src/services/license/)
   - License API routes (apps/api/src/core/admin/license-management/)
   - PluginLicense Prisma model

2. cms-plugin (100%)
   - CMS plugin (extensions/plugins/cms/)
   - Posts/Pages CRUD API
   - CMS Prisma models

3. i18n-plugin (100%)
   - i18n plugin (extensions/plugins/i18n/)
   - Languages/Translations CRUD API
   - i18n Prisma models (I18nLanguage, I18nTranslation)
   - RTL language support

4. backup-disaster-recovery (100%)
   - Database backup service (packages/shared/src/backup/)
   - Retention manager
   - Backup API routes (apps/api/src/core/admin/backup/)

所有 23 个 Spec 现已 100% 完成！"""

result = subprocess.run(['git', 'commit', '-m', commit_msg], capture_output=True, text=True)
print(result.stdout)
print(result.stderr)

# Push to GitLab
print("\n=== Pushing to GitLab ===")
result = subprocess.run(['git', 'push', 'origin', 'main'], capture_output=True, text=True)
print(result.stdout)
print(result.stderr)

# Push to GitHub
print("\n=== Pushing to GitHub ===")
result = subprocess.run(['git', 'push', 'github', 'main'], capture_output=True, text=True)
print(result.stdout)
print(result.stderr)

# Show recent commits
print("\n=== Recent Commits ===")
result = subprocess.run(['git', 'log', '--oneline', '-5'], capture_output=True, text=True)
print(result.stdout)

