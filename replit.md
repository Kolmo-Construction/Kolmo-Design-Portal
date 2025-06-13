# Kolmo Construction Client Portal

## Overview

This is a full-stack construction client portal built for Kolmo Construction, designed to manage projects, quotes, invoices, and client communications. The application provides a professional interface for both admin users (project managers) and clients to track project progress, handle payments, and manage communications.

## System Architecture

### Frontend Architecture
- **Technology**: React 18 with TypeScript
- **UI Framework**: Radix UI components with Tailwind CSS
- **State Management**: TanStack React Query for server state
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite with custom configuration
- **Styling**: Tailwind CSS v4 with custom design system

### Backend Architecture
- **Runtime**: Node.js 20 with Express.js
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy and magic link authentication
- **Session Management**: Express sessions with PostgreSQL store
- **API Design**: RESTful endpoints with proper error handling

### Database Architecture
- **Primary Database**: PostgreSQL 16 (Neon serverless)
- **ORM**: Drizzle ORM with type-safe schema definitions
- **Migration Strategy**: Drizzle Kit for schema management
- **Connection**: Connection pooling with @neondatabase/serverless

## Key Components

### Authentication System
- Local username/password authentication
- Magic link email authentication for clients
- Role-based access control (admin, client, projectManager)
- Secure password hashing with scrypt
- Session persistence with PostgreSQL store

### Payment Processing
- **Payment Provider**: Stripe integration
- **Architecture**: Payment intents with webhook confirmation
- **Workflow**: Quote acceptance → Project creation → Down payment invoice → Stripe checkout
- **Security**: Webhook signature verification, PCI compliance
- **Email Notifications**: Automated payment confirmations via SendGrid

### Project Management
- Comprehensive project lifecycle tracking
- Client-project association with automatic portal creation
- Status management (draft, finalized, archived)
- File upload and media management
- Punch list and update tracking

### Communication System
- **Chat Platform**: Stream Chat integration
- **Architecture**: Project-based channels with admin/client participants
- **Real-time**: WebSocket connections for live messaging
- **User Management**: Automatic Stream user creation and token generation

### Quote System
- Professional quote generation with line items
- PDF generation and email delivery
- Quote acceptance workflow with payment collection
- Automatic project and invoice creation upon acceptance

## Data Flow

### Quote to Project Workflow
1. Admin creates quote with line items and customer details
2. Quote email sent to customer via SendGrid
3. Customer accepts quote via secure link
4. System creates project and down payment invoice
5. Customer redirected to Stripe checkout
6. Webhook confirms payment and activates project
7. Welcome email sent to customer with portal access

### Client Portal Access
1. Magic link email sent to client upon project creation
2. Client clicks link to activate account
3. Client portal displays assigned projects
4. Real-time chat available for each project
5. Project updates and media shared through portal

### Payment Processing
1. Stripe payment intent created with metadata
2. Client completes payment via Stripe Elements
3. Webhook receives payment_intent.succeeded event
4. Invoice status updated to 'paid'
5. Project status updated to 'active'
6. Confirmation email sent to customer

## External Dependencies

### Email Service
- **Provider**: SendGrid
- **Configuration**: projects@kolmo.io sender address
- **Templates**: HTML templates for quotes, confirmations, and welcome emails

### Payment Processing
- **Provider**: Stripe
- **Features**: Payment intents, webhooks, customer management
- **Security**: Webhook signature verification, PCI compliance

### Real-time Communication
- **Provider**: Stream Chat
- **Features**: Channels, user management, real-time messaging
- **Integration**: Server-side user creation and token generation

### File Storage
- **Provider**: AWS S3 (optional, configured via environment variables)
- **Features**: Presigned URLs, secure file uploads
- **Fallback**: Local storage in development

## Deployment Strategy

### Environment Configuration
- **Production Domain**: kolmo.design
- **Database**: Neon PostgreSQL serverless
- **Deployment**: Replit autoscale deployment
- **SSL/TLS**: Automatic certificate provisioning

### Required Environment Variables
```
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_live_...
VITE_STRIPE_PUBLIC_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=SG...
STREAM_API_KEY=...
STREAM_API_SECRET=...
BASE_URL=https://kolmo.design
```

### Stripe Configuration
- Webhook endpoint: `https://kolmo.design/api/webhooks/stripe`
- Required events: payment_intent.succeeded, payment_intent.payment_failed
- Domain authorization for kolmo.design

### Database Migrations
- Schema versioning with Drizzle migrations
- Automatic migration application on deployment
- Rollback capability for schema changes

## Changelog
- June 13, 2025. Initial setup

## User Preferences
Preferred communication style: Simple, everyday language.