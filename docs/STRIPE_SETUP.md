# Stripe Setup Guide

This guide explains how to activate the subscription system when you're ready.

## Prerequisites

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Complete business verification for EU compliance

## Step 1: Create Products in Stripe Dashboard

Go to Stripe Dashboard → Products → Add Product

### Pro Plan ($9/month)
- Name: QuizForge Pro
- Price: $9.00 / month
- Copy the **Price ID** (starts with `price_`)

### Institution Plan ($199/month)
- Name: QuizForge Institution
- Price: $199.00 / month
- Copy the **Price ID**

## Step 2: Get API Keys

Go to Stripe Dashboard → Developers → API Keys

- Copy **Secret key** (starts with `sk_`)
- Copy **Publishable key** (starts with `pk_`)

## Step 3: Set Up Webhook

Go to Stripe Dashboard → Developers → Webhooks → Add endpoint

- Endpoint URL: `https://www.quizforgeapp.com/api/stripe/webhook`
- Events to listen for:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

Copy the **Webhook signing secret** (starts with `whsec_`)

## Step 4: Add Environment Variables to Vercel

Go to Vercel → Your Project → Settings → Environment Variables

Add these:

| Variable | Value |
|----------|-------|
| `STRIPE_SECRET_KEY` | sk_live_... |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | pk_live_... |
| `STRIPE_WEBHOOK_SECRET` | whsec_... |
| `STRIPE_PRO_PRICE_ID` | price_... |
| `STRIPE_INSTITUTION_PRICE_ID` | price_... |

## Step 5: Redeploy

After adding env vars, redeploy your app.

## Testing

Before going live, test with Stripe test mode:
1. Use test API keys (start with `sk_test_` and `pk_test_`)
2. Use test card: 4242 4242 4242 4242

## Customer Portal Setup

Go to Stripe Dashboard → Settings → Billing → Customer Portal

Enable:
- Update payment methods
- Update subscriptions
- Cancel subscriptions
- View invoices

## Tax Configuration (EU VAT)

Go to Stripe Dashboard → Settings → Tax

1. Enable Stripe Tax
2. Configure your origin address
3. Enable EU VAT collection

## Going Live Checklist

- [ ] Products created in Stripe
- [ ] Webhook configured and tested
- [ ] Environment variables set in Vercel
- [ ] Tax/VAT settings configured
- [ ] Customer portal configured
- [ ] Test a full subscription flow in test mode
- [ ] Switch to live API keys
