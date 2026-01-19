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
│   ├── firebase.ts           # Firebase initialization (uses env vars)
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
- **Toast notifications**: Success, error, info, affirmation styles (auto-dismiss 5s)
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
| `notifications` | Student notifications (recipientEmail, type, message, read, createdAt) |
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
STRIPE_PRO_YEARLY_PRICE_ID=price_...
STRIPE_SCHOOL_PRICE_ID=price_...
STRIPE_SCHOOL_YEARLY_PRICE_ID=price_...
STRIPE_UNIVERSITY_PRICE_ID=price_...
STRIPE_UNIVERSITY_YEARLY_PRICE_ID=price_...
```

For Firebase Admin SDK (server-side auth):
```
FIREBASE_PROJECT_ID=quizforge-58f79
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@quizforge-58f79.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

For Upstash Redis rate limiting:
```
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

For Firebase client SDK (used in browser):
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=quizforge-58f79.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=quizforge-58f79
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=quizforge-58f79.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

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

- **Bug Fixes & Mobile Support** (Jan 19, Session 8):
  - **Google Sign-in on Mobile** - Fixed popup auth failing on mobile devices:
    - Uses `signInWithRedirect` on mobile instead of `signInWithPopup`
    - Added redirect result handler for new users from mobile
    - Added `accounts.google.com` to CSP frame-src and connect-src
  - **PDF Upload Fix** - Added `cdnjs.cloudflare.com` to CSP for pdf.js
  - **Image Upload Support** - Added JPG, PNG, GIF, WebP upload via Vision API
  - **Dynamic OG Metadata** - Shared quiz links now show quiz title in previews
  - **Critical Error Handling Fixes**:
    - Stripe webhook now returns error if org creation fails (Stripe will retry)
    - Assignment submission failure now notifies user with toast
    - Student notification failures now tracked and reported to teacher
  - **Build Fix** - Split page.tsx into server/client components for metadata

- **Security Audit Final Completion** (Jan 18, Session 7):
  - **Firestore Rules for Shared Quizzes** - Fixed access control for `shared-*` documents in userData collection:
    - Public read access (no auth required) for shared quizzes
    - Authenticated create/update for sharing quizzes
    - Delete only by original sharer (via `sharedBy` field)
  - **`sharedBy` Field Tracking** - Added ownership tracking to shared quiz documents at root level for Firestore rules verification
  - **Fixed Billing Portal** - Replaced hardcoded test URL (`https://billing.stripe.com/p/login/test`) with proper `/api/stripe/portal` API call that creates real billing portal sessions
  - **Playwright E2E Test Suite** - 24 automated tests covering:
    - Homepage rendering (title, logo, features, auth forms)
    - Authentication flows (login, signup, password reset, social login)
    - Accessibility (focus management, ARIA labels, keyboard nav, color contrast)
    - Shared quiz access (loading, taking quiz, leaderboard)
  - **Test Configuration** - Added playwright.config.ts with proper setup
  - **TypeScript Build Fix** - Excluded test files from production build

- **Security Audit Completion** (Jan 18, Session 6):
  - **Removed hardcoded Firebase credentials** - Moved to environment variables (`NEXT_PUBLIC_FIREBASE_*`)
  - **Improved CSP** - Removed `unsafe-eval` in production builds
  - **Fixed race conditions** - `joinClass` and `leaveClass` now use atomic Firestore operations (`arrayUnion`, `runTransaction`)
  - **Server-side subscription limits** - `/api/generate` now enforces quiz limits server-side
  - **Secure org join API** - New `/api/org/join` endpoint with Firebase Admin auth verification
  - **Code quality fixes**:
    - Replaced all `.substr()` with `.slice()` (deprecated method)
    - Fixed silent promise rejection (added proper error logging)
    - Fixed date type mismatches (timestamp vs ISO string handling)
  - **Accessibility fixes**:
    - Added ARIA labels to mobile menu toggle buttons
    - Changed mobile menu containers to semantic `<nav>` elements
    - Increased toast duration from 3s to 5s for better readability

