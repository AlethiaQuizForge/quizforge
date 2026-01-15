// API route to create Stripe checkout session
// NOTE: Not active until STRIPE_SECRET_KEY is configured

import { NextRequest, NextResponse } from 'next/server';
import { stripe, PLANS, PlanId } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  // Check if Stripe is configured
  if (!stripe) {
    return NextResponse.json(
      { error: 'Payments are not yet enabled' },
      { status: 503 }
    );
  }

  try {
    const { planId, userId, userEmail } = await request.json();

    // Validate plan
    if (!planId || !PLANS[planId as PlanId]) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      );
    }

    const plan = PLANS[planId as PlanId];

    // Can't checkout for free plan
    if (!plan.priceId) {
      return NextResponse.json(
        { error: 'This plan does not require payment' },
        { status: 400 }
      );
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.priceId,
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
      },
      // For EU compliance
      billing_address_collection: 'required',
      tax_id_collection: {
        enabled: true,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
