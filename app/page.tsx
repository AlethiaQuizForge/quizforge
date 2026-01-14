// app/page.tsx
'use client';

import dynamic from 'next/dynamic';

// Dynamic import with code splitting - reduces initial bundle size
const QuizForge = dynamic(() => import('@/components/QuizForge'), {
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-pulse">⚡</div>
        <p className="text-white text-xl font-semibold">QuizForge</p>
        <p className="text-indigo-300 mt-2">Loading...</p>
      </div>
    </div>
  ),
  ssr: false // Client-side only since it uses browser APIs (localStorage, etc.)
});

export default function Home() {
  return <QuizForge />
}
