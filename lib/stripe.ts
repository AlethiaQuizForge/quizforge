// Stripe configuration and helpers
// NOTE: This is prepared but NOT active until STRIPE_SECRET_KEY is set in Vercel

import Stripe from 'stripe';

// Lazy-initialized Stripe instance to ensure env vars are available at runtime
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (stripeInstance) return stripeInstance;

  if (process.env.STRIPE_SECRET_KEY) {
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    });
  }

  return stripeInstance;
}

// For backwards compatibility - but prefer getStripe() for runtime usage
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
    yearlyPriceId: null,
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
    yearlyPriceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID || null,
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
  // Organization plans
  school: {
    id: 'school',
    name: 'School',
    price: 199,
    priceId: process.env.STRIPE_SCHOOL_PRICE_ID || null,
    yearlyPriceId: process.env.STRIPE_SCHOOL_YEARLY_PRICE_ID || null,
    isOrgPlan: true,
    limits: {
      users: 25,
      quizzesPerMonth: 25, // Per teacher
      classesMax: 3, // Per teacher
      studentsPerClass: 50,
    },
    features: [
      '25 teachers',
      '25 quizzes per teacher/month',
      '3 classes per teacher, 50 students each',
      'Admin dashboard',
      'Organization-wide analytics',
    ],
  },
  university: {
    id: 'university',
    name: 'University',
    price: 499,
    priceId: process.env.STRIPE_UNIVERSITY_PRICE_ID || null,
    yearlyPriceId: process.env.STRIPE_UNIVERSITY_YEARLY_PRICE_ID || null,
    isOrgPlan: true,
    limits: {
      users: 50,
      quizzesPerMonth: 35, // Per professor
      classesMax: 10, // Per professor
      studentsPerClass: 100,
    },
    features: [
      '50 professors',
      '35 quizzes per professor/month',
      '10 classes per professor, 100 students each',
      'Admin dashboard',
      'Organization-wide analytics',
      'Invoice billing',
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;
export type IndividualPlanId = 'free' | 'pro';
export type OrgPlanId = 'school' | 'university';

// Get plan by ID
export function getPlan(planId: PlanId) {
  return PLANS[planId] || PLANS.free;
}

// Check if a plan is an organization plan
export function isOrgPlan(planId: PlanId): boolean {
  const plan = PLANS[planId];
  return 'isOrgPlan' in plan && plan.isOrgPlan === true;
}

// Get individual plans only (for personal pricing UI)
export function getIndividualPlans() {
  return {
    free: PLANS.free,
    pro: PLANS.pro,
  };
}

// Get organization plans only (for institution pricing UI)
export function getOrgPlans() {
  return {
    school: PLANS.school,
    university: PLANS.university,
  };
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