- **Security Hardening & Audit Fixes** (Jan 18, Session 5):
  - **Firestore Security Rules** - Complete rewrite with proper access control:
    - Assignments: Only teacher/enrolled students can read
    - Submissions: Uses `studentId` (uid) only, not email (prevents spoofing)
    - Notifications: Uses `recipientUserId` instead of email
    - Organizations: Proper admin/member verification
  - **Invite Code Strengthening** - 12 chars with `crypto.getRandomValues()` (~59 bits entropy)
  - **Vision API Limits** - Max 100 images, 10MB each, 150MB total per request
  - **CSP Headers** - Full Content-Security-Policy in next.config.js
  - **Firebase Admin SDK** - Server-side auth verification (`lib/firebase-admin.ts`)
  - **Upstash Redis Rate Limiting** - Global rate limiting across serverless instances
  - **XSS Sanitization** - `sanitizeText()`, `sanitizeQuestion()`, `sanitizeUrl()` utilities
  - **Stripe Idempotency** - Prevents duplicate checkout sessions

- **Pricing & Checkout Improvements** (Jan 18):
  - **Self-Service Org Checkout** - School/University plans now have direct checkout (not "Contact Sales")
  - **Organization Name Modal** - Prompts for org name before checkout
  - **Monthly/Yearly Billing** - Full support with separate Stripe price IDs
  - **New Year Promo** - 20% off School/University in Jan-Feb (auto-activates)
  - **Student Discount Note** - "Student on a budget? Reach out" with mailto link
  - **Yearly Savings Badge** - Shows "Save 17% — 2 months free" when yearly selected

- **Environment Variables** (new for Stripe yearly):
  ```
  STRIPE_PRO_YEARLY_PRICE_ID=price_...
  STRIPE_SCHOOL_YEARLY_PRICE_ID=price_...
  STRIPE_UNIVERSITY_YEARLY_PRICE_ID=price_...
  UPSTASH_REDIS_REST_URL=https://...
  UPSTASH_REDIS_REST_TOKEN=...
  ```

- **Student Notification System** (Jan 15):
  - **Real-time notifications** when teachers assign quizzes to classes
  - **Bell icon (🔔)** in student dashboard header with unread count badge
  - **Notifications modal** to view and manage notifications
  - **Mark as read** individual notifications or mark all as read
  - New `notifications` Firestore collection for cross-user messaging

- **"Send to Class" Feature** (Jan 15):
  - After creating a quiz, teachers see a **"Send to Class"** button in the success modal
  - Green gradient button with 👥 icon for quick assignment workflow
  - Navigates directly to Class Manager with the quiz pre-selected

- **Dynamic Link Previews** (Jan 15):
  - **Class invite links** (`/class/[code]`) show class name and teacher in Open Graph metadata
  - **Organization invite links** (`/join/[code]`) show org name in link previews
  - Server-side `generateMetadata` with Firestore queries for rich social sharing
  - New client components: `JoinClassClient.tsx`, `JoinOrgClient.tsx`

- **Join Flow Fixes** (Jan 15):
  - **Class join links work for non-logged-in users** - redirects to auth, then processes join after login
  - **Org invite links work for non-logged-in teachers** - same flow with sessionStorage persistence
  - Pending join codes checked after all auth methods (email, Google, Apple)

- **Data Architecture Improvements** (Jan 15):
  - **New subcollection structure** for scalable user data storage (`/lib/userData.ts`)
  - **Migration utilities** for gradual migration from monolithic docs (`/lib/migration.ts`)
  - **Cross-teacher quiz sharing** within organizations (`/lib/organizations.ts`)
  - **Organization analytics** with overview stats, teacher leaderboards, topic performance (`/lib/orgAnalytics.ts`)
  - **Admin Dashboard enhancements**: Quiz Library tab and Analytics tab
  - **Firestore indexes** for optimized queries (`firestore.indexes.json`)
  - **Auto-migration on login** to subcollection structure (non-blocking)

- **Pricing Page**: Full marketing page at `/pricing` with:
  - Plan comparison cards with gradient styling
  - Monthly/yearly billing toggle (17% savings)
  - Feature comparison table
  - Testimonials and FAQ sections
  - Full dark/light mode support
  - **Honest messaging** - removed inflated claims ("Join thousands...")

- **UX Improvements**:
  - Dashboard stat cards have colored left borders for visual variety
  - Navigation header consistent across all pages (Dashboard, Create, Classes)
  - Class creation now navigates to Class Manager after success
  - Pro Plan profile section shows full feature list
  - Profile name editing with inline form
  - Share to Organization button for teachers in orgs (🏫 icon)
  - Separate `classManagerTab` state for class manager tabs (prevents modal input pollution)

