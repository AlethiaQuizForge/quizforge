# QuizForge - Deployment Guide

## Quick Start (5 minutes)

### Option 1: Deploy to Vercel (Easiest)

1. **Create a new Vite + React project:**
```bash
npm create vite@latest quizforge -- --template react
cd quizforge
npm install
```

2. **Install dependencies:**
```bash
npm install @anthropic-ai/sdk firebase
```

3. **Replace `src/App.jsx`** with the QuizForge component

4. **Set up environment variables** in Vercel:
   - `VITE_ANTHROPIC_API_KEY` - Your Claude API key

5. **Deploy:**
```bash
npm i -g vercel
vercel
```

---

## Architecture Decisions

### API Keys
**Problem:** Claude API key can't be exposed in frontend code.

**Solutions:**
1. **Vercel Edge Functions** - Proxy API calls (included in package)
2. **Firebase Cloud Functions** - Similar approach
3. **Your own backend** - Node.js/Python server

### Database
**Problem:** Artifact storage won't work in production.

**Solutions:**
1. **Firebase Firestore** - Easy setup, free tier (recommended)
2. **Supabase** - PostgreSQL, also has free tier
3. **PlanetScale** - MySQL, generous free tier

### Authentication
**Problem:** Current email-only auth isn't secure.

**Solutions:**
1. **Firebase Auth** - Google, email/password, etc.
2. **Clerk** - Modern auth, great DX
3. **Auth0** - Enterprise-grade

---

## Recommended Stack for MVP

```
Frontend:     React + Vite + Tailwind
Backend:      Vercel Edge Functions (or Firebase)
Database:     Firebase Firestore
Auth:         Firebase Auth
AI:           Claude API (via backend proxy)
Hosting:      Vercel
```

**Estimated setup time:** 2-4 hours
**Monthly cost:** $0 (free tiers) to start

---

## Files Included

- `package.json` - Dependencies
- `src/App.jsx` - Main QuizForge component
- `api/generate.js` - Vercel Edge Function for Claude API
- `src/lib/firebase.js` - Firebase configuration
- `src/lib/storage.js` - Database abstraction layer
- `.env.example` - Environment variables template

---

## Step-by-Step Setup

### 1. Create Vercel Project
```bash
npx create-next-app@latest quizforge --typescript --tailwind --app
cd quizforge
```

### 2. Add Environment Variables
Create `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

### 3. Set up Firebase
1. Go to console.firebase.google.com
2. Create new project "quizforge"
3. Enable Firestore Database
4. Enable Authentication (Email/Password)
5. Copy config to `.env.local`

### 4. Deploy
```bash
vercel --prod
```

---

## Need Help?

The code is ready to go - you mainly need to:
1. Get a Claude API key from console.anthropic.com
2. Create a Firebase project
3. Deploy to Vercel

Would you like me to create the complete project files?
