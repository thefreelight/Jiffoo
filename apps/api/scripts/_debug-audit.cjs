const { readFileSync, readdirSync, statSync } = require('fs');
const { join, extname } = require('path');
const SRC_DIR = 'apps/api/src';
const SCHEMA_DIR = 'apps/api/prisma/schema';

let content = '';
for (const file of readdirSync(SCHEMA_DIR)) {
  if (file.endsWith('.prisma')) {
    content += readFileSync(join(SCHEMA_DIR, file), 'utf-8') + '\n';
  }
}
const models = [];
const regex = /^model\s+(\w+)\s+\{/gm;
let match;
while ((match = regex.exec(content)) !== null) models.push(match[1]);
console.log('Models:', models.length);

function getAllTsFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) results.push(...getAllTsFiles(fullPath));
    else if (['.ts','.tsx'].includes(extname(fullPath))) results.push(fullPath);
  }
  return results;
}
const files = getAllTsFiles(SRC_DIR);
console.log('TS files scanned:', files.length);

for (const model of models.slice(0, 10)) {
  let count = 0;
  let fileCount = 0;
  for (const file of files) {
    const fc = readFileSync(file, 'utf-8');
    const re = new RegExp('prisma\\.' + model + '\\b', 'g');
    const matches = fc.match(re);
    if (matches) { count += matches.length; fileCount++; }
  }
  console.log(model + ': prisma.* refs=' + count + ', files=' + fileCount);
}
