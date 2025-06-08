# Production Deployment Guide for kolmo.design

## Stripe Configuration for Production

### 1. Domain Authorization
Add these domains to your Stripe Dashboard → Settings → Authorized domains:
- `kolmo.design`
- `www.kolmo.design`

### 2. Webhook Endpoints
Configure these webhook endpoints in Stripe Dashboard → Developers → Webhooks:
- Endpoint URL: `https://kolmo.design/api/webhooks/stripe`
- Events to send:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `customer.created`
  - `invoice.payment_succeeded`

### 3. Environment Variables
Ensure these are set in production:
```
STRIPE_SECRET_KEY=sk_live_... (live key, not test key)
VITE_STRIPE_PUBLIC_KEY=pk_live_... (live key, not test key)
```

## Payment Flow Architecture

### Client-Side (kolmo.design)
1. User fills out payment form
2. Stripe Elements securely collects payment details
3. Payment confirmed with return URL: `https://kolmo.design/payment-success`

### Server-Side Processing
1. Creates payment intent with project metadata
2. Processes successful payments via webhook
3. Updates project status and sends confirmation emails
4. Handles failed payments with appropriate error messages

## Security Features
- Payment data never touches your servers (PCI compliance)
- Automatic HTTPS enforcement for payment pages
- Secure webhook signature verification
- Customer data encrypted in transit and at rest

## Testing in Production
Use Stripe's live mode with small test amounts ($0.50) to verify:
- Payment form loads correctly on kolmo.design
- Webhook endpoints receive events
- Email confirmations are sent
- Project status updates properly

## Support Integration
Payment-related support requests can be handled through:
- Stripe Dashboard for payment disputes
- Your admin panel for project status issues
- Email notifications for failed payments requiring follow-up