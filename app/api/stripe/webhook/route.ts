// Stripe webhook handler
// NOTE: Not active until STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are configured

import { NextRequest, NextResponse } from 'next/server';
import { getStripe, isOrgPlan, PlanId } from '@/lib/stripe';
import type { OrgPlanId } from '@/lib/organizations';
import Stripe from 'stripe';

// Dynamic imports to avoid Firebase initialization during build
async function getFirebaseDb() {
  const { db } = await import('@/lib/firebase');
  return db;
}

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

        if (userId && planId) {
          console.log(`User ${userId} subscribed to ${planId}`, {
            customerId,
            subscriptionId,
          });

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
            // Individual plan (Pro) - update user's plan in Firebase
            // QuizForge stores user data as { value: JSON.stringify(userData) }
            try {
              const db = await getFirebaseDb();
              const { doc, getDoc, updateDoc } = await import('firebase/firestore');
              const userDocRef = doc(db, 'userData', `quizforge-account-${userId}`);

              // Get existing user data
              const userDoc = await getDoc(userDocRef);
              if (userDoc.exists()) {
                const existingData = userDoc.data();
                let userData = {};

                // Parse existing value if it exists
                if (existingData.value) {
                  try {
                    userData = JSON.parse(existingData.value);
                  } catch {
                    userData = existingData;
                  }
                } else {
                  userData = existingData;
                }

                // Update with plan info
                userData.plan = planId;
                userData.stripeCustomerId = customerId;
                userData.stripeSubscriptionId = subscriptionId;
                userData.subscriptionStatus = 'active';
                userData.subscribedAt = new Date().toISOString();

                // Save back in the same format
                await updateDoc(userDocRef, {
                  value: JSON.stringify(userData),
                  updatedAt: new Date(),
                });
                console.log(`Updated user ${userId} to plan ${planId}`);
              } else {
                console.error(`User document not found for ${userId}`);
              }
            } catch (err) {
              console.error('Failed to update user plan:', err);
            }
          }
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
