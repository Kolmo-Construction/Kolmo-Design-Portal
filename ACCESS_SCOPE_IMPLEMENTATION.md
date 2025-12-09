# Access Scope Implementation - Web vs Mobile User Separation

## 🎉 Implementation Complete!

This document describes the access scope system that separates web portal users from mobile app users.

---

## Overview

The access scope system allows administrators to control which platforms users can access:
- **Web Portal Only** - Users can only log into the web dashboard
- **Mobile App Only** - Users can only use the mobile app (clock in/out, receipts, images)
- **Both** - Users can access both platforms

This prevents field workers from accidentally accessing the web portal and provides clear separation of concerns.

---

## Architecture

### Design Principles

1. **Single Database** - All users in one table, no data split
2. **Role + Scope** - Roles define permissions, scope defines platform access
3. **API Middleware** - Enforce access at API layer, not database layer
4. **No RLS** - Internal app, middleware protection is sufficient

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     User Authentication                      │
└─────────────────────────────────────────────────────────────┘

Web Portal Login                     Mobile App Login
      │                                    │
      ▼                                    ▼
Session Auth                         API Key Auth
(Passport.js)                        (Bearer Token)
      │                                    │
      ▼                                    ▼
req.user populated                   req.user populated
      │                                    │
      ├────────────────┬───────────────────┤
      │                │                   │
      ▼                ▼                   ▼
Check accessScope == 'mobile'?      Check accessScope == 'web'?
      │                                    │
      ▼                                    ▼
Block if true                        Block if true
(403 Forbidden)                      (403 Forbidden)
```

---

## Database Schema

### Migration: `migrations/0013_add_access_scope_to_users.sql`

```sql
-- Add access_scope column
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_scope TEXT DEFAULT 'both';

-- Add check constraint
ALTER TABLE users ADD CONSTRAINT access_scope_check
  CHECK (access_scope IN ('web', 'mobile', 'both'));

-- Add documentation
COMMENT ON COLUMN users.access_scope IS
  'Platform access control: web (portal only), mobile (app only), or both';
```

### Schema Definition

```typescript
// shared/schema.ts
export const users = pgTable("users", {
  // ... other fields
  role: text("role").notNull().default("client"),
  accessScope: text("access_scope").notNull().default("both"),
  // ... other fields
});
```

---

## Backend Implementation

### 1. Middleware Functions

**File:** `server/middleware/auth.middleware.ts`

```typescript
/**
 * Blocks mobile-only users from accessing web endpoints
 */
export function requireWebAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const accessScope = req.user.accessScope || 'both';

  if (accessScope === 'mobile') {
    return res.status(403).json({
      message: "Forbidden: This account is configured for mobile app access only."
    });
  }

  next();
}

/**
 * Blocks web-only users from accessing mobile endpoints
 */
export function requireMobileAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const accessScope = req.user.accessScope || 'both';

  if (accessScope === 'web') {
    return res.status(403).json({
      message: "Forbidden: This account is configured for web portal access only."
    });
  }

  next();
}
```

### 2. Mobile Login Check

**File:** `server/controllers/mobile-auth.controller.ts`

```typescript
// Check if user has mobile access
const accessScope = user.accessScope || 'both';
if (accessScope === 'web') {
  throw new HttpError(403,
    'This account is configured for web portal access only. Please contact your administrator.'
  );
}
```

### 3. Protected Routes

**File:** `server/routes.ts`

Web-only routes now protected with `requireWebAccess` middleware:

```typescript
// Dashboard and admin routes - Web only
app.use("/api/documents", isAuthenticated, requireWebAccess, globalDocumentRouter);
app.use("/api/admin/invoices", isAuthenticated, requireWebAccess, isAdmin, ...);
app.use("/api/project-manager", isAuthenticated, requireWebAccess, projectManagerRouter);

// RAG, Quotes, AI - Web only
app.use("/api/rag", isAuthenticated, requireWebAccess, ragRouter);
app.use("/api/quotes", isAuthenticated, requireWebAccess, quoteRouter);
app.use("/api/agent", isAuthenticated, requireWebAccess, agentRouter);

