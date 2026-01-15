// Stripe configuration and helpers
// NOTE: This is prepared but NOT active until STRIPE_SECRET_KEY is set in Vercel

import Stripe from 'stripe';

// Server-side Stripe instance
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    })
  : null;

// Plan definitions
// Note: quizzesPerMonth does NOT stack - resets each month
export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null,
    limits: {
      users: 1,
      quizzesPerMonth: 5,
      classesMax: 1,
      studentsPerClass: 30,
    },
    features: [
      '5 quizzes per month',
      '1 class with 30 students',
      'All question types',
      'PDF export',
      'Full analytics',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 9,
    priceId: process.env.STRIPE_PRO_PRICE_ID || null,
    limits: {
      users: 1,
      quizzesPerMonth: 25,
      classesMax: 3,
      studentsPerClass: 50,
    },
    features: [
      '25 quizzes per month',
      '3 classes with 50 students each',
      'All question types',
      'PDF export',
      'Full analytics',
    ],
  },
  // Organization plans - coming soon (requires admin dashboard)
  // school: { ... 25 teachers, $199/mo }
  // university: { ... 50 professors, $499/mo }
} as const;

export type PlanId = keyof typeof PLANS;

// Get plan by ID
export function getPlan(planId: PlanId) {
  return PLANS[planId] || PLANS.free;
}

// Check if user is within plan limits
export function checkPlanLimits(
  planId: PlanId,
  usage: {
    quizzesThisMonth?: number;
    classCount?: number;
    studentsInClass?: number;
  }
): { allowed: boolean; reason?: string } {
  const plan = getPlan(planId);
  const limits = plan.limits;

  // Check quizzes per month
  if (usage.quizzesThisMonth !== undefined && usage.quizzesThisMonth >= limits.quizzesPerMonth) {
    return {
      allowed: false,
      reason: `You've reached your ${limits.quizzesPerMonth} quiz limit for this month. Upgrade for more quizzes.`,
    };
  }

  // Check class count
  if (usage.classCount !== undefined && usage.classCount >= limits.classesMax) {
    return {
      allowed: false,
      reason: `You've reached your ${limits.classesMax} class limit. Upgrade to add more classes.`,
    };
  }

  // Check students per class
  if (usage.studentsInClass !== undefined && usage.studentsInClass >= limits.studentsPerClass) {
    return {
      allowed: false,
      reason: `This class has reached the ${limits.studentsPerClass} student limit. Upgrade for more students per class.`,
    };
  }

  return { allowed: true };
}

// Format price for display
export function formatPrice(price: number): string {
  if (price === 0) return 'Free';
  return `$${price}/mo`;
}
