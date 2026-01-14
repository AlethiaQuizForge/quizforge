# QuizForge - Project Context for Continuing Development

Use this document when starting a new Claude conversation to quickly provide context about the project.

---

## Quick Summary

**QuizForge** is an AI-powered quiz generator web app that lets educators and students create quizzes from course materials (PDFs, Word docs, text). Built with Next.js, React, Tailwind CSS, Firebase, and the Claude API.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, Tailwind CSS 3 |
| Backend | Next.js API Routes |
| AI | Claude API (claude-sonnet-4-20250514) via @anthropic-ai/sdk |
| Database | Firebase Firestore |
| Auth | Firebase Authentication (Email/Password, Google, Apple) |
| File Processing | mammoth.js (Word docs), JSZip |
| Mobile | Capacitor (iOS app wrapper) |
| Hosting | Vercel |

---

## Project Structure

```
quizforge-deploy 2/
├── app/
│   ├── page.tsx              # Entry point (renders QuizForge)
│   ├── layout.tsx            # Root layout with metadata
│   ├── globals.css           # Global styles
│   ├── api/
│   │   ├── generate/route.ts # Quiz generation endpoint (Claude API)
│   │   └── vision/route.ts   # PDF image extraction (Claude Vision)
│   ├── privacy/page.tsx      # Privacy policy
│   └── terms/page.tsx        # Terms of service
├── components/
│   └── QuizForge.jsx         # Main app component (~6000 lines)
├── lib/                      # Utility functions
├── public/
│   ├── manifest.json         # PWA manifest
│   ├── icon.svg              # App icon
│   └── icons/                # App icons (various sizes)
├── ios/                      # Capacitor iOS project
├── package.json
├── tailwind.config.js
├── next.config.js
├── capacitor.config.ts
├── vercel.json
└── .env.local                # Environment variables (API keys)
```

---

## Key Features (Implemented)

### For Educators/Teachers
- Upload course materials (PDF, Word, PowerPoint, images, text)
- AI generates multiple-choice questions from content
- Configure: number of questions, difficulty, topic focus, question style
- Question bank management (edit, tag, organize)
- Create and publish quizzes from question bank
- Class management with join codes
- Assign quizzes to classes with due dates
- View student submissions and analytics

### For Students
- Join classes via codes
- Take assigned quizzes
- Practice mode with instant feedback
- Progress tracking (scores, streaks, achievements)
- Spaced repetition for review
- Share quizzes via link

### Additional Features
- Dark mode toggle
- Timed quiz mode
- Mobile-responsive design
- PWA support
- Onboarding flow
- Toast notifications

---

## API Endpoints

### POST `/api/generate`
Generates quiz questions from content using Claude.

**Request:**
```json
{
  "content": "Text content to generate questions from",
  "subject": "Subject name",
  "numQuestions": 10,
  "difficulty": "basic|mixed|advanced",
  "topicFocus": "Optional specific topic",
  "questionStyle": "concept|case|mixed"
}
```

**Response:**
```json
{
  "questions": [
    {
      "question": "Question text?",
      "options": [
        {"text": "Option A", "isCorrect": false},
        {"text": "Option B", "isCorrect": true},
        ...
      ],
      "explanation": "Why B is correct",
      "topic": "Topic name",
      "difficulty": "Basic|Intermediate|Advanced"
    }
  ]
}
```

### POST `/api/vision`
Extracts text from PDF page images using Claude Vision.

**Request:**
```json
{
  "images": ["base64_encoded_image_1", "base64_encoded_image_2"]
}
```

---

## Firebase Structure

- **Auth**: Email/password, Google, Apple sign-in
- **Firestore Collection**: `userData`
  - `quizforge-account-{uid}`: User profile (name, role, etc.)
  - `quizforge-data-{uid}`: User data (quizzes, classes, progress)
  - `shared-{quizId}`: Publicly shared quizzes

---

## Environment Variables

Required in `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Firebase config is currently hardcoded in `QuizForge.jsx` (project: quizforge-58f79)

---

## Current State / Known Issues

### Recently Fixed (Jan 2026):
- ✅ URL routing bug - users can now bookmark pages, refresh without 404, use browser back/forward
- ✅ Removed duplicate "Forgot password?" link on auth page
- ✅ Fixed onboarding step indicator (was showing 4 dots for 3 steps, now shows dots only during steps 1-3)
- ✅ Fixed Question Style dropdown text truncation (shortened options, added dynamic description)
- ✅ Improved text visibility across landing page and onboarding modals (better contrast)
- ✅ Contact link in footer uses mailto (working as intended)
- ✅ Invalid class code error feedback already exists

### Known Issues:
- Class joining only works for classes in local state (architecture limitation - would need Firestore query to find any teacher's class by code)

### Next Steps:
- Consider implementing Firestore-based class lookup for cross-user class joining
- Add more robust error handling for network failures
- Consider adding loading states for async operations

---

## How to Continue in a New Chat

Copy and paste this to start your new conversation:

```
I'm continuing work on QuizForge, an AI-powered quiz generator app.

Tech stack: Next.js 16, React 19, Tailwind CSS, Firebase (Auth + Firestore), Claude API

The main component is components/QuizForge.jsx (~6000 lines). API routes are in app/api/.

[Describe what you want to work on next]

Please read the PROJECT_CONTEXT.md file in my project folder for full details.
```

---

## Commands Reference

```bash
# Development
npm run dev          # Start dev server (localhost:3000)

# Production
npm run build        # Build for production
npm run start        # Start production server

# Deployment
vercel               # Deploy to Vercel
vercel --prod        # Deploy to production

# iOS (Capacitor)
npx cap sync ios     # Sync web assets to iOS
npx cap open ios     # Open in Xcode
```

---

*Last updated: January 2026*
