// API route to create Stripe customer portal session
// Allows users to manage their subscription, update payment method, etc.
// SECURITY: Requires authentication and verifies user owns the customer account

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { verifyAuthFromRequest, getServerUserData } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: 'Payments are not yet enabled' },
      { status: 503 }
    );
  }

  try {
    // SECURITY: Verify authentication
    const auth = await verifyAuthFromRequest(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { error: auth.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { customerId } = await request.json();

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID required' },
        { status: 400 }
      );
    }

    // SECURITY: Verify the authenticated user owns this Stripe customer ID
    const userData = await getServerUserData(auth.userId);
    if (!userData || userData.stripeCustomerId !== customerId) {
      console.warn(`User ${auth.userId} attempted to access Stripe portal for customer ${customerId}`);
      return NextResponse.json(
        { error: 'Unauthorized: You can only access your own billing portal' },
        { status: 403 }
      );
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.quizforgeapp.com'}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal session error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
