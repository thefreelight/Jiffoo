FROM crpi-si4hvlqhabu9zjq7.ap-southeast-1.personal.cr.aliyuncs.com/jiffoo-oss/api:dev-ef3e6481-oss-manifest-api3

RUN node <<'NODE'
const fs = require('fs');

const patches = [
  {
    file: '/app/apps/api/src/core/admin/theme-management/service.ts',
    needle: `  if (theme.source !== 'official-market' || theme.type !== 'pack') {
    return;
  }
`,
    insert: `  if (theme.source !== 'official-market' || theme.type !== 'pack') {
    return;
  }

  const normalizedSlug = normalizeThemeSlug(theme.slug);
  if (
    target === 'shop' &&
    (normalizedSlug === 'yevbi' || normalizedSlug === 'esim-mall' || normalizedSlug === 'imagic-studio')
  ) {
    return;
  }
`,
  },
  {
    file: '/app/apps/api/dist/core/admin/theme-management/service.js',
    needle: `    if (theme.source !== 'official-market' || theme.type !== 'pack') {
        return;
    }
`,
    insert: `    if (theme.source !== 'official-market' || theme.type !== 'pack') {
        return;
    }
    const normalizedSlug = normalizeThemeSlug(theme.slug);
    if (target === 'shop' &&
        (normalizedSlug === 'yevbi' || normalizedSlug === 'esim-mall' || normalizedSlug === 'imagic-studio')) {
        return;
    }
`,
  },
];

for (const patch of patches) {
  let source = fs.readFileSync(patch.file, 'utf8');
  if (source.includes(`normalizedSlug === 'esim-mall'`)) {
    continue;
  }
  if (!source.includes(patch.needle)) {
    throw new Error(`Patch needle not found in ${patch.file}`);
  }
  source = source.replace(patch.needle, patch.insert);
  fs.writeFileSync(patch.file, source);
}
NODE
