# QuizForge - Project Context for Continuing Development

Use this document when starting a new Claude conversation to quickly provide context about the project.

---

## Quick Summary

**QuizForge** is an AI-powered quiz generator web app that lets educators and students create quizzes from course materials (PDFs, Word docs, PowerPoint, images, text). Built with Next.js, React, Tailwind CSS, Firebase, and the Claude API.

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
| File Processing | mammoth.js (Word docs), JSZip (PPTX) |
| Mobile | Capacitor (iOS app wrapper) |
| Payments | Stripe (4 subscription tiers) |
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
│   ├── pricing/page.tsx      # Marketing pricing page with plans comparison
│   ├── join/[code]/page.tsx  # Organization invite join page
│   ├── class/[code]/page.tsx # Class join redirect page
│   ├── privacy/page.tsx      # Privacy policy
│   └── terms/page.tsx        # Terms of service
├── components/
│   ├── QuizForge.jsx         # Main app component (~6200 lines)
│   ├── AdminDashboard.tsx    # Organization admin dashboard
│   └── PricingCard.tsx       # Subscription pricing UI component
├── lib/
│   ├── firebase.ts           # Firebase initialization with fallback config
│   ├── stripe.ts             # Stripe plans and limit checking
│   ├── organizations.ts      # Organization management helpers
│   ├── constants.ts          # Centralized app constants
│   ├── utils.ts              # Utility functions (shuffle, formatTime, etc.)
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

## Complete Feature List

### Quiz Generation & Management

- **AI-powered quiz generation** using Claude API (claude-sonnet-4-20250514)
- **File upload support**: PDF, DOCX, PPTX, images, plain text (max 20MB, drag-and-drop)
- **Claude Vision API** for image-based PDF text extraction
- **Question types**: Multiple-choice (4 options), True/False, Mixed format
- **Configuration options**:
  - Number of questions (customizable)
  - Difficulty: Basic, Mixed, Advanced
  - Question style: Concept-focused, Case-based, Mixed
  - Topic focus filtering
- **Quiz management**: Edit, delete, duplicate, tag quizzes
- **Question editing**: Edit individual questions, delete questions
- **Publish & share**: Publish quizzes, generate shareable URLs
- **Answer shuffling**: Options randomized on each attempt

### Authentication & User Management

- **Firebase Auth**: Email/password, Google OAuth, Apple OAuth
- **Password reset** via email
- **Three user roles**: Teacher, Student, Creator
- **Role-specific dashboards** and features
- **Profile management** page
- **Social sign-in role selection**

### Teacher Features

- **Class management**: Create classes with unique join codes
- **Student roster**: View and manage enrolled students
- **Quiz assignment**: Assign quizzes to classes with due dates and weights
- **Submissions view**: See all student submissions and grades
- **Analytics**:
  - Per-question correct rate
  - Identify hardest questions
  - Average scores per class
  - Student engagement metrics
- **Teacher dashboard**: Overview of quizzes, classes, students, pending assignments

### Student Features

- **Class enrollment**: Join classes via codes, leave classes
- **Quiz taking**: Take assigned quizzes with progress saving
- **Keyboard shortcuts**: 1-4 keys, A-D letters for quick answers
- **Results & review**: View scores, explanations, retry wrong answers only
- **Progress tracking**:
  - Quiz completion count
  - Average score calculation
  - Total questions answered
  - Score history (last 8 scores)
  - Topic performance breakdown
  - Weak topics identification
  - Daily history (last 30 days)
- **Student dashboard**: Personal quizzes, assignments, completion status

### Gamification & Engagement

- **7 Achievements**:
  - First Quiz (complete first quiz)
  - On Fire (3-day streak)
  - Week Warrior (7-day streak)
  - Dedicated Learner (10 quizzes)
  - Quiz Master (50 quizzes)
  - Perfect Score (100% on quiz)
  - Star Student (80%+ average)
- **Streak tracking**: Current streak, longest streak, daily practice tracking
- **Timed quiz mode**: Configurable time limits, countdown timer, auto-submit
- **Leaderboard**: Top 10 scores on shared quizzes
- **"Times Taken" counter** on shared quizzes
- **Affirmations**: Random positive messages on correct answers (~30%)

### Spaced Repetition System

- **Question-level performance tracking**: Correct/wrong count per question
- **Dynamic review scheduling** based on performance
- **Next review date calculation**
- **Spaced repetition practice mode**: Auto-selects 10 questions due for review
- **Practice by topic** selection

### Export & Sharing

- **PDF export**: With or without answer keys, professional formatting
- **Shareable quiz URLs**: Unique IDs, no login required to take
- **Social sharing buttons**: X, Facebook, WhatsApp, LinkedIn
- **Clipboard copy** with fallback modal

### Subscription Plans (Stripe)

| Plan | Price | Limits |
|------|-------|--------|
| Free | $0 | 5 quizzes/month, 1 class, 30 students |
| Pro | $9/month | 25 quizzes/month, 3 classes, 50 students/class |
| School | $199/month | 25 teachers, 25 quizzes/teacher/month |
| University | $499/month | 50 professors, 35 quizzes/professor/month |

- **Stripe integration**: Checkout sessions, billing portal, webhooks
- **Plan enforcement**: Limits checked on quiz generation
- **One-click upgrade** buttons

### Organization/Enterprise Features

