/**
 * Init Command - Create new theme project
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
  basic: 'Basic theme with minimal setup',
  minimal: 'Minimalist design theme',
  modern: 'Modern, clean design theme',
  luxury: 'Luxury/premium design theme',
  fashion: 'Fashion-focused theme',
};

export async function initCommand(name: string | undefined, options: InitOptions) {
  console.log(chalk.blue('\n🎨 Jiffoo Theme SDK - Create New Theme\n'));

  // Interactive prompts if name not provided
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Theme name:',
      default: name || 'my-jiffoo-theme',
      when: !name,
      validate: (input: string) => {
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Theme name must be lowercase alphanumeric with hyphens';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'displayName',
      message: 'Display name:',
      default: (ans: any) => {
        const n = ans.name || name || 'my-jiffoo-theme';
        return n.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      },
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: 'A Jiffoo Mall theme',
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
        { name: 'General', value: 'general' },
        { name: 'Fashion', value: 'fashion' },
        { name: 'Electronics', value: 'electronics' },
        { name: 'Food', value: 'food' },
        { name: 'Home', value: 'home' },
        { name: 'Beauty', value: 'beauty' },
        { name: 'Sports', value: 'sports' },
        { name: 'Minimal', value: 'minimal' },
        { name: 'Luxury', value: 'luxury' },
      ],
    },
    {
      type: 'input',
      name: 'primaryColor',
      message: 'Primary color (hex):',
      default: '#3b82f6',
      validate: (input: string) => {
        if (!/^#[0-9a-fA-F]{6}$/.test(input)) {
          return 'Please enter a valid hex color (e.g., #3b82f6)';
        }
        return true;
      },
    },
  ]);

  const themeName = answers.name || name || 'my-jiffoo-theme';
  const targetDir = options.directory || path.join(process.cwd(), themeName);

  // Check if directory exists
  if (await fs.pathExists(targetDir)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Directory ${themeName} already exists. Overwrite?`,
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.yellow('Aborted.'));
      return;
    }
    await fs.remove(targetDir);
  }

  const spinner = ora('Creating theme project...').start();

  try {
    // Create directory structure
    await fs.ensureDir(targetDir);
    await fs.ensureDir(path.join(targetDir, 'src'));
    await fs.ensureDir(path.join(targetDir, 'src', 'components'));
    await fs.ensureDir(path.join(targetDir, 'src', 'pages'));
    await fs.ensureDir(path.join(targetDir, 'src', 'styles'));
    await fs.ensureDir(path.join(targetDir, 'public'));
    await fs.ensureDir(path.join(targetDir, 'public', 'images'));

    // Create manifest.json
    const manifest = {
      slug: themeName,
      name: answers.displayName,
      version: '1.0.0',
      description: answers.description,
      author: answers.author,
      category: answers.category,
      thumbnail: '/themes/' + themeName + '/thumbnail.png',
      screenshots: [],
      features: ['Responsive design', 'Dark mode support', 'Customizable colors'],
      tags: [answers.category, 'responsive', 'modern'],
      license: 'GPL-3.0',
      tokens: {
        colors: {
          primary: answers.primaryColor,
          primaryForeground: '#ffffff',
          secondary: '#64748b',
          secondaryForeground: '#ffffff',
          background: '#ffffff',
          foreground: '#0f172a',
          muted: '#f1f5f9',
          mutedForeground: '#64748b',
          border: '#e2e8f0',
          ring: answers.primaryColor,
        },
        typography: {
          fontFamily: {
            sans: 'Inter, system-ui, sans-serif',
          },
        },
        borderRadius: {
          sm: '0.25rem',
          md: '0.375rem',
          lg: '0.5rem',
        },
      },
    };
    await fs.writeJson(path.join(targetDir, 'manifest.json'), manifest, { spaces: 2 });

    // Create package.json
    const packageJson = {
      name: themeName,
      version: '1.0.0',
      description: answers.description,
      main: options.typescript ? 'dist/index.js' : 'src/index.js',
      scripts: {
        dev: 'jiffoo-theme dev',
        build: options.typescript ? 'tsc' : 'echo "No build step for JS"',
        validate: 'jiffoo-theme validate',
        pack: 'jiffoo-theme pack',
      },
      dependencies: {
        '@jiffoo/theme-sdk': '^1.0.0',
      },
      devDependencies: options.typescript ? {
        typescript: '^5.0.0',
        '@types/node': '^20.0.0',
        '@types/react': '^18.2.0',
      } : {},
      peerDependencies: {
        react: '^18.0.0 || ^19.0.0',
        next: '^14.0.0 || ^15.0.0',
      },
      license: 'GPL-3.0',
    };
    await fs.writeJson(path.join(targetDir, 'package.json'), packageJson, { spaces: 2 });

    // Create TypeScript config if needed
    if (options.typescript) {
      const tsconfig = {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
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
    const ext = options.typescript ? 'tsx' : 'jsx';
    const mainContent = generateMainFile(themeName, options.typescript);
    await fs.writeFile(path.join(targetDir, 'src', `index.${ext}`), mainContent);

    // Create example component
    const componentContent = generateProductCardComponent(options.typescript);
    await fs.writeFile(path.join(targetDir, 'src', 'components', `ProductCard.${ext}`), componentContent);

    // Create global styles
    const stylesContent = generateGlobalStyles(answers.primaryColor);
    await fs.writeFile(path.join(targetDir, 'src', 'styles', 'globals.css'), stylesContent);

    // Create README
    const readme = generateReadme(themeName, answers.displayName, answers.description);
    await fs.writeFile(path.join(targetDir, 'README.md'), readme);

    // Create .gitignore
    const gitignore = `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
.next/
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
`;
    await fs.writeFile(path.join(targetDir, 'LICENSE'), license);

    spinner.succeed(chalk.green('Theme project created successfully!'));

    console.log(`
${chalk.cyan('Next steps:')}

  ${chalk.yellow('cd')} ${themeName}
  ${chalk.yellow('npm install')}
  ${chalk.yellow('npm run dev')}

${chalk.cyan('Useful commands:')}

  ${chalk.yellow('npm run dev')}       Start development server with preview
  ${chalk.yellow('npm run build')}     Build for production
  ${chalk.yellow('npm run validate')}  Validate manifest
  ${chalk.yellow('npm run pack')}      Package for submission

${chalk.cyan('Documentation:')} https://docs.jiffoo.com/developer/theme-development
`);
  } catch (error) {
    spinner.fail(chalk.red('Failed to create theme project'));
    console.error(error);
    process.exit(1);
  }
}

function generateMainFile(name: string, typescript: boolean): string {
  const types = typescript ? ': ThemeDefinition' : '';
  
  return `/**
 * ${name} - Jiffoo Theme
 */

