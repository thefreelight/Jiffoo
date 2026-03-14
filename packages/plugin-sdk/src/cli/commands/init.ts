/**
 * Init Command - Create new plugin project
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

interface InitOptions {
  template: string;
  directory?: string;
  typescript: boolean;
}

type TemplateName = 'basic' | 'payment' | 'email' | 'integration' | 'analytics' | 'shipping';

const TEMPLATES: Record<TemplateName, string> = {
  basic: 'Basic external-http plugin scaffold',
  payment: 'Payment plugin scaffold (provider-neutral flow)',
  email: 'Email service integration',
  integration: 'Third-party API integration',
  analytics: 'Analytics and tracking',
  shipping: 'Shipping provider integration',
};

export async function initCommand(name: string | undefined, options: InitOptions) {
  console.log(chalk.blue('\nJiffoo Plugin SDK - Create New Plugin\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Plugin slug:',
      default: name || 'my-jiffoo-plugin',
      when: !name,
      validate: (input: string) => {
        if (!/^[a-z][a-z0-9-]{0,30}[a-z0-9]$/.test(input)) {
          return 'Slug must match ^[a-z][a-z0-9-]{0,30}[a-z0-9]$';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'displayName',
      message: 'Display name:',
      default: (ans: any) => {
        const n = ans.name || name || 'my-jiffoo-plugin';
        return n.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: 'A Jiffoo plugin',
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author:',
      default: 'Jiffoo Developer',
    },
    {
      type: 'list',
      name: 'template',
      message: 'Template:',
      choices: Object.entries(TEMPLATES).map(([value, label]) => ({ name: label, value })),
      default: options.template || 'basic',
    },
    {
      type: 'list',
      name: 'runtimeType',
      message: 'Runtime type:',
      choices: [
        {
          name: 'external-http (recommended, independent service)',
          value: 'external-http',
        },
        {
          name: 'internal-fastify (in-process, advanced use only)',
          value: 'internal-fastify',
        },
      ],
      default: 'external-http',
    },
    {
      type: 'input',
      name: 'devPort',
      message: 'Local development port:',
      default: 4100,
      filter: (v: string) => Number(v),
      validate: (v: number) => Number.isInteger(v) && v > 0 && v < 65536,
      when: (ans: any) => ans.runtimeType === 'external-http',
    },
    {
      type: 'list',
      name: 'category',
      message: 'Category:',
      choices: [
        { name: 'Payment', value: 'payment' },
        { name: 'Email', value: 'email' },
        { name: 'Integration', value: 'integration' },
        { name: 'Analytics', value: 'analytics' },
        { name: 'Marketing', value: 'marketing' },
        { name: 'Shipping', value: 'shipping' },
        { name: 'SEO', value: 'seo' },
        { name: 'Other', value: 'other' },
      ],
      default: (ans: any) => getDefaultCategoryForTemplate(ans.template || options.template || 'basic'),
    },
  ]);

  const pluginName = answers.name || name || 'my-jiffoo-plugin';
  const template: TemplateName = answers.template as TemplateName;
  const runtimeType = answers.runtimeType as 'external-http' | 'internal-fastify';
  const targetDir = options.directory || path.join(process.cwd(), pluginName);

  if (await fs.pathExists(targetDir)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Directory ${pluginName} already exists. Overwrite?`,
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.yellow('Aborted.'));
      return;
    }
    await fs.remove(targetDir);
  }

  const spinner = ora('Creating plugin project...').start();

  try {
    await fs.ensureDir(targetDir);
    await fs.ensureDir(path.join(targetDir, 'src'));
    await fs.ensureDir(path.join(targetDir, 'src', 'routes'));
    await fs.ensureDir(path.join(targetDir, 'tests'));

    const manifest: Record<string, unknown> = {
      schemaVersion: 1,
      slug: pluginName,
      name: answers.displayName,
      version: '1.0.0',
      description: answers.description,
      author: answers.author,
      category: answers.category,
      runtimeType,
      permissions: getPermissionsForCategory(answers.category),
      capabilities: getCapabilitiesForCategory(answers.category),
      configSchema: getConfigSchema(template),
    };

    if (runtimeType === 'external-http') {
      manifest.externalBaseUrl = `http://127.0.0.1:${answers.devPort || 4100}`;
    } else {
      manifest.entryModule = options.typescript ? 'dist/index.js' : 'src/index.js';
    }

    await fs.writeJson(path.join(targetDir, 'manifest.json'), manifest, { spaces: 2 });

    const packageJson = {
      name: pluginName,
      version: '1.0.0',
      description: answers.description,
      main: options.typescript ? 'dist/index.js' : 'src/index.js',
      scripts: {
        dev: 'jiffoo-plugin dev',
        build: options.typescript ? 'tsc' : 'echo "No build step for JS"',
        validate: 'jiffoo-plugin validate',
        pack: 'jiffoo-plugin pack',
        test: 'vitest run',
      },
      dependencies: {
        express: '^4.21.2',
        '@jiffoo/plugin-sdk': '^1.1.0',
      },
      devDependencies: options.typescript
        ? {
          typescript: '^5.0.0',
          tsx: '^4.20.3',
          '@types/node': '^20.0.0',
          '@types/express': '^4.17.21',
          vitest: '^1.6.0',
        }
        : {
          vitest: '^1.6.0',
        },
      license: 'GPL-3.0',
    };
    await fs.writeJson(path.join(targetDir, 'package.json'), packageJson, { spaces: 2 });

    if (options.typescript) {
      const tsconfig = {
        compilerOptions: {
          target: 'ES2020',
          module: 'CommonJS',
          moduleResolution: 'node',
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          declaration: true,
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist'],
      };
      await fs.writeJson(path.join(targetDir, 'tsconfig.json'), tsconfig, { spaces: 2 });
    }

    const ext = options.typescript ? 'ts' : 'js';
    await fs.writeFile(
      path.join(targetDir, 'src', `index.${ext}`),
      generateMainFile(pluginName, template, options.typescript)
    );
    await fs.writeFile(
      path.join(targetDir, 'src', 'routes', `api.${ext}`),
      generateRouteFile(template, options.typescript)
    );
    await fs.writeFile(
      path.join(targetDir, 'README.md'),
      generateReadme(pluginName, answers.displayName, answers.description, runtimeType)
    );
    await fs.writeFile(path.join(targetDir, 'LICENSE'), generateLicense());
    await fs.writeFile(
      path.join(targetDir, '.gitignore'),
      'node_modules/\ndist/\n.env\n.env.local\n*.log\n.DS_Store\n'
    );

    spinner.succeed(chalk.green('Plugin project created successfully.'));

    console.log(`
${chalk.cyan('Next steps:')}
  ${chalk.yellow('cd')} ${pluginName}
  ${chalk.yellow('npm install')}
  ${chalk.yellow('npm run validate')}
  ${chalk.yellow('npm run dev')}

${chalk.cyan('Important:')}
  1. Edit ${chalk.yellow('manifest.json')} and set ${chalk.yellow('externalBaseUrl')} to your real plugin service URL before installing ZIP.
  2. Install via platform API: ${chalk.yellow('POST /api/extensions/plugin/install')}.
  3. Call through gateway: ${chalk.yellow('/api/extensions/plugin/<slug>/api/*')}.
`);
  } catch (error) {
    spinner.fail(chalk.red('Failed to create plugin project'));
    console.error(error);
    process.exit(1);
  }
}

function getCapabilitiesForCategory(category: string): string[] {
  const capabilities: Record<string, string[]> = {
    payment: ['payment.process', 'payment.refund'],
    email: ['email.send', 'email.template'],
    integration: ['webhook.receive', 'webhook.send'],
    analytics: ['analytics.track', 'analytics.report'],
    marketing: ['email.send', 'analytics.track'],
    shipping: ['shipping.calculate', 'shipping.track'],
    seo: ['seo.sitemap', 'seo.meta'],
    other: ['webhook.receive'],
  };
  return capabilities[category] || ['webhook.receive'];
}

function getPermissionsForCategory(category: string): string[] {
  const permissions: Record<string, string[]> = {
    payment: ['payments:write', 'orders:read'],
    email: ['customers:read'],
    integration: [],
    analytics: ['orders:read'],
    marketing: ['customers:read', 'orders:read'],
    shipping: ['orders:read'],
    seo: [],
    other: [],
  };
  return permissions[category] || [];
}

function getConfigSchema(template: TemplateName): Record<string, unknown> {
  if (template === 'payment') {
    return {
      publishableKey: { type: 'string', label: 'Publishable Key', required: true },
      secretKey: { type: 'secret', label: 'Secret Key', required: true },
      webhookSecret: { type: 'secret', label: 'Webhook Secret', required: true },
    };
  }
  return {};
}

function getDefaultCategoryForTemplate(template: string): string {
  const mapping: Record<string, string> = {
    payment: 'payment',
    email: 'email',
    integration: 'integration',
    analytics: 'analytics',
    shipping: 'shipping',
  };
  return mapping[template] || 'other';
}

function generateMainFile(name: string, template: TemplateName, typescript: boolean): string {
  const importTypes = typescript ? "import type { PluginContext } from '@jiffoo/plugin-sdk';\n" : '';
  const reqType = typescript ? ': express.Request & { pluginContext?: PluginContext }' : '';
  const resType = typescript ? ': express.Response' : '';
  const helperComment =
    template === 'payment'
      ? '// Payment template: implement provider calls in routes/api and keep /api path contract stable.'
      : '// Basic template: add business endpoints under /api and keep manifest permissions aligned.';

  return `/**
 * ${name} - Jiffoo Plugin
 */

