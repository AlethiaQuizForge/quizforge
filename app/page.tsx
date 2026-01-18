// app/page.tsx
import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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

// Fetch shared quiz data for OG metadata
async function getSharedQuizData(quizId: string) {
  try {
    // Use Firebase Admin to fetch from Firestore
    const { getAdminFirestore } = await import('@/lib/firebase-admin');

    const db = getAdminFirestore();
    if (!db) return null;

    const docRef = db.collection('userData').doc(`shared-${quizId}`);
    const doc = await docRef.get();

    if (!doc.exists) return null;

    const data = doc.data();
    if (!data?.value) return null;

    try {
      const quizData = JSON.parse(data.value);
      return {
        title: quizData.title || quizData.subject || 'Shared Quiz',
        subject: quizData.subject || '',
        questionCount: quizData.questions?.length || 0,
        createdBy: quizData.createdBy || '',
        timesTaken: data.timesTaken || 0,
      };
    } catch {
      return null;
    }
  } catch (error) {
    console.error('Error fetching shared quiz for metadata:', error);
    return null;
  }
}

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const quizId = typeof params.quiz === 'string' ? params.quiz : undefined;

  // Default metadata
  const defaultMetadata: Metadata = {
    title: 'QuizForge - AI-Powered Quiz Generator',
    description: 'Free AI quiz generator for teachers and students. Turn PDFs, slides, and notes into smart quizzes in seconds.',
    openGraph: {
      title: 'QuizForge - Create AI-Powered Quizzes in Seconds',
      description: 'Free quiz generator for teachers and students. Upload any document and get instant quizzes.',
      type: 'website',
      siteName: 'QuizForge',
      url: 'https://www.quizforgeapp.com',
      images: ['/opengraph-image'],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'QuizForge - AI Quiz Generator',
      description: 'Turn any document into smart quizzes in seconds.',
    },
  };

  // If no quiz parameter, return default
  if (!quizId) {
    return defaultMetadata;
  }

  // Fetch shared quiz data
  const quizData = await getSharedQuizData(quizId);

  if (!quizData) {
    return defaultMetadata;
  }

  // Build dynamic metadata for shared quiz
  const title = `${quizData.title} - Take this Quiz!`;
  const description = quizData.subject
    ? `${quizData.questionCount} questions about ${quizData.subject}. ${quizData.timesTaken > 0 ? `Taken ${quizData.timesTaken} times.` : ''} Try it now on QuizForge!`
    : `${quizData.questionCount} questions. ${quizData.timesTaken > 0 ? `Taken ${quizData.timesTaken} times.` : ''} Try it now on QuizForge!`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'QuizForge',
      url: `https://www.quizforgeapp.com?quiz=${quizId}`,
      images: [{
        url: `/api/og?quiz=${quizId}`,
        width: 1200,
        height: 630,
        alt: quizData.title,
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og?quiz=${quizId}`],
    },
  };
}

export default function Home() {
  return (
    <ErrorBoundary>
      <QuizForge />
    </ErrorBoundary>
  );
}
