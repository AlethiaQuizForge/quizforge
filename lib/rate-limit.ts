// Rate limiter with Redis (Upstash) support for production
// Falls back to in-memory for local development

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Check if Upstash is configured
const isUpstashConfigured = !!(
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
);

// Create Redis-based rate limiter if Upstash is configured
let redisRatelimit: Ratelimit | null = null;

if (isUpstashConfigured) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  redisRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    analytics: true,
    prefix: 'quizforge',
  });
}

// Fallback in-memory rate limiter for local development
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up old entries periodically (only for in-memory)
if (!isUpstashConfigured) {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now > entry.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 60000);
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number;
}

/**
 * Rate limit a request by identifier
 * Uses Redis (Upstash) in production, in-memory for local dev
 */
export async function rateLimitAsync(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Use Redis rate limiter if available
  if (redisRatelimit) {
    try {
      const result = await redisRatelimit.limit(identifier);
      return {
        success: result.success,
        remaining: result.remaining,
        resetIn: result.reset - Date.now(),
      };
    } catch (error) {
      console.error('Redis rate limit error, falling back to in-memory:', error);
      // Fall through to in-memory on error
    }
  }

  // Fallback to in-memory rate limiting
  return rateLimitSync(identifier, config);
}

/**
 * Synchronous in-memory rate limiter (fallback)
 */
function rateLimitSync(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

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

  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }

  entry.count++;
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetTime - now,
  };
}

/**
 * Legacy synchronous rate limit function
 * Kept for backward compatibility, but prefers async version
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  // For sync calls, use in-memory only
  // API routes should migrate to rateLimitAsync
  return rateLimitSync(identifier, config);
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
