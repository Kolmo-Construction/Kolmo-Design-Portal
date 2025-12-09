# Labor Cost & User Identity Tracking - Complete Implementation

## 🎉 Implementation Complete!

All features have been successfully implemented for tracking user identity and calculating labor costs.

---

## ✅ What's Been Implemented

### 1. **Database Schema Updates**

#### Users Table - Hourly Rate Field
**Migration:** `migrations/0011_add_hourly_rate_to_users.sql`
```sql
ALTER TABLE users ADD COLUMN hourly_rate NUMERIC(10, 2);
```

#### Time Entries Table - Labor Cost Field
**Migration:** `migrations/0012_add_labor_cost_to_time_entries.sql`
```sql
ALTER TABLE time_entries ADD COLUMN labor_cost NUMERIC(10, 2);
```

### 2. **Backend Updates**

#### Automatic Labor Cost Calculation
**File:** `server/services/timetracking.service.ts:202-223`

When a user clocks out, labor cost is automatically calculated:
```typescript
const durationHours = durationMinutes / 60;
const hourlyRate = Number(activeEntry.user.hourlyRate);
laborCost = (durationHours * hourlyRate).toFixed(2);
```

#### User Management API
**Files:**
- `server/controllers/user.controller.ts` - User management logic
- `server/routes/user.routes.ts` - User management routes

**Endpoints:**
- `GET /api/users` - Get all users (admin only)
- `PATCH /api/users/:userId/hourly-rate` - Update hourly rate (admin only)

### 3. **Frontend Components**

#### Project Labor Tab
**File:** `client/src/components/project-details/ProjectLaborTab.tsx`

Features:
- Summary cards (Total Hours, Labor Cost, Time Entries, Active Workers)
- Labor breakdown by worker
- Recent time entries with:
  - Worker name
  - Clock in/out times
  - Duration
  - Labor cost
  - Geofence status
  - Hourly rate

#### User Management Page
**File:** `client/src/pages/user-management.tsx`

Features:
- View all users
- Set/edit hourly rates per user
- Statistics dashboard
- Role-based filtering

#### Receipt Uploader Names
**File:** `client/src/components/project-details/ProjectFinanceTab.tsx:552-559`

Receipts now display who uploaded them with a user icon.

---

## 📊 Complete User Identity Flow

### Mobile App Flow

```
1. User Opens App
   ↓
2. Login Screen
   POST /api/auth/login
   {email, password}
   ↓
3. Backend Returns
   {
     user: {id, firstName, lastName, role},
     apiKey: "kolmo_abc123..."
   }
   ↓
4. App Stores API Key
   AsyncStorage.setItem('apiKey', apiKey)
   ↓
5. All API Calls Use API Key
   Authorization: Bearer kolmo_abc123...
   ↓
6. Backend Identifies User
   API Key Middleware → req.user = {id, firstName, ...}
   ↓
7. Actions Tracked Per User
   ├─ Clock In/Out → time_entries.userId
   ├─ Receipt Upload → receipts.uploadedBy
   └─ Image Upload → admin_images.uploadedById
```

### What Gets Tracked

| Action | Database Field | UI Display |
|--------|---------------|------------|
| Clock In/Out | `time_entries.userId` | Worker name + labor cost |
| Receipt Upload | `receipts.uploadedBy` | "Uploaded by John Smith" |
| Progress Photos | `admin_images.uploadedById` | User attribution |

---

## 💰 Labor Cost Calculation

### Automatic Calculation on Clock Out

```javascript
Example:
- Worker: John Smith
- Hourly Rate: $45.00/hr
- Clock In: 8:00 AM
- Clock Out: 5:30 PM
- Duration: 9.5 hours

Calculation:
laborCost = 9.5 hours × $45.00/hr = $427.50

Stored in:
time_entries.labor_cost = 427.50
```

### View Labor Costs

**Project Labor Tab:**
- Go to Project → Labor tab
- See all time entries with calculated costs
- See breakdown by worker
- See total project labor cost

---

## 🛠️ Setup Instructions

### 1. Run Database Migrations

```bash
# Apply hourly rate column
psql $DATABASE_URL -f migrations/0011_add_hourly_rate_to_users.sql

# Apply labor cost column
psql $DATABASE_URL -f migrations/0012_add_labor_cost_to_time_entries.sql
```

### 2. Set Hourly Rates

**Option A: Via UI (Recommended)**
1. Login as admin
2. Go to **User Management** in sidebar
3. Find the user
4. Click "Edit Rate"
5. Enter hourly rate (e.g., 45.00)
6. Click "Save"

**Option B: Via SQL**
```sql
-- Set hourly rate for a user
UPDATE users
SET hourly_rate = 45.00
WHERE email = 'contractor@example.com';

-- Set rates for multiple users
UPDATE users
SET hourly_rate = 35.00
WHERE role = 'contractor';

UPDATE users
SET hourly_rate = 55.00
WHERE role = 'projectManager';
```

