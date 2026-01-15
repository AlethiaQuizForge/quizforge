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
| Payments | Stripe (prepared, not yet active) |
| Analytics | Vercel Analytics |
| Error Monitoring | Sentry |
| Hosting | Vercel |

---

## Project Structure

```
quizforge-deploy 2/
├── app/
│   ├── page.tsx              # Entry point (renders QuizForge)
│   ├── layout.tsx            # Root layout with metadata, Analytics, Sentry
│   ├── globals.css           # Global styles
│   ├── sentry-provider.tsx   # Client-side Sentry initialization
│   ├── opengraph-image.tsx   # Dynamic OG image for social sharing
│   ├── twitter-image.tsx     # Twitter card image
│   ├── api/
│   │   ├── generate/route.ts # Quiz generation endpoint (rate-limited)
│   │   ├── vision/route.ts   # PDF image extraction (rate-limited)
│   │   └── stripe/           # Stripe checkout, webhook, portal routes
│   ├── privacy/page.tsx      # Privacy policy
│   └── terms/page.tsx        # Terms of service
├── components/
│   ├── QuizForge.jsx         # Main app component (~6000 lines)
│   └── PricingCard.tsx       # Subscription pricing UI component
├── lib/
│   ├── stripe.ts             # Stripe plans and limit checking
│   └── rate-limit.ts         # In-memory rate limiter
├── docs/
│   ├── STRIPE_SETUP.md       # Stripe activation guide
│   └── ...
├── scripts/
│   └── backup-firebase.md    # Firebase backup documentation
├── public/
│   ├── manifest.json         # PWA manifest
│   ├── icon.svg              # App icon
│   ├── BingSiteAuth.xml      # Bing Webmaster verification
│   └── icons/                # App icons (various sizes)
├── ios/                      # Capacitor iOS project
├── instrumentation.ts        # Server-side Sentry setup
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
- Social sharing (X, Facebook, WhatsApp, LinkedIn)
- Keyboard shortcuts (1-4/A-D for answers, Enter/Space for submit)
- PDF export for quizzes
- Smart Review (spaced repetition)
- Enhanced quiz results with stats grid and visual breakdown

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
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

Optional (for Stripe subscriptions - see docs/STRIPE_SETUP.md):
```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_INSTITUTION_PRICE_ID=price_...
```

Firebase config is currently hardcoded in `QuizForge.jsx` (project: quizforge-58f79)

---

## Current State / Known Issues

### Recently Fixed (Jan 2026):
- ✅ URL routing bug - users can now bookmark pages, refresh without 404, use browser back/forward
- ✅ Removed duplicate "Forgot password?" link on auth page
- ✅ Fixed onboarding step indicator (shows 3 dots only during steps 1-3)
- ✅ Fixed Question Style dropdown text truncation
- ✅ Improved text visibility across landing page ("Log In", "I'm a Teacher", "Study Smarter" etc.)
- ✅ Contact link in footer uses mailto (working as intended)
- ✅ **Firestore-based class joining** - students can now join ANY teacher's class by code
- ✅ **Firestore-based assignments** - students can now see quizzes assigned to their classes
- ✅ **Firestore-based submissions** - teachers can now see student quiz results across devices
- ✅ Fixed Sign Up button visibility (gradient amber-to-orange style)
- ✅ Fixed share URL bug - sharing results from a friend's quiz now includes correct link
- ✅ Fixed duplicate submission check - uses studentId/email instead of name
- ✅ **"Times Taken" gamification** - shared quizzes now track and display play count

### Architecture Changes (Jan 2026):
- Classes are now stored in global `classes` collection in Firestore (not just per-user)
- Assignments are stored in global `assignments` collection with embedded quiz data
- Submissions are now stored in global `submissions` collection in Firestore
- When student joins a class → fetches assignments from Firestore
- When student logs in → syncs assignments for all joined classes from Firestore
- When teacher assigns quiz → saves to Firestore with quiz questions embedded
- When student completes quiz → submission saved to Firestore
- When teacher logs in → fetches all submissions for their assignments from Firestore

### Firestore Collections:
- `userData` - Per-user data (account info, local quizzes, progress)
- `classes` - Global classes collection (searchable by code)
- `assignments` - Global assignments with embedded quiz questions
- `submissions` - Global submissions (studentId, studentEmail, assignmentId, score, answers, etc.)
- `shared-{id}` - Publicly shared quizzes (now includes `timesTaken` counter)

### Recently Added (Jan 2026):
- ✅ **SEO & Social**: OG images, Twitter cards, sitemap, Google/Bing verification
- ✅ **Analytics**: Vercel Analytics integration
- ✅ **Error Monitoring**: Sentry with client and server-side tracking
- ✅ **Social Sharing**: X, Facebook, WhatsApp, LinkedIn share buttons
- ✅ **UX Improvements**: Keyboard shortcuts (1-4/A-D), enhanced results view
- ✅ **PDF Export**: Export quizzes from dashboard
- ✅ **Rate Limiting**: API protection (10 quizzes/hr, 20 vision requests/hr)
- ✅ **Stripe Infrastructure**: Subscription system built (inactive until configured)
  - Plans: Free (5 quizzes/mo), Pro ($9 - unlimited), Institution ($199)
  - Philosophy: Same product quality for all, differentiate by volume only

### Known Issues:
- Teacher's student roster only updates on login (no real-time sync)

### Next Steps:
- Activate Stripe subscriptions (see docs/STRIPE_SETUP.md)
- Add real-time updates for class roster
- Consider adding leaderboards for shared quizzes

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

*Last updated: January 15, 2026*
