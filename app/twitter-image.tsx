import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'QuizForge - AI-Powered Quiz Generator'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
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
        }}
      >
        {/* Logo/Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 30,
          }}
        >
          <svg
            width="80"
            height="80"
            viewBox="0 0 100 100"
            style={{ marginRight: 20 }}
          >
            <rect x="10" y="10" width="80" height="80" rx="15" fill="white" />
            <text x="50" y="68" fontSize="50" textAnchor="middle" fill="#6366f1">Q</text>
          </svg>
          <span
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-2px',
            }}
          >
            QuizForge
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 36,
            color: 'rgba(255, 255, 255, 0.95)',
            marginBottom: 40,
            fontWeight: 500,
          }}
        >
          AI-Powered Quiz Generator
        </div>

        {/* Features */}
        <div
          style={{
            display: 'flex',
            gap: 40,
            marginTop: 10,
          }}
        >
          {['Upload PDFs', 'Instant Quizzes', 'Free to Use'].map((feature) => (
            <div
              key={feature}
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
              <span style={{ marginRight: 10 }}>✓</span>
              {feature}
            </div>
          ))}
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 24,
            color: 'rgba(255, 255, 255, 0.7)',
          }}
        >
          quizforgeapp.com
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
