#!/bin/bash

# Jiffoo Mall Commercial Repository Setup Script
# This script helps you set up the commercial repository structure

set -e

echo "🚀 Setting up Jiffoo Mall Commercial Repository..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    print_warning "GitHub CLI not found. You'll need to create the repository manually."
    MANUAL_SETUP=true
else
    MANUAL_SETUP=false
fi

# Get repository name
REPO_NAME="jiffoo-mall-commercial"
REPO_DESCRIPTION="Commercial plugins and SaaS services for Jiffoo Mall"

echo ""
echo "📋 Repository Configuration:"
echo "   Name: $REPO_NAME"
echo "   Description: $REPO_DESCRIPTION"
echo "   Visibility: Private"
echo ""

# Ask for confirmation
read -p "Do you want to proceed? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 1
fi

# Create repository
if [ "$MANUAL_SETUP" = false ]; then
    print_info "Creating private repository with GitHub CLI..."
    
    if gh repo create "$REPO_NAME" --private --description "$REPO_DESCRIPTION" --gitignore Node --license mit; then
        print_status "Repository created successfully"
        
        # Clone the repository
        print_info "Cloning repository..."
        git clone "https://github.com/$(gh api user --jq .login)/$REPO_NAME.git"
        cd "$REPO_NAME"
    else
        print_error "Failed to create repository with GitHub CLI"
        exit 1
    fi
else
    print_warning "Please create the repository manually:"
    echo "1. Go to https://github.com/new"
    echo "2. Repository name: $REPO_NAME"
    echo "3. Description: $REPO_DESCRIPTION"
    echo "4. Set to Private"
    echo "5. Add README, .gitignore (Node), License (MIT)"
    echo "6. Create repository"
    echo ""
    read -p "Press Enter after creating the repository..."
    
    # Ask for repository URL
    read -p "Enter the repository clone URL: " REPO_URL
    
    print_info "Cloning repository..."
    git clone "$REPO_URL"
    cd "$REPO_NAME"
fi

# Create directory structure
print_info "Creating directory structure..."

# Main directories
mkdir -p plugins/payment
mkdir -p plugins/auth
mkdir -p plugins/marketing
mkdir -p plugins/analytics
mkdir -p saas-services
mkdir -p enterprise/multi-tenant
mkdir -p enterprise/white-label
mkdir -p enterprise/oem-platform
mkdir -p tools/license-server
mkdir -p tools/plugin-builder
mkdir -p tools/deployment
mkdir -p docs/plugin-development
mkdir -p docs/licensing
mkdir -p docs/enterprise
mkdir -p scripts

print_status "Directory structure created"

# Copy files from setup directory
print_info "Setting up initial files..."

# Copy package.json
cp "../commercial-repo-setup/package.json" .
cp "../commercial-repo-setup/.env.example" .
cp "../commercial-repo-setup/README.md" .

# Copy WeChat Pay Pro plugin
mkdir -p plugins/payment/wechat-pay-pro/src
cp "../commercial-repo-setup/plugins/payment/wechat-pay-pro/package.json" plugins/payment/wechat-pay-pro/
cp "../commercial-repo-setup/plugins/payment/wechat-pay-pro/src/index.ts" plugins/payment/wechat-pay-pro/src/

print_status "Initial files copied"

# Create additional configuration files
print_info "Creating configuration files..."

# Create turbo.json
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
EOF

# Create TypeScript config
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": [
    "src/**/*",
    "plugins/**/*",
    "saas-services/**/*",
    "enterprise/**/*",
    "tools/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts"
  ]
}
EOF

# Create ESLint config
cat > .eslintrc.js << 'EOF'
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
};
EOF

# Create Prettier config
cat > .prettierrc << 'EOF'
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
EOF

# Create Jest config
cat > jest.config.js << 'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/plugins', '<rootDir>/tools'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    'plugins/**/*.ts',
    'tools/**/*.ts',
    '!**/*.d.ts',
  ],
};
EOF

print_status "Configuration files created"

# Create initial scripts
print_info "Creating utility scripts..."

# Create plugin creation script
cat > scripts/create-plugin.js << 'EOF'
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const pluginName = process.argv[2];
const pluginType = process.argv[3] || 'payment';

if (!pluginName) {
  console.error('Usage: npm run create-plugin <plugin-name> [type]');
  process.exit(1);
}

const pluginDir = path.join('plugins', pluginType, pluginName);

if (fs.existsSync(pluginDir)) {
  console.error(`Plugin ${pluginName} already exists`);
  process.exit(1);
}

// Create plugin directory structure
fs.mkdirSync(pluginDir, { recursive: true });
fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
fs.mkdirSync(path.join(pluginDir, '__tests__'), { recursive: true });

// Create package.json
const packageJson = {
  name: `@jiffoo/${pluginName}`,
  version: '1.0.0',
  description: `${pluginName} plugin for Jiffoo Mall`,
  private: true,
  license: 'COMMERCIAL',
  main: 'dist/index.js',
  types: 'dist/index.d.ts',
  scripts: {
    build: 'tsc',
    dev: 'tsc --watch',
    test: 'jest',
    lint: 'eslint src/**/*.ts',
    clean: 'rm -rf dist'
  },
  dependencies: {
    '@jiffoo/plugin-core': 'workspace:*'
  },
  devDependencies: {
    typescript: '^5.0.0',
    jest: '^29.0.0',
    '@types/jest': '^29.0.0'
  }
};

fs.writeFileSync(
  path.join(pluginDir, 'package.json'),
  JSON.stringify(packageJson, null, 2)
);

// Create basic plugin file
const pluginTemplate = `/**
 * ${pluginName} Plugin
 */

import { BasePlugin } from '@jiffoo/plugin-core';

export class ${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Plugin extends BasePlugin {
  constructor(config: any) {
    super('${pluginName}', '${pluginName} Plugin', '1.0.0', config);
  }

  async initialize(): Promise<void> {
    console.log('${pluginName} plugin initialized');
  }
}

export default ${pluginName.charAt(0).toUpperCase() + pluginName.slice(1)}Plugin;
`;

fs.writeFileSync(path.join(pluginDir, 'src', 'index.ts'), pluginTemplate);

console.log(`✅ Plugin ${pluginName} created successfully in ${pluginDir}`);
EOF

chmod +x scripts/create-plugin.js

print_status "Utility scripts created"

# Initialize git and commit
print_info "Initializing git repository..."

git add .
git commit -m "Initial commercial repository setup

- Added directory structure for plugins, SaaS services, and enterprise features
- Created WeChat Pay Pro plugin as example
- Set up build tools and configuration
- Added utility scripts for plugin development"

# Push to remote
print_info "Pushing to remote repository..."
git push origin main

print_status "Repository setup completed successfully!"

echo ""
echo "🎉 Your commercial repository is ready!"
echo ""
echo "📁 Repository structure:"
echo "   📦 plugins/          - Commercial plugins"
echo "   ☁️  saas-services/    - SaaS services"
echo "   🏢 enterprise/       - Enterprise features"
echo "   🛠️  tools/           - Development tools"
echo "   📚 docs/            - Documentation"
echo ""
echo "🚀 Next steps:"
echo "   1. cd $REPO_NAME"
echo "   2. cp .env.example .env.local"
echo "   3. Edit .env.local with your configuration"
echo "   4. pnpm install"
echo "   5. pnpm build"
echo ""
echo "💡 Create new plugins with:"
echo "   pnpm create-plugin my-plugin-name payment"
echo ""
print_status "Setup complete! Happy coding! 🎉"
