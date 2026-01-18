// Simple in-memory rate limiter for serverless
//
// ⚠️  PRODUCTION WARNING: This in-memory rate limiter has limitations!
// On Vercel/serverless, each instance has its own memory, so rate limits
// are per-instance, not global. A user could bypass limits by hitting
// different serverless instances.
//
// For production, implement Redis-based rate limiting with Upstash:
// 1. Sign up at https://upstash.com/ (free tier available)
// 2. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to env
// 3. Replace this with @upstash/ratelimit package
//
// Example with Upstash:
// import { Ratelimit } from "@upstash/ratelimit";
// import { Redis } from "@upstash/redis";
// const ratelimit = new Ratelimit({
//   redis: Redis.fromEnv(),
//   limiter: Ratelimit.slidingWindow(20, "1 h"),
// });

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000); // Clean up every minute

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number;  // ms until reset
}

export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  // If no entry or window expired, create new entry
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }

  // Increment counter
  entry.count++;
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetTime - now,
  };
}

// Get IP from request headers (works with Vercel)
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}
