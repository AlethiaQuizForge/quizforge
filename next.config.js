const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},

  // SECURITY: Add security headers to all responses
  async headers() {
    // In production, we can be stricter with CSP
    // Note: 'unsafe-inline' for styles is needed for Next.js and Tailwind
    // Note: 'unsafe-eval' is needed in development for HMR, removed in production
    const isDev = process.env.NODE_ENV === 'development';

    const scriptSrc = isDev
      ? "'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.firebaseapp.com https://*.googleapis.com https://cdnjs.cloudflare.com"
      : "'self' 'unsafe-inline' https://js.stripe.com https://*.firebaseapp.com https://*.googleapis.com https://cdnjs.cloudflare.com";

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src ${scriptSrc}`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://accounts.google.com https://api.anthropic.com https://api.stripe.com wss://*.firebaseio.com https://*.sentry.io",
              "frame-src 'self' https://js.stripe.com https://*.firebaseapp.com https://accounts.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
}

// Only wrap with Sentry if DSN is configured
const sentryWebpackPluginOptions = {
  // Suppresses source map upload errors during build
  silent: true,
  // Only upload source maps if DSN is set
  dryRun: !process.env.SENTRY_AUTH_TOKEN,
};

module.exports = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