import { defineTheme, registerComponent, registerPage } from '@jiffoo/theme-sdk';
${typescript ? "import type { ThemeDefinition } from '@jiffoo/theme-sdk';\n" : ''}
import { ProductCard } from './components/ProductCard';

// Define the theme
const theme${types} = defineTheme({
  slug: '${name}',
  name: '${name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}',
  version: '1.0.0',
  category: 'general',
  thumbnail: '/themes/${name}/thumbnail.png',
});

// Register custom components
theme.registerComponent('ProductCard', {
  name: 'ProductCard',
  component: ProductCard,
  description: 'Custom product card component',
  props: {
    showRating: { type: 'boolean', default: true },
    showQuickAdd: { type: 'boolean', default: true },
  },
});

export default theme;
`;
}

function generateProductCardComponent(typescript: boolean): string {
  const propsType = typescript ? `
interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    image: string;
    rating?: number;
  };
  showRating?: boolean;
  showQuickAdd?: boolean;
}
` : '';

  const props = typescript ? '{ product, showRating = true, showQuickAdd = true }: ProductCardProps' : '{ product, showRating = true, showQuickAdd = true }';

  return `/**
 * Custom Product Card Component
 */

import React from 'react';
${propsType}
export function ProductCard(${props}) {
  return (
    <div className="product-card group">
      <div className="product-image-wrapper">
        <img
          src={product.image}
          alt={product.name}
          className="product-image"
        />
        {showQuickAdd && (
          <button className="quick-add-btn">
            Add to Cart
          </button>
        )}
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        {showRating && product.rating && (
          <div className="product-rating">
            {'★'.repeat(Math.floor(product.rating))}
            {'☆'.repeat(5 - Math.floor(product.rating))}
          </div>
        )}
        <p className="product-price">\${product.price.toFixed(2)}</p>
      </div>
    </div>
  );
}
`;
}

function generateGlobalStyles(primaryColor: string): string {
  return `/* Theme Global Styles */

:root {
  --color-primary: ${primaryColor};
  --color-primary-foreground: #ffffff;
  --color-secondary: #64748b;
  --color-background: #ffffff;
  --color-foreground: #0f172a;
  --color-muted: #f1f5f9;
  --color-border: #e2e8f0;
  
  --font-sans: 'Inter', system-ui, sans-serif;
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
}

/* Product Card Styles */
.product-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: box-shadow 0.2s ease;
}

.product-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.product-image-wrapper {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
}

.product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.product-card:hover .product-image {
  transform: scale(1.05);
}

.quick-add-btn {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-primary);
  color: var(--color-primary-foreground);
  padding: 0.75rem;
  font-weight: 500;
  opacity: 0;
  transform: translateY(100%);
  transition: all 0.2s ease;
}

.product-card:hover .quick-add-btn {
  opacity: 1;
  transform: translateY(0);
}

.product-info {
  padding: 1rem;
}

.product-name {
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-foreground);
  margin: 0 0 0.5rem;
}

.product-rating {
  color: #fbbf24;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.product-price {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-primary);
  margin: 0;
}
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

This starts the development server with live preview on port 3002.

## Customization

Edit \`manifest.json\` to customize:
- Colors and design tokens
- Typography settings
- Component configurations

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
