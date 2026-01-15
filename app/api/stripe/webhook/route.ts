// Stripe webhook handler
// NOTE: Not active until STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are configured

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

// Disable body parsing, we need raw body for webhook verification
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: 'Payments are not enabled' },
      { status: 503 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId && planId) {
          // TODO: Update user's plan in Firebase
          // This will be implemented when we connect to your user system
          console.log(`User ${userId} subscribed to ${planId}`, {
            customerId,
            subscriptionId,
          });

          // Example Firebase update (uncomment when ready):
          // await updateUserPlan(userId, {
          //   planId,
          //   stripeCustomerId: customerId,
          //   stripeSubscriptionId: subscriptionId,
          //   subscriptionStatus: 'active',
          //   subscribedAt: new Date().toISOString(),
          // });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;

        console.log(`Subscription ${subscription.id} updated to ${status}`, {
          customerId,
        });

        // TODO: Update subscription status in Firebase
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        console.log(`Subscription ${subscription.id} cancelled`, {
          customerId,
        });

        // TODO: Downgrade user to free plan in Firebase
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        console.log(`Payment failed for customer ${customerId}`);

        // TODO: Notify user and/or update status
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}
