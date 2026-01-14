const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
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
