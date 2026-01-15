'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function JoinClassPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  useEffect(() => {
    // Store the class code in sessionStorage so the app can pick it up
    if (code) {
      sessionStorage.setItem('pendingClassCode', code.toUpperCase());
    }
    // Redirect to main app - it will handle the join flow
    router.replace('/?join=class');
  }, [code, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-slate-600 dark:text-slate-300">Joining class...</p>
      </div>
    </div>
  );
}