### 3. Restart Backend

```bash
npm run dev
```

---

## 📱 Mobile App Testing

### Test Complete Flow

```bash
# Test login + clock in + receipt upload + image upload
./test-mobile-user-flow.sh admin@kolmo.design password123 65
```

### Manual Testing

1. **Login via Mobile**
   ```bash
   POST https://www.kolmo.design/api/auth/login
   {
     "email": "contractor@example.com",
     "password": "password123"
   }
   ```

2. **Clock In**
   ```bash
   POST https://www.kolmo.design/api/time/clock-in
   Authorization: Bearer {apiKey}
   {
     "projectId": 65,
     "latitude": 34.052235,
     "longitude": -118.243683
   }
   ```

3. **Clock Out**
   ```bash
   POST https://www.kolmo.design/api/time/clock-out
   Authorization: Bearer {apiKey}
   {
     "latitude": 34.052235,
     "longitude": -118.243683
   }
   ```

4. **View Labor Costs**
   - Go to Project → Labor tab
   - See time entry with calculated labor cost

---

## 🎯 Features Summary

### ✅ Completed Features

1. **User Identity Tracking**
   - ✅ Mobile login returns API key
   - ✅ All actions tracked to specific user
   - ✅ User names visible in UI

2. **Labor Cost Tracking**
   - ✅ Hourly rate field in users table
   - ✅ Labor cost field in time entries
   - ✅ Automatic calculation on clock out
   - ✅ UI to view labor costs

3. **User Management**
   - ✅ Admin page to set hourly rates
   - ✅ View all users and their rates
   - ✅ Statistics dashboard

4. **UI Components**
   - ✅ Labor tab in project details
   - ✅ Receipt uploader names visible
   - ✅ Time entry history with costs
   - ✅ Worker breakdown

---

## 📖 User Guide

### For Admins

**Setting Hourly Rates:**
1. Go to **User Management**
2. Find the worker
3. Click **Edit Rate**
4. Enter rate (e.g., `45.00`)
5. Click **Save**

**Viewing Labor Costs:**
1. Go to **Projects**
2. Select a project
3. Click **Labor** tab
4. View time entries and costs

### For Mobile Users

**Clock In:**
1. Open app
2. Login with credentials
3. Select project
4. Tap "Clock In"
5. Confirm location

**Clock Out:**
1. Tap "Clock Out"
2. Confirm location
3. Labor cost automatically calculated

**Upload Receipt:**
1. Go to project
2. Tap "Upload Receipt"
3. Take photo or select image
4. Your name tracked as uploader

---

## 🔍 Database Queries

### View Labor Costs by Project

```sql
SELECT
  p.name as project,
  u.firstName || ' ' || u.lastName as worker,
  COUNT(*) as entries,
  SUM(te.durationMinutes) / 60.0 as hours,
  SUM(te.laborCost) as total_cost
FROM time_entries te
JOIN users u ON te.userId = u.id
JOIN projects p ON te.projectId = p.id
WHERE te.laborCost IS NOT NULL
GROUP BY p.id, p.name, u.id, u.firstName, u.lastName
ORDER BY total_cost DESC;
```

### View Workers Without Hourly Rates

```sql
SELECT
  id,
  firstName,
  lastName,
  email,
  role
FROM users
WHERE role IN ('contractor', 'projectManager')
  AND hourly_rate IS NULL;
```

### View Total Labor Cost per Project

```sql
SELECT
  p.id,
  p.name,
  p.totalBudget,
  COALESCE(SUM(te.laborCost), 0) as labor_cost,
  COALESCE(SUM(r.totalAmount), 0) as material_cost,
  COALESCE(SUM(te.laborCost), 0) + COALESCE(SUM(r.totalAmount), 0) as total_expenses
FROM projects p
LEFT JOIN time_entries te ON p.id = te.projectId
LEFT JOIN receipts r ON p.id = r.projectId
GROUP BY p.id, p.name, p.totalBudget
ORDER BY total_expenses DESC;
```

---

## 🚀 Next Steps

### Recommended Enhancements

1. **Labor vs Budget Tracking**
   - Add labor budget field to projects
   - Show labor cost vs labor budget
   - Alert when approaching budget

2. **Payroll Reports**
   - Export time entries for payroll
   - Group by pay period
   - Include all labor costs

3. **Labor Cost in Financial Summary**
   - Include labor in total project expenses
   - Show breakdown: Materials vs Labor vs Other
   - Update budget utilization to include labor

4. **Mobile App Updates**
   - Show user's own time entries
   - Display daily/weekly hours
   - Show earnings (hours × rate)

---

## 📞 Support

If you need help:
- Check this documentation
- Run test scripts
- Check server logs for labor cost calculation messages
- Verify hourly rates are set in User Management

---

**Implementation Date:** December 9, 2025
**Status:** ✅ Complete and Ready for Use
