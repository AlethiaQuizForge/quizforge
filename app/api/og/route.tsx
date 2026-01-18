// app/api/og/route.tsx
// Dynamic Open Graph image generation for shared quizzes

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const quizId = searchParams.get('quiz');

  // Default values
  let title = 'QuizForge';
  let subtitle = 'AI-Powered Quiz Generator';
  let questionCount = 0;
  let timesTaken = 0;

  // Try to fetch quiz data if quizId provided
  if (quizId) {
    try {
      const db = getAdminFirestore();
      if (db) {
        const docRef = db.collection('userData').doc(`shared-${quizId}`);
        const doc = await docRef.get();

        if (doc.exists) {
          const data = doc.data();
          if (data?.value) {
            try {
              const quizData = JSON.parse(data.value);
              title = quizData.title || quizData.subject || 'Shared Quiz';
              subtitle = quizData.subject || 'Take this quiz!';
              questionCount = quizData.questions?.length || 0;
              timesTaken = data.timesTaken || 0;
            } catch {
              // Parse error, use defaults
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching quiz for OG image:', error);
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #a855f7 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: '40px',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 30,
          }}
        >
          <svg
            width="60"
            height="60"
            viewBox="0 0 100 100"
            style={{ marginRight: 15 }}
          >
            <rect x="10" y="10" width="80" height="80" rx="15" fill="white" />
            <text x="50" y="68" fontSize="50" textAnchor="middle" fill="#6366f1">Q</text>
          </svg>
          <span
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-1px',
            }}
          >
            QuizForge
          </span>
        </div>

        {/* Quiz Title */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: 'white',
            textAlign: 'center',
            marginBottom: 20,
            maxWidth: '90%',
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        {subtitle !== title && (
          <div
            style={{
              fontSize: 32,
              color: 'rgba(255, 255, 255, 0.9)',
              marginBottom: 30,
            }}
          >
            {subtitle}
          </div>
        )}

        {/* Stats */}
        <div
          style={{
            display: 'flex',
            gap: 30,
            marginTop: 20,
          }}
        >
          {questionCount > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '12px 24px',
                borderRadius: 30,
                color: 'white',
                fontSize: 24,
                fontWeight: 500,
              }}
            >
              {questionCount} Questions
            </div>
          )}
          {timesTaken > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '12px 24px',
                borderRadius: 30,
                color: 'white',
                fontSize: 24,
                fontWeight: 500,
              }}
            >
              {timesTaken} Plays
            </div>
          )}
        </div>

        {/* CTA */}
        <div
          style={{
            position: 'absolute',
            bottom: 50,
            fontSize: 28,
            color: 'rgba(255, 255, 255, 0.8)',
            fontWeight: 600,
          }}
        >
          Click to take the quiz!
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