import express from 'express';
import { createContextMiddleware } from '@jiffoo/plugin-sdk';
${importTypes}import { apiRoutes } from './routes/api';

const app = express();
const PORT = process.env.PORT || 4100;
const SHARED_SECRET = process.env.JIFFOO_SHARED_SECRET;

// Validate required environment variables
if (!SHARED_SECRET) {
  throw new Error('JIFFOO_SHARED_SECRET environment variable is required');
}

app.use(express.json());

app.get('/health', (req${reqType}, res${resType}) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/manifest', (req${reqType}, res${resType}) => {
  res.json(require('../manifest.json'));
});

// Gateway-injected context headers are validated here.
app.use('/api', createContextMiddleware());
${helperComment}
app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log('[plugin] ${name} running on port ' + PORT);
});

export default app;
`;
}

function generateRouteFile(template: TemplateName, typescript: boolean): string {
  const importTypes = typescript ? "import type { PluginContext } from 'jiffoo-plugin-sdk';\n" : '';
  const reqType = typescript ? ': express.Request & { pluginContext?: PluginContext }' : '';
  const resType = typescript ? ': express.Response' : '';

  if (template === 'payment') {
    return `/**
 * Payment API Routes
 */

import express from 'express';
${importTypes}const router = express.Router();

router.post('/payments/create-session', async (req${reqType}, res${resType}) => {
  const ctx = req.pluginContext;
  const { orderId, amount, currency, successUrl, cancelUrl } = req.body || {};

  // TODO: Call your payment provider SDK here (PayPal/Stripe/Adyen/etc).
  res.json({
    success: true,
    data: {
      provider: 'custom-payment-provider',
      installationId: ctx?.installationId,
      orderId,
      amount,
      currency: currency || 'USD',
      url: successUrl || cancelUrl || '',
      sessionId: 'mock_session_' + Date.now(),
    },
  });
});

