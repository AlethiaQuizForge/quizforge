// Stripe webhook handler
// NOTE: Not active until STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are configured

import { NextRequest, NextResponse } from 'next/server';
import { getStripe, isOrgPlan, PlanId } from '@/lib/stripe';
import type { OrgPlanId } from '@/lib/organizations';
import Stripe from 'stripe';
import {
  updateServerUserData,
  setStripeCustomerMapping,
  getUserIdByStripeCustomer,
} from '@/lib/firebase-admin';

// Dynamic imports to avoid Firebase initialization during build
async function getOrgHelpers() {
  const { createOrganization } = await import('@/lib/organizations');
  return { createOrganization };
}

// Disable body parsing, we need raw body for webhook verification
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const stripe = getStripe();
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
        const planId = session.metadata?.planId as PlanId | undefined;
        const userEmail = session.customer_email || session.metadata?.userEmail;
        const orgName = session.metadata?.orgName;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId && planId && customerId) {
          // Store the customerId -> userId mapping for efficient future lookups
          await setStripeCustomerMapping(customerId, userId);

          // Check if this is an organization plan
          if (isOrgPlan(planId)) {
            // Create organization for School/University plans
            try {
              const { createOrganization } = await getOrgHelpers();
              const org = await createOrganization({
                name: orgName || `${planId === 'university' ? 'University' : 'School'} Organization`,
                plan: planId as OrgPlanId,
                adminUserId: userId,
                adminEmail: userEmail || '',
                stripeCustomerId: customerId,
                stripeSubscriptionId: subscriptionId,
              });

              console.log(`Created organization ${org.id} for user ${userId}`);
            } catch (err) {
              console.error('Failed to create organization:', err);
            }
          } else {
            // Individual plan (Pro) - update user's plan using admin SDK
            const updated = await updateServerUserData(userId, {
              plan: planId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              subscriptionStatus: 'active',
              subscribedAt: new Date().toISOString(),
            });

            if (updated) {
              console.log(`Updated user ${userId} to plan ${planId}`);
            } else {
              console.error(`Failed to update user ${userId} plan`);
            }
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;

        // Use indexed lookup instead of scanning all users
        const userId = await getUserIdByStripeCustomer(customerId);

        if (userId) {
          const updated = await updateServerUserData(userId, {
            subscriptionStatus: status,
            subscriptionUpdatedAt: new Date().toISOString(),
          });

          if (updated) {
            console.log(`Updated subscription status for user ${userId} to ${status}`);
          }
        } else {
          console.warn(`No user found for Stripe customer ${customerId}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Use indexed lookup instead of scanning all users
        const userId = await getUserIdByStripeCustomer(customerId);

        if (userId) {
          const updated = await updateServerUserData(userId, {
            plan: 'free',
            subscriptionStatus: 'cancelled',
            subscriptionCancelledAt: new Date().toISOString(),
            // Keep stripeCustomerId for potential resubscription
          });

          if (updated) {
            console.log(`Downgraded user ${userId} to free plan`);
          }
        } else {
          console.warn(`No user found for Stripe customer ${customerId}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Use indexed lookup instead of scanning all users
        const userId = await getUserIdByStripeCustomer(customerId);

        if (userId) {
          const updated = await updateServerUserData(userId, {
            subscriptionStatus: 'past_due',
            paymentFailedAt: new Date().toISOString(),
          });

          if (updated) {
            console.log(`Marked payment failed for user ${userId}`);
          }
        } else {
          console.warn(`No user found for Stripe customer ${customerId}`);
        }
        break;
      }

      default:
        // Log unhandled events for debugging (remove in production if too noisy)
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