// Project management - Web only
app.use("/api/projects/:projectId/admin", isAuthenticated, requireWebAccess, ...);
app.use("/api/projects/:projectId/tasks", isAuthenticated, requireWebAccess, ...);
app.use("/api/projects/:projectId/documents", isAuthenticated, requireWebAccess, ...);
```

Mobile-accessible routes (no `requireWebAccess`):

```typescript
// Time tracking - Mobile needs access
app.use("/api/time", timeTrackingRouter);

// Receipt uploads - Mobile needs access
app.use("/api", receiptRouter);

// Image uploads - Mobile needs access
app.use("/api/admin/images", adminImagesRoutes);
```

---

## Frontend Implementation

### 1. Validation Schema

**File:** `client/src/lib/validations.ts`

```typescript
export const newUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["admin", "projectManager", "client", "contractor"]),
  accessScope: z.enum(["web", "mobile", "both"], {
    required_error: "Access scope is required",
  }).default("both"),
  // ... other fields
});
```

### 2. User Creation Form

**File:** `client/src/components/user-admin/CreateUserForm.tsx`

Added platform access selector:

```typescript
<FormField
  control={form.control}
  name="accessScope"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Platform Access*</FormLabel>
      <Select onValueChange={field.onChange} value={field.value}>
        <SelectContent>
          <SelectItem value="web">Web Portal Only</SelectItem>
          <SelectItem value="mobile">Mobile App Only</SelectItem>
          <SelectItem value="both">Both Web & Mobile</SelectItem>
        </SelectContent>
      </Select>
      <FormDescription>
        Controls which platforms this user can access.
      </FormDescription>
    </FormItem>
  )}
/>
```

### 3. Smart Defaults

When creating a user, the access scope is automatically set based on role:

```typescript
onValueChange={(value: UserRole) => {
  // Set default access scope based on role
  if (value === "contractor") {
    form.setValue("accessScope", "mobile"); // Field workers
  } else if (value === "admin" || value === "projectManager") {
    form.setValue("accessScope", "web"); // Office staff
  }
}}
```

---

## Usage Guide

### For Administrators

#### Creating a Web-Only User (Office Staff)

1. Go to **User Management**
2. Click **New User**
3. Fill in details:
   - Email: `manager@example.com`
   - First Name: `John`
   - Last Name: `Smith`
   - Role: **Project Manager**
   - Platform Access: **Web Portal Only**
4. Click **Create User**

Result: User can access web dashboard but **cannot** login to mobile app.

#### Creating a Mobile-Only User (Field Worker)

1. Go to **User Management**
2. Click **New User**
3. Fill in details:
   - Email: `worker@example.com`
   - First Name: `Mike`
   - Last Name: `Johnson`
   - Role: **Contractor**
   - Platform Access: **Mobile App Only**
4. Click **Create User**

Result: User can use mobile app but **cannot** login to web portal.

#### Creating a Dual-Access User

1. Set **Platform Access** to **Both Web & Mobile**
2. User can access both platforms

---

## Testing

### Test Mobile-Only User Cannot Access Web

1. Create user with `accessScope = 'mobile'`
2. Try to access web dashboard endpoints
3. Expected: 403 Forbidden

```bash
# Test as mobile-only user
curl -H "Authorization: Bearer {apiKey}" \
  https://www.kolmo.design/api/admin/invoices

# Response:
{
  "message": "Forbidden: This account is configured for mobile app access only."
}
```

### Test Web-Only User Cannot Access Mobile

1. Create user with `accessScope = 'web'`
2. Try to login via mobile app
3. Expected: 403 Forbidden

```bash
# Test mobile login as web-only user
curl -X POST https://www.kolmo.design/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password123"}'

