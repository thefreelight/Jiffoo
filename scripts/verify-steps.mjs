export const apiBuildStep = ['Build API', [['--filter', 'api', 'build']]];

export function localSteps(databaseUrl, quick = false, selectedArgument = [], selectedFiles = { api: [], admin: [], shop: [] }) {
return quick
  ? [
      ['Prisma generate', [['--filter', 'api', 'exec', 'prisma', 'generate']]],
      ['Type-check API, Shop and shared', [['--filter', 'shared', 'build'], ['exec', 'turbo', 'run', 'type-check', '--filter=api', '--filter=shop', '--filter=shared']]],
      ['Lint Shop', [['--filter', 'shop', 'lint']]],
      ['Reset test database', [['--filter', 'api', 'exec', 'prisma', 'migrate', 'reset', '--force', '--skip-seed']]],
      ...(selectedArgument.length
        ? Object.entries(selectedFiles).filter(([, files]) => files.length).map(([app, files]) => [`Run ${app === 'api' ? 'API' : app === 'admin' ? 'Admin' : 'Shop'} tests`, [['--filter', app, 'exec', 'vitest', 'run', ...files]]])
        : [
            ['Run changed API tests', [['--filter', 'api', 'exec', 'vitest', 'run', '--changed', '--passWithNoTests']]],
            ['Run Shop tests', [['--filter', 'shop', 'exec', 'vitest', 'run']]],
          ]),
    ]
  : [
      ['Install dependencies', [['install', '--frozen-lockfile']]],
      ['Validate and generate Prisma client', [['--filter', 'api', 'exec', 'prisma', 'validate'], ['--filter', 'api', 'exec', 'prisma', 'generate']]],
      ['Build shared package', [['--filter', 'shared', 'build']]],
      ['Build admin application', [['--filter', 'admin', 'build']]],
      ['Build Shop application', [['--filter', 'shop', 'build']]],
      ['Build plugin SDK', [['--filter', 'plugin-sdk', 'build']]],
      ['Type-check workspace', [['exec', 'turbo', 'run', 'type-check', '--continue=always', '--force']]],
      ['Lint Shop', [['--filter', 'shop', 'lint']]],
      ['Export OpenAPI', [['--filter', 'api', 'export:openapi']]],
      ['Reset test database', [['--filter', 'api', 'exec', 'prisma', 'migrate', 'reset', '--force', '--skip-seed']]],
      ['Check Prisma migration drift', [['--filter', 'api', 'exec', 'prisma', 'migrate', 'diff', '--from-url', databaseUrl, '--to-schema-datamodel', 'prisma/schema', '--exit-code']]],
      ['Run API tests', [['--filter', 'api', 'exec', 'vitest', 'run']]],
      ['Run Admin tests', [['--filter', 'admin', 'exec', 'vitest', 'run']]],
      ['Run Shop tests', [['--filter', 'shop', 'exec', 'vitest', 'run']]],
      ['Run browser E2E', [['verify:e2e']]],
    ];
}

export function ciSteps(databaseUrl, group, shard) {
  if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('CI selection requires GITHUB_ACTIONS === true.');
  if (!['api', 'quality', 'e2e'].includes(group)) throw new Error('Unknown CI group.');
  if (group === 'api' ? !/^[1-4]\/4$/.test(shard ?? '') : shard !== undefined) throw new Error('Only API groups accept a shard, from 1/4 to 4/4.');
  const common = new Set(['Install dependencies', 'Validate and generate Prisma client', 'Build shared package', 'Build plugin SDK', 'Reset test database', 'Check Prisma migration drift']);
  const tests = new Set(['Run API tests', 'Run Admin tests', 'Run Shop tests', 'Run browser E2E']);
  return localSteps(databaseUrl).filter(([name]) => common.has(name) || (group === 'api' ? name === 'Run API tests' : group === 'e2e' ? name === 'Run browser E2E' : !tests.has(name) || ['Run Admin tests', 'Run Shop tests'].includes(name)))
    .flatMap(step => group === 'quality' && step[0] === 'Build plugin SDK' ? [step, apiBuildStep] : [step])
    .map(([name, commands]) => [name, commands.map(args => name === 'Run API tests' ? [...args, `--shard=${shard}`] : [...args])]);
}

