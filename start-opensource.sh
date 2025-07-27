#!/bin/bash

# 🆓 Jiffoo Open Source Quick Start Script
echo "🚀 Starting Jiffoo Open Source E-commerce Platform..."
echo "=================================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js >= 18.0.0"
    exit 1
fi

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "⚠️  Installing pnpm..."
    npm install -g pnpm
fi

# Create .env if not exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp apps/backend/.env .env 2>/dev/null || echo "DATABASE_URL=\"file:./dev.db\"
JWT_SECRET=\"jiffoo-opensource-development-secret\"
NODE_ENV=development
PORT=3001" > .env
fi

echo "📦 Installing dependencies..."
pnpm install

echo "🗄️  Setting up database..."
pnpm db:generate || echo "Skipping db:generate"
pnpm db:migrate || echo "Skipping db:migrate"

echo "🚀 Starting Jiffoo..."
echo ""
echo "🎉 Access your store at:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:3001"
echo "   API Docs: http://localhost:3001/docs"
echo ""

pnpm dev