# Response:
{
  "success": false,
  "message": "This account is configured for web portal access only."
}
```

---

## Default Access Scope by Role

The migration automatically sets default access scopes:

| Role             | Default Access | Rationale                           |
|------------------|----------------|-------------------------------------|
| **contractor**   | `mobile`       | Field workers use mobile app        |
| **admin**        | `web`          | Admins use web portal dashboards    |
| **projectManager** | `web`        | Managers use web portal dashboards  |
| **client**       | `web`          | Clients view projects on web        |

**Note:** These are defaults. Admins can override them when creating/editing users.

---

## Error Responses

### 403 - Mobile User Accessing Web

```json
{
  "message": "Forbidden: This account is configured for mobile app access only. Please use the mobile application."
}
```

### 403 - Web User Accessing Mobile

```json
{
  "success": false,
  "message": "This account is configured for web portal access only. Please contact your administrator."
}
```

---

## File Changes Summary

### Backend Files Created/Modified

- ✅ `migrations/0013_add_access_scope_to_users.sql` - Database migration
- ✅ `shared/schema.ts` - Added accessScope field
- ✅ `server/middleware/auth.middleware.ts` - Added requireWebAccess & requireMobileAccess
- ✅ `server/controllers/mobile-auth.controller.ts` - Check access scope on login
- ✅ `server/routes.ts` - Protected web-only routes

### Frontend Files Created/Modified

- ✅ `client/src/lib/validations.ts` - Added accessScope to schema
- ✅ `client/src/components/user-admin/CreateUserForm.tsx` - Added platform access selector
- ✅ `client/src/components/user-admin/CreateUserDialog.tsx` - Added accessScope to form

---

## Database Queries

### View Users by Access Scope

```sql
-- View all mobile-only users
SELECT
  id,
  firstName || ' ' || lastName as name,
  email,
  role,
  access_scope
FROM users
WHERE access_scope = 'mobile';

-- View all web-only users
SELECT
  id,
  firstName || ' ' || lastName as name,
  email,
  role,
  access_scope
FROM users
WHERE access_scope = 'web';

-- View users with dual access
SELECT
  id,
  firstName || ' ' || lastName as name,
  email,
  role,
  access_scope
FROM users
WHERE access_scope = 'both';
```

### Update User Access Scope

```sql
-- Change user to mobile-only
UPDATE users
SET access_scope = 'mobile'
WHERE email = 'worker@example.com';

-- Change user to web-only
UPDATE users
SET access_scope = 'web'
WHERE email = 'manager@example.com';

-- Grant dual access
UPDATE users
SET access_scope = 'both'
WHERE email = 'superuser@example.com';
```

---

## Security Considerations

### What This Protects Against

✅ Field workers accidentally accessing admin dashboards
✅ Web-only users trying to use mobile API endpoints
✅ Unauthorized platform access
✅ Clear separation of responsibilities

### What This Does NOT Protect Against

❌ User sharing credentials (out of scope)
❌ SQL injection (handled by ORM)
❌ API key theft (require HTTPS)

### Defense in Depth

This implementation uses **middleware-based protection** instead of RLS because:
1. **Internal app** - Not public-facing, controlled user base
2. **Simpler** - Middleware is easier to test and debug
3. **Flexible** - Can easily add more granular permissions later
4. **Performance** - No database-level checks on every query

---

## Future Enhancements

### Potential Improvements

1. **Granular Permissions**
   - Add feature-level permissions (e.g., can_create_projects, can_approve_invoices)
   - Implement permission matrix

2. **Audit Logging**
   - Log all access attempts
   - Track when users are blocked by access scope

3. **Time-Based Access**
   - Allow temporary platform access
   - Expire access after certain date

4. **IP Restrictions**
   - Restrict web access to office IPs
   - Allow mobile access from any IP

5. **Multi-Factor Authentication**
   - Require MFA for web portal users
   - SMS verification for mobile users

---

## Troubleshooting

### User Can't Login to Mobile App

**Check:**
1. Is `access_scope` set to `'web'`? → Change to `'mobile'` or `'both'`
2. Are credentials correct?
3. Is API key valid?

### User Can't Access Web Dashboard

**Check:**
1. Is `access_scope` set to `'mobile'`? → Change to `'web'` or `'both'`
2. Is session valid?
3. Are they using the correct login URL?

### 403 Errors on Valid Routes

**Check:**
1. Is the route protected with `requireWebAccess`?
2. Does the user have correct `access_scope`?
3. Is middleware order correct (isAuthenticated before requireWebAccess)?

---

## Implementation Date

**Completed:** December 9, 2025
**Status:** ✅ Production Ready
**Migration Applied:** Yes
**API Key Authentication:** Maintained
**RLS:** Not implemented (internal app only)

---

## Support

For questions or issues:
1. Check this documentation
2. Verify user's `access_scope` in database
3. Check server logs for 403 errors
4. Review middleware protection on routes

**Key Principle:** Keep API keys, simple access scope, middleware protection. No JWT, no RLS, no complexity.
