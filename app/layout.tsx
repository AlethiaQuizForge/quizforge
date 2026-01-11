// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'QuizForge - AI-Powered Quiz Generator',
  description: 'Turn course materials into smart quizzes in seconds. Upload PDFs, slides, or notes and let AI generate high-quality assessment questions.',
  keywords: 'quiz generator, AI quiz, education, assessment, teaching tools',
  openGraph: {
    title: 'QuizForge - AI-Powered Quiz Generator',
    description: 'Turn course materials into smart quizzes in seconds.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
