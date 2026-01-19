// Server-side API route to submit scores to shared quizzes
// This allows anonymous users to update leaderboard and timesTaken

import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quizId, playerName, score } = body;

    if (!quizId || typeof score !== 'number') {
      return NextResponse.json({ error: 'Quiz ID and score required' }, { status: 400 });
    }

    // Validate score is a reasonable percentage (0-100)
    if (score < 0 || score > 100) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    // Sanitize player name (limit length, remove dangerous characters)
    const sanitizedName = (playerName || 'Anonymous')
      .slice(0, 50)
      .replace(/[<>]/g, '');

    const db = getAdminFirestore();
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const docRef = db.collection('userData').doc(`shared-${quizId}`);
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

      // Increment times taken
      const timesTaken = (data.timesTaken || 0) + 1;

      // Update leaderboard (top 10 scores)
      const leaderboard = data.leaderboard || [];
      const newEntry = {
        name: sanitizedName,
        score: Math.round(score),
        date: Date.now()
      };

      leaderboard.push(newEntry);
      leaderboard.sort((a: { score: number; date: number }, b: { score: number; date: number }) =>
        b.score - a.score || a.date - b.date
      );
      const updatedLeaderboard = leaderboard.slice(0, 10);

      // Update the document
      await docRef.update({
        timesTaken,
        leaderboard: updatedLeaderboard,
        updatedAt: new Date()
      });

      return NextResponse.json({
        success: true,
        timesTaken,
        leaderboard: updatedLeaderboard
      });
    } catch {
      return NextResponse.json({ error: 'Quiz data corrupted' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error submitting score:', error);
    return NextResponse.json({ error: 'Failed to submit score' }, { status: 500 });
  }
}
