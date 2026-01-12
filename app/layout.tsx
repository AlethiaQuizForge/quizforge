// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'QuizForge - AI-Powered Quiz Generator',
  description: 'Turn course materials into smart quizzes & exams in seconds. Upload PDFs, slides, or notes and let AI generate high-quality assessment questions.',
  keywords: 'quiz generator, AI quiz, education, assessment, teaching tools, exam generator',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'QuizForge',
  },
  openGraph: {
    title: 'QuizForge - AI-Powered Quiz Generator',
    description: 'Turn course materials into smart quizzes in seconds.',
    type: 'website',
    siteName: 'QuizForge',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuizForge - AI-Powered Quiz Generator',
    description: 'Turn course materials into smart quizzes in seconds.',
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
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
