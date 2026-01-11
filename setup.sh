#!/bin/bash
# QuizForge Setup Script
# Run this in an empty directory to set up your project

echo "🚀 QuizForge Setup"
echo "=================="

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is required. Please install Node.js first."
    exit 1
fi

# Create Next.js project
echo "📦 Creating Next.js project..."
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm

# Install additional dependencies  
echo "📦 Installing dependencies..."
npm install @anthropic-ai/sdk firebase mammoth

# Create directories
mkdir -p lib components app/api/generate

echo ""
echo "✅ Project structure created!"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Copy your QuizForge component to components/QuizForge.tsx"
echo "   - Add 'use client' at the top"
echo "   - Update the API call (see below)"
echo ""
echo "2. Create app/api/generate/route.ts (API proxy for Claude)"
echo ""
echo "3. Set up Firebase:"
echo "   - Go to console.firebase.google.com"
echo "   - Create new project 'quizforge'"
echo "   - Enable Firestore and Authentication"
echo "   - Copy config to .env.local"
echo ""
echo "4. Add your Claude API key to .env.local:"
echo "   ANTHROPIC_API_KEY=sk-ant-..."
echo ""
echo "5. Deploy:"
echo "   npx vercel"
echo ""
echo "📖 See README.md for detailed instructions"
