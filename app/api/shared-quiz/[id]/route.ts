// Server-side API route to fetch shared quizzes
// This bypasses client-side Firestore connection issues

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Quiz ID required' }, { status: 400 });
    }

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const docRef = db.collection('userData').doc(`shared-${id}`);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const data = doc.data();
    if (!data?.value) {
      return NextResponse.json({ error: 'Quiz data invalid' }, { status: 404 });
    }

    try {
      const quizData = JSON.parse(data.value);
      return NextResponse.json({
        quiz: quizData,
        timesTaken: data.timesTaken || 0,
        leaderboard: data.leaderboard || [],
      });
    } catch {
      return NextResponse.json({ error: 'Quiz data corrupted' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error fetching shared quiz:', error);
    return NextResponse.json({ error: 'Failed to fetch quiz' }, { status: 500 });
  }
}
