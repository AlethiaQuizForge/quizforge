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
export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null, // No Stripe price for free
    limits: {
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
      quizzesPerMonth: -1, // unlimited
      classesMax: 5,
      studentsPerClass: 100,
    },
    features: [
      'Unlimited quizzes',
      '5 classes with 100 students each',
      'All question types',
      'PDF export',
      'Full analytics',
      'Priority support',
    ],
  },
  institution: {
    id: 'institution',
    name: 'Institution',
    price: 199, // Starting price, can be custom
    priceId: process.env.STRIPE_INSTITUTION_PRICE_ID || null,
    limits: {
      quizzesPerMonth: -1,
      classesMax: -1, // unlimited
      studentsPerClass: -1, // unlimited
    },
    features: [
      'Unlimited everything',
      'Admin dashboard',
      'Email domain access',
      'Usage analytics',
      'Priority support',
      'Invoice billing',
    ],
  },
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

  // Check quizzes per month (-1 means unlimited)
  if (limits.quizzesPerMonth !== -1 && usage.quizzesThisMonth !== undefined) {
    if (usage.quizzesThisMonth >= limits.quizzesPerMonth) {
      return {
        allowed: false,
        reason: `You've reached your ${limits.quizzesPerMonth} quiz limit for this month. Upgrade to Pro for unlimited quizzes.`,
      };
    }
  }

  // Check class count
  if (limits.classesMax !== -1 && usage.classCount !== undefined) {
    if (usage.classCount >= limits.classesMax) {
      return {
        allowed: false,
        reason: `You've reached your ${limits.classesMax} class limit. Upgrade to add more classes.`,
      };
    }
  }

  // Check students per class
  if (limits.studentsPerClass !== -1 && usage.studentsInClass !== undefined) {
    if (usage.studentsInClass >= limits.studentsPerClass) {
      return {
        allowed: false,
        reason: `This class has reached the ${limits.studentsPerClass} student limit. Upgrade for more students per class.`,
      };
    }
  }

  return { allowed: true };
}

// Format price for display
export function formatPrice(price: number): string {
  if (price === 0) return 'Free';
  return `$${price}/mo`;
}
