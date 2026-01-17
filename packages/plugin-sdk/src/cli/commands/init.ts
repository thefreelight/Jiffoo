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

const TEMPLATES = {
  basic: 'Basic plugin with minimal setup',
  payment: 'Payment gateway integration',
  email: 'Email service integration',
  integration: 'Third-party API integration',
  analytics: 'Analytics and tracking',
  shipping: 'Shipping provider integration',
};

export async function initCommand(name: string | undefined, options: InitOptions) {
  console.log(chalk.blue('\n🚀 Jiffoo Plugin SDK - Create New Plugin\n'));

  // Interactive prompts if name not provided
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Plugin name:',
      default: name || 'my-jiffoo-plugin',
      when: !name,
      validate: (input: string) => {
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Plugin name must be lowercase alphanumeric with hyphens';
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
      default: 'A Jiffoo Mall plugin',
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author:',
    },
    {
      type: 'list',
      name: 'template',
      message: 'Template:',
      choices: Object.entries(TEMPLATES).map(([value, name]) => ({ name, value })),
      when: !options.template || options.template === 'basic',
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
    },
  ]);

  const pluginName = answers.name || name || 'my-jiffoo-plugin';
  const template = answers.template || options.template;
  const targetDir = options.directory || path.join(process.cwd(), pluginName);

  // Check if directory exists
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
    // Create directory structure
    await fs.ensureDir(targetDir);
    await fs.ensureDir(path.join(targetDir, 'src'));
    await fs.ensureDir(path.join(targetDir, 'src', 'routes'));
    await fs.ensureDir(path.join(targetDir, 'src', 'services'));
    await fs.ensureDir(path.join(targetDir, 'tests'));

    // Create manifest.json
    const manifest = {
      slug: pluginName,
      name: answers.displayName,
      version: '1.0.0',
      description: answers.description,
      author: answers.author,
      category: answers.category,
      capabilities: getCapabilitiesForCategory(answers.category),
      license: 'GPL-3.0',
      homepage: '',
      repository: '',
      configSchema: {},
    };
    await fs.writeJson(path.join(targetDir, 'manifest.json'), manifest, { spaces: 2 });

    // Create package.json
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
        '@jiffoo/plugin-sdk': '^1.0.0',
      },
      devDependencies: options.typescript ? {
        typescript: '^5.0.0',
        '@types/node': '^20.0.0',
        vitest: '^1.6.0',
      } : {
        vitest: '^1.6.0',
      },
      license: 'GPL-3.0',
    };
    await fs.writeJson(path.join(targetDir, 'package.json'), packageJson, { spaces: 2 });

    // Create TypeScript config if needed
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

    // Create main entry file
    const ext = options.typescript ? 'ts' : 'js';
    const mainContent = generateMainFile(pluginName, answers.category, options.typescript);
    await fs.writeFile(path.join(targetDir, 'src', `index.${ext}`), mainContent);

    // Create example route
    const routeContent = generateRouteFile(answers.category, options.typescript);
    await fs.writeFile(path.join(targetDir, 'src', 'routes', `api.${ext}`), routeContent);

    // Create README
    const readme = generateReadme(pluginName, answers.displayName, answers.description);
    await fs.writeFile(path.join(targetDir, 'README.md'), readme);

    // Create .gitignore
    const gitignore = `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
`;
    await fs.writeFile(path.join(targetDir, '.gitignore'), gitignore);

    // Create LICENSE (GPL-3.0)
    const license = `GNU GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

Copyright (C) ${new Date().getFullYear()} ${answers.author}

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
`;
    await fs.writeFile(path.join(targetDir, 'LICENSE'), license);

    spinner.succeed(chalk.green('Plugin project created successfully!'));

    console.log(`
${chalk.cyan('Next steps:')}

  ${chalk.yellow('cd')} ${pluginName}
  ${chalk.yellow('npm install')}
  ${chalk.yellow('npm run dev')}

${chalk.cyan('Useful commands:')}

  ${chalk.yellow('npm run dev')}       Start development server
  ${chalk.yellow('npm run build')}     Build for production
  ${chalk.yellow('npm run validate')}  Validate manifest
  ${chalk.yellow('npm run pack')}      Package for submission

${chalk.cyan('Documentation:')} https://docs.jiffoo.com/developer/plugin-development
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

function generateMainFile(name: string, category: string, typescript: boolean): string {
  const types = typescript ? `: PluginContext` : '';
  const importTypes = typescript ? `import type { PluginContext } from '@jiffoo/plugin-sdk';\n` : '';

  return `/**
 * ${name} - Jiffoo Plugin
 */

import {
  verifySignature,
  getContext,
  createSignatureMiddleware,
  createContextMiddleware,
} from '@jiffoo/plugin-sdk';
${importTypes}
import express from 'express';
import { apiRoutes } from './routes/api';

const app = express();
const PORT = process.env.PORT || 3001;
const SHARED_SECRET = process.env.JIFFOO_SHARED_SECRET || 'dev-secret';

// Middleware
app.use(express.json());

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Plugin manifest (no auth required)
app.get('/manifest', (req, res) => {
  res.json(require('../manifest.json'));
});

// Protected routes - require signature verification
app.use('/api', createSignatureMiddleware(SHARED_SECRET));
app.use('/api', createContextMiddleware());
app.use('/api', apiRoutes);

// Install hook
app.post('/install', createSignatureMiddleware(SHARED_SECRET), async (req, res) => {
  const { installationId, config } = req.body;
  console.log(\`Plugin installed for installation \${installationId}\`);
  
  // TODO: Initialize plugin for this installation
  // - Store configuration
  // - Set up webhooks
  // - Initialize resources
  
  res.json({ success: true, message: 'Plugin installed successfully' });
});

// Uninstall hook
app.post('/uninstall', createSignatureMiddleware(SHARED_SECRET), async (req, res) => {
  const { installationId, reason } = req.body;
  console.log(\`Plugin uninstalled for installation \${installationId}: \${reason}\`);
  
  // TODO: Clean up plugin resources
  // - Remove stored data
  // - Cancel webhooks
  // - Release resources
  
  res.json({ success: true, message: 'Plugin uninstalled successfully' });
});

// Start server
app.listen(PORT, () => {
  console.log(\`🚀 ${name} plugin running on port \${PORT}\`);
  console.log(\`   Health: http://localhost:\${PORT}/health\`);
  console.log(\`   Manifest: http://localhost:\${PORT}/manifest\`);
});

export default app;
`;
}

function generateRouteFile(category: string, typescript: boolean): string {
  const types = typescript ? `: express.Request & { pluginContext?: PluginContext }` : '';
  const resType = typescript ? `: express.Response` : '';
  const importTypes = typescript ? `import type { PluginContext } from '@jiffoo/plugin-sdk';\n` : '';

  return `/**
 * API Routes
 */

import express from 'express';
${importTypes}
const router = express.Router();

// Example endpoint
router.get('/status', (req${types}, res${resType}) => {
  const context = req.pluginContext;
  
  res.json({
    success: true,
    data: {
      installationId: context?.installationId,
      environment: context?.environment,
      status: 'active',
    },
  });
});

// Example POST endpoint
router.post('/action', async (req${types}, res${resType}) => {
  const context = req.pluginContext;
  const { action, data } = req.body;
  
  try {
    // TODO: Implement your plugin logic here
    console.log(\`Action: \${action} for installation \${context?.installationId}\`);
    
    res.json({
      success: true,
      data: {
        action,
        result: 'completed',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Action failed',
    });
  }
});

export const apiRoutes = router;
`;
}

function generateReadme(name: string, displayName: string, description: string): string {
  return `# ${displayName}

${description}

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

This starts the development server on port 3001.

## Configuration

Create a \`.env\` file:

\`\`\`env
PORT=3001
JIFFOO_SHARED_SECRET=your-shared-secret
\`\`\`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Health check |
| /manifest | GET | Plugin manifest |
| /install | POST | Installation hook |
| /uninstall | POST | Uninstallation hook |
| /api/status | GET | Plugin status |
| /api/action | POST | Execute action |

## Building

\`\`\`bash
npm run build
\`\`\`

## Packaging for Submission

\`\`\`bash
npm run pack
\`\`\`

## License

GPL-3.0
`;
}
