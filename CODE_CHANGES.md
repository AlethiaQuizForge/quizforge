# QuizForge - Code Changes for Production

## Overview
Your artifact (quizforge-v15.jsx) needs these changes for production:

---

## Change 1: Add Client Directive

**At the very top of the file, add:**
```tsx
'use client';
```

---

## Change 2: Update API Call

**Replace this (lines ~474-482):**
```javascript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }]
  })
});
```

**With this:**
```javascript
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: quizContent,
    subject: quizSubject,
    numQuestions,
    difficulty
  })
});
```

**And update the response parsing (lines ~490-496):**
```javascript
// Old:
const data = await response.json();
let responseText = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
responseText = responseText.replace(/```json|```/g, '').trim();
let questions = JSON.parse(responseText);

// New (API route handles parsing):
const data = await response.json();
if (data.error) throw new Error(data.error);
let questions = data.questions;
```

---

## Change 3: Update Storage Calls

The artifact uses `window.storage` which won't exist in production.

**Option A: Use Firebase (recommended)**
Import and use the storage service:
```typescript
import { storage } from '@/lib/storage';

// Set user ID after login
storage.setUser(user.id);

// Then all window.storage calls work the same:
await storage.get('key');
await storage.set('key', 'value');
```

**Option B: Use localStorage (simpler, less features)**
Replace `window.storage` with:
```javascript
const storage = {
  async get(key) {
    const value = localStorage.getItem(key);
    return value ? { key, value } : null;
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value };
  },
  async delete(key) {
    localStorage.removeItem(key);
    return { key, deleted: true };
  }
};
```

---

## Change 4: Fix TypeScript Types (if using .tsx)

Add type annotations where needed:
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'student' | 'creator';
  createdAt: number;
}

interface Question {
  id: number;
  question: string;
  topic: string;
  difficulty: 'Basic' | 'Intermediate' | 'Advanced';
  options: { text: string; isCorrect: boolean }[];
  explanation: string;
}

interface Quiz {
  id: string;
  name: string;
  questions: Question[];
  published: boolean;
  createdAt: number;
}
```

---

## Change 5: Remove mammoth Import (if issues)

The mammoth library is used for .docx parsing. In production:

```javascript
// Replace static import:
import * as mammoth from 'mammoth';

// With dynamic import:
const mammoth = await import('mammoth');
```

---

## Quick Start (Copy-Paste Ready)

### 1. Create the project:
```bash
npx create-next-app@latest quizforge --typescript --tailwind --app
cd quizforge
npm install firebase mammoth
```

### 2. Create API route (`app/api/generate/route.ts`):
See the included `app/api/generate/route.ts` file.

### 3. Create environment file (`.env.local`):
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 4. Copy your component:
- Copy `quizforge-v15.jsx` to `components/QuizForge.tsx`
- Make the changes listed above

### 5. Update `app/page.tsx`:
```tsx
import QuizForge from '@/components/QuizForge'
export default function Home() {
  return <QuizForge />
}
```

### 6. Deploy:
```bash
npx vercel
```

---

## Firebase Setup (for persistent data)

1. Go to https://console.firebase.google.com
2. Create new project "quizforge"
3. Add web app, copy config
4. Enable Firestore Database (start in test mode)
5. Enable Authentication → Email/Password

Add to `.env.local`:
```
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
```

---

## That's it! 🎉

Your app should now:
- Generate quizzes using Claude API (securely via backend)
- Store data in Firebase (or localStorage)
- Work on any device with a browser
- Be deployable to Vercel for free

Questions? The code is well-commented and should be self-explanatory.
