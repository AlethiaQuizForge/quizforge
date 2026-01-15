import { Metadata } from 'next';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import JoinClassClient from './JoinClassClient';

type Props = {
  params: Promise<{ code: string }>;
};

// Fetch class data for metadata
async function getClassData(code: string) {
  try {
    const classesRef = collection(db, 'classes');
    const q = query(classesRef, where('code', '==', code.toUpperCase()));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const classData = snapshot.docs[0].data();
      return {
        name: classData.name || 'Class',
        teacherName: classData.teacherName || 'a teacher',
        code: code.toUpperCase()
      };
    }
  } catch (error) {
    console.error('Error fetching class for metadata:', error);
  }
  return null;
}

// Dynamic metadata for link previews
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const classData = await getClassData(code);

  if (classData) {
    return {
      title: `Join ${classData.name} | QuizForge`,
      description: `You've been invited to join "${classData.name}" by ${classData.teacherName} on QuizForge. Join now to access quizzes and assignments!`,
      openGraph: {
        title: `Join ${classData.name} on QuizForge`,
        description: `${classData.teacherName} invited you to join "${classData.name}". Click to join and start taking quizzes!`,
        siteName: 'QuizForge - Create AI-Powered Quizzes in Seconds',
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title: `Join ${classData.name} on QuizForge`,
        description: `${classData.teacherName} invited you to join "${classData.name}". Click to join and start taking quizzes!`,
      },
    };
  }

  // Fallback if class not found
  return {
    title: 'Join a Class | QuizForge',
    description: 'Join a class on QuizForge to access quizzes and assignments from your teacher.',
    openGraph: {
      title: 'Join a Class on QuizForge',
      description: 'Join a class on QuizForge to access quizzes and assignments from your teacher.',
      siteName: 'QuizForge - Create AI-Powered Quizzes in Seconds',
    },
  };
}

export default async function JoinClassPage({ params }: Props) {
  const { code } = await params;
  return <JoinClassClient code={code} />;
}
