# Zoho Project Expense Matching Guide

## Your Project Tag: "SamarArny_2025-06-18"

### Project Details
- **Project ID**: 63
- **Project Name**: Residential Painting & Minor Repairs Project
- **Customer**: Samar Arny
- **Created**: June 18, 2025
- **Zoho Tag**: `SamarArny_2025-06-18`

## How Expense Matching Works

### 1. Team Member Process (Adding Expenses in Zoho)
When your team adds expenses in Zoho Expense:
1. Log into Zoho Expense
2. Click "Add Expense" or upload receipt
3. Fill in expense details (amount, category, merchant, etc.)
4. **In the "Project" dropdown, select**: `SamarArny_2025-06-18`
5. Save the expense

### 2. System Matching Logic
The system automatically matches expenses to your project:
```
expense.project_name === "SamarArny_2025-06-18"
↓
Links to Project ID: 63
↓
Appears in budget tracking for "Residential Painting & Minor Repairs Project"
```

### 3. Budget Tracking
Once expenses are properly tagged:
- Total project expenses = Sum of all expenses with tag "SamarArny_2025-06-18"
- Budget utilization = (Total expenses / Project budget) × 100%
- Real-time tracking appears in your Financial dashboard

## API Endpoints for Testing

### Check Expenses for This Project
```
GET /api/zoho-expense/expenses/63
```

### View All Budget Tracking
```
GET /api/zoho-expense/budget-tracking
```

### Check Zoho Connection Status
```
GET /api/zoho-expense/config
```

## For Your Team Members

### Instructions for Zoho Expense Users
1. **Always select the correct project**: `SamarArny_2025-06-18`
2. **Common expense categories**:
   - Materials (paint, supplies, tools)
   - Labor costs
   - Equipment rental
   - Transportation/mileage
   - Permits and fees

### What NOT to Do
- Don't create new project names
- Don't leave project field blank
- Don't use similar-sounding project names

## Verification Steps

### Check if Expenses Are Properly Tagged
1. Go to Financial page in admin dashboard
2. Look for "Zoho Expense" section
3. Verify expenses appear under correct project
4. Check budget utilization percentage

### If Expenses Don't Appear
1. Verify team used exact tag: `SamarArny_2025-06-18`
2. Check Zoho connection status
3. Ensure expenses are approved in Zoho
4. Contact team to re-tag incorrect expenses

## Technical Details

### Tag Generation Rule
```
Customer Name: "Samar Arny"
Creation Date: "2025-06-18"
↓
Clean name: "SamarArny" (remove spaces/special chars)
↓
Final tag: "SamarArny_2025-06-18"
```

### Database Mapping
- Internal Project ID: 63
- Zoho Project Tag: "SamarArny_2025-06-18"
- Customer: Samar Arny
- All expenses with this tag automatically link to Project 63