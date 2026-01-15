import { Metadata } from 'next';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import JoinOrgClient from './JoinOrgClient';

type Props = {
  params: Promise<{ code: string }>;
};

// Fetch organization data for metadata
async function getOrgData(code: string) {
  try {
    const orgsRef = collection(db, 'organizations');
    const q = query(orgsRef, where('inviteCode', '==', code.toLowerCase()));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const orgData = snapshot.docs[0].data();
      return {
        name: orgData.name || 'Organization',
        plan: orgData.plan || 'school',
      };
    }
  } catch (error) {
    console.error('Error fetching org for metadata:', error);
  }
  return null;
}

// Dynamic metadata for link previews
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const orgData = await getOrgData(code);

  if (orgData) {
    const planName = orgData.plan === 'university' ? 'University' : 'School';
    return {
      title: `Join ${orgData.name} | QuizForge`,
      description: `You've been invited to join ${orgData.name} on QuizForge. Join your ${planName.toLowerCase()}'s team to collaborate and share quizzes!`,
      openGraph: {
        title: `Join ${orgData.name} on QuizForge`,
        description: `You're invited to join ${orgData.name}! As a member, you can share quizzes with colleagues and access organization resources.`,
        siteName: 'QuizForge - Create AI-Powered Quizzes in Seconds',
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title: `Join ${orgData.name} on QuizForge`,
        description: `You're invited to join ${orgData.name}! Collaborate with your team and share educational resources.`,
      },
    };
  }

  // Fallback if org not found
  return {
    title: 'Join an Organization | QuizForge',
    description: 'Join your school or university on QuizForge to collaborate with colleagues and share quizzes.',
    openGraph: {
      title: 'Join an Organization on QuizForge',
      description: 'Join your school or university on QuizForge to collaborate with colleagues and share quizzes.',
      siteName: 'QuizForge - Create AI-Powered Quizzes in Seconds',
    },
  };
}

export default async function JoinOrgPage({ params }: Props) {
  const { code } = await params;
  return <JoinOrgClient code={code} />;
}
