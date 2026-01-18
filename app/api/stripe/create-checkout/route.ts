// API route to create Stripe checkout session
// NOTE: Not active until STRIPE_SECRET_KEY is configured
// SECURITY: Requires authentication and uses authenticated user's ID

import { NextRequest, NextResponse } from 'next/server';
import { getStripe, PLANS, PlanId, isOrgPlan } from '@/lib/stripe';
import { verifyAuthFromRequest } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  // Check if Stripe is configured (lazy init at runtime)
  const stripe = getStripe();

  if (!stripe) {
    return NextResponse.json(
      { error: 'Payments are not yet enabled' },
      { status: 503 }
    );
  }

  try {
    // SECURITY: Verify authentication and use authenticated user's ID
    const auth = await verifyAuthFromRequest(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: auth.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { planId, orgName, billingCycle = 'monthly' } = await request.json();

    // SECURITY: Use authenticated user's ID and email, not client-provided values
    const userId = auth.userId;
    const userEmail = auth.email;

    // Validate plan
    if (!planId || !PLANS[planId as PlanId]) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      );
    }

    // Validate billing cycle
    if (billingCycle !== 'monthly' && billingCycle !== 'yearly') {
      return NextResponse.json(
        { error: 'Invalid billing cycle' },
        { status: 400 }
      );
    }

    const plan = PLANS[planId as PlanId];

    // Get the appropriate price ID based on billing cycle
    const priceId = billingCycle === 'yearly' ? plan.yearlyPriceId : plan.priceId;

    // Can't checkout for free plan or if price ID not configured
    if (!priceId) {
      if (plan.price === 0) {
        return NextResponse.json(
          { error: 'This plan does not require payment' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: `${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} billing not yet available for this plan` },
        { status: 400 }
      );
    }

    // Generate idempotency key to prevent duplicate sessions from double-clicks
    // Key is valid for 24 hours, based on user + plan + 5-minute window
    const timeWindow = Math.floor(Date.now() / (5 * 60 * 1000)); // 5-minute windows
    const idempotencyKey = `checkout_${userId}_${planId}_${billingCycle}_${timeWindow}`;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.quizforgeapp.com'}?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.quizforgeapp.com'}?subscription=cancelled`,
        customer_email: userEmail,
        client_reference_id: userId,
        metadata: {
          userId,
          planId,
          userEmail: userEmail || '',
          // Include org name for organization plans
          ...(isOrgPlan(planId as PlanId) && orgName ? { orgName } : {}),
        },
        // For EU compliance
        billing_address_collection: 'required',
        tax_id_collection: {
          enabled: true,
        },
        // Enable invoice generation and emails
        invoice_creation: {
          enabled: true,
        },
        // Subscription settings
        subscription_data: {
          metadata: {
            userId,
            planId,
          },
        },
      },
      {
        idempotencyKey,
      }
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