- **Bug Fixes**:
  - Fixed Stripe webhook not updating user plan (Firebase fallback config)
  - Fixed 30 UX issues from comprehensive audit
  - Safe JSON parsing throughout app
  - Rate condition fixes in quiz navigation
  - **Fixed class creation modal stale closure bug** - `createClass` now accepts `inputValue` as parameter, modal passes `modalInput` to `onConfirm` callback
  - **Unified contact email** - all contact emails now use `support@quizforgeapp.com`

- **Accessibility & UX Audit Fixes** (Jan 15):
  - **Removed "Made with love for my GF" badge** - unprofessional for business product
  - **Added skip-to-content link** in root layout for screen readers (WCAG 2.1 AA)
  - **Added aria-labels** to all icon-only close buttons (×) in modals
  - **Improved semantic HTML** - Added `<main>` and `<article>` tags to pages
  - **Created custom 404 page** (`app/not-found.tsx`) with branded design

- **Practice Quiz Improvements** (Jan 16):
  - **Configurable question count** - All practice modes now show a modal to choose how many questions (5, 10, 15, 20, or All)
  - **Fixed 4 hardcoded limits** that were cutting quizzes to 10 questions:
    - Quiz preview/take test from teacher dashboard
    - Practice button in student dashboard
    - Practice Now button in quiz creation success modal
    - Practice button in quiz review page
  - **Topic practice** - Was hardcoded to 5 questions, now configurable
  - **Timed quiz** - Now lets users choose both time limit AND question count (was hardcoded to 20)

- **Quiz Generation Quality** (Jan 16):
  - **Reduced max questions from 50 to 30** for better AI accuracy
  - **Quality indicator** - Shows green "✓ Best quality range" when 10-20 selected
  - **Helpful hint** - "10-20 questions for best quality" shown otherwise

- **Tier-Based Question Bank Limits** (Jan 16):
  - **Free/Pro**: 500 questions max (with one-time info toast when limit hit)
  - **School**: 2,000 questions max
  - **University**: 5,000 questions max
  - **One-time warning** for individual users stored in localStorage

- **Share Quiz Truncation Fix** (Jan 16):
  - **Added toast notification** when sharing quizzes >50 questions: "ℹ️ Sharing first 50 of X questions"
  - Previously truncated silently without telling the user

- **Error Handling & Accessibility** (Jan 16):
  - **getShareUrl()** - Added try/catch with user-friendly error toast
  - **Storage validation** - Validates storage.set() result before proceeding
  - **Notification bell** - Added aria-label with dynamic unread count
  - **Review modal** - Added aria-label to close button

---

## New Files Added (Jan 15-18)

| File | Purpose |
|------|---------|
| `lib/userData.ts` | Data access layer with dual-mode support (legacy + subcollections) |
| `lib/migration.ts` | Migration utilities for moving users to new data structure |
| `lib/orgAnalytics.ts` | Organization-wide analytics functions |
| `lib/firebase-admin.ts` | Firebase Admin SDK for server-side auth verification |
| `firestore.rules` | Comprehensive Firestore security rules |
| `firestore.indexes.json` | Composite indexes for common queries |
| `components/ErrorBoundary.tsx` | React error boundary for graceful error handling |
| `app/class/[code]/JoinClassClient.tsx` | Client component for class join redirect flow |
| `app/join/[code]/JoinOrgClient.tsx` | Client component for organization invite join flow |
| `app/not-found.tsx` | Custom branded 404 error page |
| `playwright.config.ts` | Playwright test configuration |
| `tests/homepage.spec.ts` | Homepage rendering tests |
| `tests/auth.spec.ts` | Authentication flow tests |
| `tests/accessibility.spec.ts` | Accessibility compliance tests |
| `tests/shared-quiz.spec.ts` | Shared quiz functionality tests |

---

## Known Issues

- Teacher's student roster only updates on login (no real-time sync)
- Migration runs automatically on login but large accounts may take a few seconds

---

## Potential Future Enhancements

- Real-time updates for class roster
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

# Testing
npm test             # Run Playwright tests
npm run test:ui      # Run tests with Playwright UI

# Deployment
vercel               # Deploy to Vercel
vercel --prod        # Deploy to production

# Firebase
firebase deploy --only firestore:rules  # Deploy Firestore security rules

# iOS (Capacitor)
npx cap sync ios     # Sync web assets to iOS
npx cap open ios     # Open in Xcode
```

---

*Last updated: January 19, 2026 (Session 8 - Mobile Google Sign-in, Error Handling, Image Upload)*