router.post('/payments/refund', async (req${reqType}, res${resType}) => {
  const { paymentId, amount } = req.body || {};
  res.json({
    success: true,
    data: { paymentId, amount, status: 'pending' },
  });
});

router.post('/webhooks/payment', async (req${reqType}, res${resType}) => {
  // TODO: Verify provider webhook signature.
  // TODO: Map provider event to platform payment state and call platform API.
  res.json({ received: true });
});

export const apiRoutes = router;
`;
  }

  return `/**
 * Generic API Routes
 */

import express from 'express';
${importTypes}const router = express.Router();

router.get('/status', (req${reqType}, res${resType}) => {
  const ctx = req.pluginContext;
  res.json({
    success: true,
    data: {
      installationId: ctx?.installationId,
      pluginSlug: ctx?.pluginSlug,
      status: 'active',
    },
  });
});

router.post('/action', async (req${reqType}, res${resType}) => {
  const { action } = req.body || {};
  res.json({
    success: true,
    data: { action, result: 'ok' },
  });
});

export const apiRoutes = router;
`;
}

function generateReadme(
  name: string,
  displayName: string,
  description: string,
  runtimeType: 'external-http' | 'internal-fastify'
): string {
  return `# ${displayName}

${description}

## Runtime

- \`runtimeType\`: \`${runtimeType}\`
- Gateway path: \`/api/extensions/plugin/${name}/api/*\`

## Development

\`\`\`bash
npm install
npm run validate
npm run dev
\`\`\`

## Notes

1. Keep \`manifest.json\` aligned with platform installer rules:
   - \`schemaVersion: 1\`
   - \`runtimeType\`
   - \`permissions\` (required, can be \`[]\`)
2. For \`external-http\`, set a reachable \`externalBaseUrl\` before installing ZIP.
3. Platform injects context headers such as:
   - \`x-platform-id\`
   - \`x-plugin-slug\`
   - \`x-installation-id\`
   - \`x-user-id\`, \`x-user-role\`, \`x-request-id\`, \`x-caller\`

**REQUIRED:** Create a \`.env\` file with your shared secret:

\`\`\`env
PORT=4100
JIFFOO_SHARED_SECRET=your-secure-random-secret-here
\`\`\`

**Security Note:** Never commit your .env file or use predictable secrets.
Generate a secure random secret with: \`openssl rand -hex 32\`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Health check |
| /manifest | GET | Plugin manifest |
| /install | POST | Installation hook |
| /uninstall | POST | Uninstallation hook |
| /api/status | GET | Plugin status |
| /api/action | POST | Execute action |

## Packaging & Building

\`\`\`bash
npm run build
npm run pack
\`\`\`
`;
}

function generateLicense(): string {
  return `GNU GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

This project is licensed under GPL-3.0.
`;
}
