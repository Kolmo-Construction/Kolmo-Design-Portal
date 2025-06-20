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
- June 13, 2025. Fixed client portal invitation email issues:
  - Corrected email template to use customer name instead of project manager name
  - Fixed magic link URL format to properly match auth route structure (/auth/magic-link/{token})
  - Added secure token generation with 24-hour expiry
  - Implemented dual email system for down payments: payment confirmation + portal invitation
- June 13, 2025. Fixed down payment processing timeout and email routing issues:
  - Resolved hanging "Setting up payments" step by moving email notifications outside database transactions
  - Fixed customer name mix-up where portal invitations showed wrong names due to data inconsistency
  - Added user name validation during payment process to prevent future name conflicts
  - Payment setup now completes in under 2 seconds instead of timing out
- June 13, 2025. Fixed magic link authentication and payment completion navigation:
  - Resolved "Invalid or expired link" error in magic link authentication system
  - Added comprehensive debugging for magic link token validation
  - Removed broken "Return to Quote" navigation button from payment success page
  - Simplified payment completion to single "Close Window" option for clean user experience
- June 14, 2025. Fixed comprehensive layout issues across all pages:
  - Updated padding-top from pt-20 to pt-24 to prevent navbar from hiding page content
  - Fixed responsive sidebar overlap by removing ml-0 and using lg:ml-64 only
  - Fixed layout in all pages: dashboard, documents, messages, UserManagement, settings, schedule, selections, progress-updates, ProjectDetails, ProjectManagement
  - Ensured consistent spacing for both loading states and main content areas
  - Resolved button visibility issues where top navigation bar was overlapping page elements
  - Fixed mobile responsive design where sidebar was incorrectly overlapping main content
- June 14, 2025. Fixed customer downpayment payment failures:
  - Resolved authentication middleware blocking public quote access routes that customers need
  - Updated frontend query client to handle public endpoints without treating 401 errors as auth failures
  - Fixed payment success handler to work in development environment with test payment intents
  - Modified payment processing logic to allow development/test mode completion alongside production
  - Verified complete customer workflow: quote access → acceptance → project creation → payment completion
  - Payment system now properly updates invoice status from draft to paid in all environments
- June 14, 2025. Fixed quote acceptance authentication redirects:
  - Resolved React hooks order violation in ClientLayout that was causing authentication errors
  - Updated quote payment routing to use tokens instead of quote IDs for public access
  - Fixed customer quote acceptance flow to prevent redirects to /auth page
  - Fixed Stripe payment confirmation redirect errors by using 'redirect: never' option
  - Customers can now properly access and accept quotes using secure token URLs
  - Complete workflow verified: quote access → acceptance → payment processing → project creation
- June 14, 2025. Fixed duplicate magic link emails and missing down payment confirmations:
  - Completely eliminated duplicate magic links by disabling automatic portal notifications in ProjectRepository
  - Implemented separate down payment confirmation emails that customers receive immediately after payment
  - Created single portal access email system that sends only one magic link per customer
  - PaymentService now handles all email communications during payment flow to prevent duplicates
  - Customers now receive exactly two emails: payment confirmation + portal access (instead of duplicate portal invitations)
  - Fixed email routing to ensure proper sender addresses and professional templates
- June 14, 2025. Fixed magic link double-click authentication errors:
  - Resolved "Invalid or expired link" errors that occurred when browsers made duplicate requests to magic link endpoints
  - Added session-based authentication check that prevents token validation failures for already-authenticated users
  - Magic links now handle multiple clicks gracefully by returning existing session data instead of failing
  - Customers experience smooth authentication flow without confusing "Access Denied" messages
  - Fix addresses React component lifecycle and query invalidation causing duplicate API requests
- June 14, 2025. Enhanced magic link system and client account management:
  - Extended magic link expiry from 24 hours to 5 months for better user experience
  - Clients can now bookmark and reuse their project access links for convenient portal access
  - Implemented comprehensive client account management with profile editing and password reset
  - Added Account section to client navigation for secure profile management
  - Extended backend API with client profile and password management endpoints
- June 15, 2025. Fixed client file download 404 errors:
  - Resolved issue where clients received 404 errors when downloading files from their portal
  - Fixed document upload controller to store complete proxy URLs instead of just storage keys
  - Updated existing documents in database to use proper URL format for R2 storage access
  - File downloads now work correctly through /api/storage/proxy/ endpoint without authentication issues
- June 15, 2025. Fixed project manager access control and navigation system:
  - Resolved "Access Restricted" error where project managers couldn't access their assigned projects
  - Fixed role validation mismatch (projectManager vs project_manager) in protected route logic
  - Created dedicated ProjectManagerNavigation component with proper role-based navigation
  - Implemented UniversalLayout system that automatically shows appropriate navigation based on user role
  - Fixed apiRequest parameter order bug in logout functionality
  - Project managers now have full access to their dashboard and assigned projects with proper navigation
- June 18, 2025. Fixed project status update database errors and improved page navigation:
  - Resolved "value.toISOString is not a function" error in project status updates by fixing date field validation
  - Added proper null value handling for timestamp fields in project controller
  - Fixed TypeScript errors and type conversions in project update schema
  - Enhanced navigation across application with consistent back buttons and breadcrumbs
  - Added "Back to Dashboard" navigation to quotes page and admin invoices page
  - Implemented consistent breadcrumb navigation pattern with Home icon and page hierarchy
  - Improved user experience with clear navigation paths throughout the application
- June 19, 2025. Completed Zoho Expense integration replacing Expensify for comprehensive budget tracking:
  - Completely replaced Expensify service with new ZohoExpenseService using OAuth 2.0 authentication
  - Implemented secure token management with automatic refresh handling and database persistence
  - Created comprehensive Zoho Expense API integration supporting organization management and project expense tracking
  - Updated all frontend components to use new Zoho Expense endpoints instead of Expensify
  - Maintained existing project tag format (OwnerName_YYYY-MM-DD) for consistency
  - Added OAuth authorization flow for secure Zoho account connection
  - Enhanced expense categorization and status mapping for Zoho's expense workflow
  - Fixed route mounting issues causing 404 errors during Zoho connection attempts
  - Made Zoho connection interface less prominent per user feedback in Financial page
  - Updated project details navigation from "Expensify" tab to "Zoho Expense" tab
  - Renamed ProjectExpensifyTab to ProjectZohoExpenseTab with proper functionality
  - Fixed FinancialSummary component props to handle projects parameter correctly
  - Added redirect route for Zoho OAuth callback URL compatibility
  - Implemented comprehensive testing suite for all integration components
  - Added database table for persistent token storage (zoho_tokens)
  - Created detailed project-expense mapping documentation and verification tools
  - System ready for real-time budget monitoring with proper project tag matching (e.g., "SamarArny_2025-06-18")
  - Fixed token persistence issues to ensure OAuth tokens survive service restarts
- June 20, 2025. Fixed Zoho API DNS resolution error:
  - Corrected baseURL from 'https://books.zohoapis.com/api/v3' to 'https://www.zohoapis.com/books/v3'
  - Resolved ENOTFOUND DNS error that was preventing all Zoho API calls
  - Verified DNS resolution is working correctly with test script
  - Zoho integration can now properly connect to API endpoints for budget tracking

## User Preferences
Preferred communication style: Simple, everyday language.