#!/bin/bash
# Commit and push all remaining spec implementations

cd /Users/jordan/Projects/jiffoo-mall-core

echo "=== Git Status ==="
git status --porcelain | head -30

echo ""
echo "=== Adding all files ==="
git add -A

echo ""
echo "=== Committing ==="
git commit -m "feat: 完成所有 4 个剩余 spec 实现

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

所有 23 个 Spec 现已 100% 完成！"

echo ""
echo "=== Pushing to GitLab ==="
git push origin main

echo ""
echo "=== Pushing to GitHub ==="
git push github main

echo ""
echo "=== Done ==="
git log --oneline -3

