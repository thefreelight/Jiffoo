import fs from 'node:fs/promises';
import path from 'node:path';

const DIST_ROOT = path.resolve(process.cwd(), 'dist');

const REPLACEMENTS = [
  {
    relativePath: path.join('apps', 'api', 'src', 'config', 'database.js'),
    from: 'require("../../../../../node_modules")',
    to: 'require("@prisma/client")',
  },
  {
    relativePath: path.join('apps', 'api', 'src', 'server.js'),
    from: 'require("../../../../node_modules")',
    to: 'require("fastify")',
  },
];

async function patchFile(relativePath, from, to) {
  const filePath = path.join(DIST_ROOT, relativePath);
  let content;
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch {
    return;
  }

  if (!content.includes(from)) {
    return;
  }

  await fs.writeFile(filePath, content.replaceAll(from, to), 'utf8');
}

async function main() {
  for (const replacement of REPLACEMENTS) {
    await patchFile(replacement.relativePath, replacement.from, replacement.to);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
