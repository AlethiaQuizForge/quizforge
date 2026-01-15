// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SentryProvider } from './sentry-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'QuizForge - AI-Powered Quiz Generator | Create Quizzes in Seconds',
    template: '%s | QuizForge'
  },
  description: 'Free AI quiz generator for teachers and students. Turn PDFs, slides, and notes into smart quizzes in seconds. Used by students at Copenhagen Business School. No signup required to try!',
  keywords: 'quiz generator, AI quiz, education, assessment, teaching tools, exam generator, free quiz maker, online quiz creator, study tool, flashcard alternative, test generator, CBS, Copenhagen Business School',
  manifest: '/manifest.json',
  metadataBase: new URL('https://www.quizforgeapp.com'),
  alternates: {
    canonical: '/',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'QuizForge',
  },
  openGraph: {
    title: 'QuizForge - Create AI-Powered Quizzes in Seconds',
    description: 'Free quiz generator for teachers and students. Upload any document and get instant quizzes. Used at Copenhagen Business School.',
    type: 'website',
    siteName: 'QuizForge',
    url: 'https://www.quizforgeapp.com',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuizForge - AI Quiz Generator',
    description: 'Turn any document into smart quizzes in seconds. Free for teachers and students.',
    creator: '@quizforge',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// JSON-LD structured data for SEO
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': 'https://www.quizforgeapp.com/#webapp',
      'name': 'QuizForge',
      'url': 'https://www.quizforgeapp.com',
      'description': 'AI-powered quiz generator that turns course materials into smart quizzes and exams in seconds.',
      'applicationCategory': 'EducationalApplication',
      'operatingSystem': 'Any',
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'USD'
      },
      'featureList': [
        'AI-powered quiz generation',
        'PDF and document upload',
        'Multiple choice questions',
        'True/false questions',
        'Class management for teachers',
        'Progress tracking',
        'Quiz sharing',
        'PDF export'
      ]
    },
    {
      '@type': 'Organization',
      '@id': 'https://www.quizforgeapp.com/#organization',
      'name': 'QuizForge',
      'url': 'https://www.quizforgeapp.com',
      'logo': 'https://www.quizforgeapp.com/icon.svg',
      'sameAs': []
    },
    {
      '@type': 'WebSite',
      '@id': 'https://www.quizforgeapp.com/#website',
      'url': 'https://www.quizforgeapp.com',
      'name': 'QuizForge',
      'publisher': {
        '@id': 'https://www.quizforgeapp.com/#organization'
      }
    },
    {
      '@type': 'FAQPage',
      'mainEntity': [
        {
          '@type': 'Question',
          'name': 'How does QuizForge generate quizzes?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'QuizForge uses advanced AI to analyze your course materials (PDFs, slides, notes) and automatically generates high-quality multiple choice and true/false questions that test understanding, not just memorization.'
          }
        },
        {
          '@type': 'Question',
          'name': 'What types of files can I upload?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'QuizForge accepts PDF files, PowerPoint presentations, text documents, and plain text. Simply drag and drop or paste your content to get started.'
          }
        },
        {
          '@type': 'Question',
          'name': 'Is QuizForge free to use?',
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': 'Yes! QuizForge offers free quiz generation with no hidden costs. Teachers, students, and content creators can generate unlimited quizzes.'
          }
        }
      ]
    }
  ]
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="QuizForge" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
          {/* Skip to main content link for accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-white"
          >
            Skip to main content
          </a>
          <SentryProvider>
            {children}
          </SentryProvider>
          <Analytics />
        </body>
    </html>
  )
}