- **Organization creation** with admin user
- **Invite system**: 6-character alphanumeric invite codes
- **Email domain auto-join** configuration
- **Member management**: Add, remove, view all members
- **Admin dashboard**:
  - Overview tab (limits, member count, plan details)
  - Members tab (manage membership)
  - Settings tab (org name, email domain, invite code)
- **Invite link**: Copy and regenerate functionality
- **Routes**: `/join/[code]` for org invites, `/class/[code]` for class joins

### UI/UX Features

- **Dark mode**: Toggle with localStorage persistence
- **Responsive design**: Mobile, tablet, desktop optimized
- **Loading states**: Skeleton loaders, progress indicators, spinners
- **Toast notifications**: Success, error, info, affirmation styles (auto-dismiss 3s)
- **Modals**: Resume quiz, delete confirmation, export options, share link, timed setup
- **Keyboard navigation**: 1-4, A-D, Enter key support (hidden on mobile/tablet)
- **Onboarding flow** for new users
- **Profile editing**: Edit display name from profile page
- **Consistent navigation**: Dashboard, Create, Classes links across all pages

### Data & Sync

- **Firebase Firestore**: Cloud storage with real-time sync
- **Offline support**: Data queuing with sync indicators, pending count
- **Local storage**: UI preferences, quiz progress auto-save, resume functionality

### Infrastructure

- **Rate limiting**: 10 quizzes/hour, 20 vision requests/hour per IP
- **Sentry**: Client and server-side error tracking
- **Vercel Analytics**: Usage tracking
- **PWA support**: Web manifest, Capacitor for iOS native app
- **SEO**: OpenGraph, Twitter cards, JSON-LD structured data

### Static Pages

- `/` - Landing page with feature showcase and auth
- `/pricing` - Marketing pricing page with plan comparison, FAQ, testimonials
- `/privacy` - Privacy Policy
- `/terms` - Terms of Service
- `/join/[code]` - Organization invite page
- `/class/[code]` - Class join redirect

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
  "questionStyle": "concept|case|mixed",
  "questionType": "multiple-choice|true-false|mixed"
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
        {"text": "Option B", "isCorrect": true}
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

### Stripe Endpoints
- `POST /api/stripe/create-checkout` - Create checkout session
- `POST /api/stripe/portal` - Create billing portal session
- `POST /api/stripe/webhook` - Handle Stripe events

---

## Firebase Structure

### Authentication
- Email/password, Google, Apple sign-in

### Firestore Collections

| Collection | Purpose |
|------------|---------|
| `userData` | Per-user data (account info, local quizzes, progress) |
| `classes` | Global classes (searchable by code) |
| `assignments` | Global assignments with embedded quiz questions |
| `submissions` | Student submissions (studentId, email, assignmentId, score, answers) |
| `organizations` | Organization data (members, settings, invite codes) |
| `shared-{id}` | Publicly shared quizzes (includes `timesTaken` counter, leaderboard) |

### Document Patterns
- `quizforge-account-{uid}` - User profile (name, role, plan, org membership)
- `quizforge-data-{uid}` - User data (quizzes, classes, progress, achievements)

---

## Environment Variables

Required in `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

For Stripe subscriptions (see docs/STRIPE_SETUP.md):
```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_SCHOOL_PRICE_ID=price_...
STRIPE_UNIVERSITY_PRICE_ID=price_...
```

Firebase config is currently hardcoded in `QuizForge.jsx` (project: quizforge-58f79)

---

## Architecture Notes

### Class/Assignment System (Jan 2026)
- Classes stored in global `classes` collection (searchable by code)
- Assignments stored in global `assignments` collection with embedded quiz data
- Submissions stored in global `submissions` collection
- When student joins class → fetches assignments from Firestore
- When student logs in → syncs assignments for all joined classes
- When teacher assigns quiz → saves to Firestore with questions embedded
- When student completes quiz → submission saved to Firestore
- When teacher logs in → fetches all submissions for their assignments

### Organization System
- Organizations have admin users who can invite others
- Members join via invite codes or email domain auto-join
- Organization admins manage members and settings
- Plans (School/University) are organization-level with per-teacher limits

---

## Recent Updates (January 2026)

- **Pricing Page**: Full marketing page at `/pricing` with:
  - Plan comparison cards with gradient styling
  - Monthly/yearly billing toggle (17% savings)
  - Feature comparison table
  - Testimonials and FAQ sections
  - Full dark/light mode support

- **UX Improvements**:
  - Dashboard stat cards have colored left borders for visual variety
  - Navigation header consistent across all pages (Dashboard, Create, Classes)
  - Class creation now navigates to Class Manager after success
  - Pro Plan profile section shows full feature list
  - Profile name editing with inline form

- **Bug Fixes**:
  - Fixed Stripe webhook not updating user plan (Firebase fallback config)
  - Fixed 30 UX issues from comprehensive audit
  - Safe JSON parsing throughout app
  - Rate condition fixes in quiz navigation

---

## Known Issues

- Teacher's student roster only updates on login (no real-time sync)

---

## Potential Future Enhancements

- Real-time updates for class roster
- More detailed analytics dashboards
- Question import/export (CSV, JSON)
- Integration with LMS platforms (Canvas, Blackboard)
- AI-powered question difficulty calibration

---

## How to Continue in a New Chat

Copy and paste this to start your new conversation:

```
I'm continuing work on QuizForge, an AI-powered quiz generator app.

Tech stack: Next.js 16, React 19, Tailwind CSS, Firebase (Auth + Firestore), Claude API, Stripe

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
