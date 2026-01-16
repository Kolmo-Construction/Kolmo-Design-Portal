# AI Agent Sales Lead System - Testing Guide

## ✅ Status: FULLY OPERATIONAL

Server running on: **http://localhost:3000**

### Initialization Status
```
✅ AgentService initialized with DeepSeek
✅ TavilySearch initialized successfully
✅ LangGraph workflow compiled
```

### API Keys Configured
- ✅ DEEPSEEK_API_KEY - AI agent reasoning
- ✅ TAVILY_API_KEY - Lead search on Reddit/Nextdoor/Houzz
- ✅ VOYAGE_API_KEY - Semantic memory

---

## How to Test (Browser Console Method)

### 1. Open Application
- Navigate to: http://localhost:3000
- Log in with your credentials

### 2. Open Developer Tools
- Press F12 (or Cmd+Option+I on Mac)
- Go to Console tab

### 3. Test Lead Queries

#### Test 1: Query Existing Leads
```javascript
fetch('/api/agent/consult', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userPrompt: 'Show me all leads in the database. What leads do we have?'
  })
}).then(r => r.json()).then(data => {
  console.log('Response:', data.answer);
  if (data.actions) console.log('Actions:', data.actions);
})
```

#### Test 2: Search for New Leads on Reddit
```javascript
fetch('/api/agent/consult', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userPrompt: 'Search for kitchen remodeling leads in Seattle on Reddit'
  })
}).then(r => r.json()).then(data => {
  console.log('Response:', data.answer);
  if (data.actions) console.log('Actions:', data.actions);
})
```

#### Test 3: Save a New Lead
```javascript
fetch('/api/agent/consult', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userPrompt: 'Save a new lead: Sarah Miller, email: sarah.m@example.com, interested in bathroom remodel in Bellevue, found on Nextdoor'
  })
}).then(r => r.json()).then(data => {
  console.log('Response:', data.answer);
  if (data.actions) console.log('Proposed Actions:', data.actions);
})
```

#### Test 4: Confirm Lead Save (if action was proposed)
```javascript
// After the agent proposes to save the lead, confirm with:
fetch('/api/agent/consult', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userPrompt: 'Yes, proceed with saving that lead'
  })
}).then(r => r.json()).then(console.log)
```

#### Test 5: Search Houzz for Deck Leads
```javascript
fetch('/api/agent/consult', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userPrompt: 'Find leads for deck building projects on Houzz in the Pacific Northwest'
  })
}).then(r => r.json()).then(data => {
  console.log('Search Results:', data.answer);
})
```

---

## Agent Architecture

### Router System
The agent uses LLM-based intent classification to route queries:

**Leads Keywords** → Routes to Leads Agent:
- "lead", "leads", "find customer", "search"
- "reddit", "nextdoor", "houzz", "social media"
- "prospect", "new customer", "sales", "marketing"

**Project Keywords** → Routes to Project Agent:
- "project", "task", "invoice", "milestone"
- "construction", "schedule", "payment"

### Lead Agent Tools

1. **search_leads** (Tavily API)
   - Searches Reddit, Nextdoor, Houzz, and other sites
   - Filters by location and keywords
   - Scores results by relevance
   - Automatically saves top 5 leads to database

2. **save_lead**
   - Manually saves lead with contact info
   - Supports source tracking (manual, web_search, referral, etc.)
   - Records location, interest tags, confidence score

3. **get_leads**
   - Retrieves recent leads from database
   - Filters by status (new, contacted, qualified, converted, archived)
   - Supports pagination

4. **read_database**
   - SQL SELECT query tool
   - Access to full leads table
   - Safety: read-only queries only

---

## Direct API Endpoints

### Lead Management (REST API)
```javascript
// GET all leads
fetch('/api/leads').then(r => r.json()).then(console.log)

// GET leads by status
fetch('/api/leads?status=new').then(r => r.json()).then(console.log)

// GET single lead
fetch('/api/leads/1').then(r => r.json()).then(console.log)

// CREATE lead manually
fetch('/api/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    contactInfo: 'john@example.com',
    source: 'referral',
    location: 'Seattle',
    contentSnippet: 'Looking for kitchen remodel',
    interestTags: ['kitchen', 'remodel']
  })
}).then(r => r.json()).then(console.log)

// UPDATE lead
fetch('/api/leads/1', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'contacted' })
}).then(r => r.json()).then(console.log)

// MARK as contacted
fetch('/api/leads/1/contacted', {
  method: 'POST'
}).then(r => r.json()).then(console.log)
```

---

## Database Schema

### Leads Table
```sql
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_info TEXT NOT NULL,
  source VARCHAR(50),
  source_url TEXT,
  content_snippet TEXT,
  interest_tags TEXT[],
  status VARCHAR(20) DEFAULT 'new',
  draft_response TEXT,
  confidence_score INTEGER,
  location VARCHAR(255),
  detected_at TIMESTAMP DEFAULT NOW(),
  contacted_at TIMESTAMP,
  converted_to_quote_id INTEGER,
  notes TEXT
);
```

### Status Values
- `new` - Newly discovered lead
- `contacted` - Initial contact made
- `qualified` - Qualified as potential customer
- `converted` - Converted to quote/project
- `archived` - Not pursued

---

## Expected Behavior

### Scenario 1: Search for Leads
**User:** "Find me leads for kitchen remodeling in Seattle"

**Agent Response:**
1. Classifies as "leads" intent → Routes to Leads Agent
2. Uses `search_leads` tool with Tavily API
3. Searches Reddit, Nextdoor, Houzz with keywords
4. Returns results with URLs and snippets
5. Auto-saves top 5 leads to database
6. Provides summary with lead IDs

### Scenario 2: Save Lead Manually
**User:** "Save this lead: Jane from Capitol Hill wants deck built"

**Agent Response:**
1. Uses `propose_action` tool first
2. Shows what will be saved (name, location, tags)
3. Waits for user confirmation
4. On "yes" → Uses `save_lead` tool
5. Returns lead ID and success message

### Scenario 3: Review Leads
**User:** "Show me recent leads"

**Agent Response:**
1. Uses `get_leads` tool (or `read_database`)
2. Retrieves from database
3. Formats nicely with source, status, location
4. Highlights high-confidence leads

---

## Troubleshooting

### Agent Not Responding
Check: `/api/agent/health`
Should return: `{ status: "healthy" }`

### Search Not Working
- Verify TAVILY_API_KEY in .env.local
- Check server logs for Tavily errors
- Test direct Tavily endpoint

### Database Errors
- Verify PostgreSQL is running
- Check DATABASE_URL in .env.local
- Run migrations: `npm run db:push`

---

## Implementation Files

- `server/services/agent.service.ts` - Main agent logic (1405 lines)
- `server/routes/agent.routes.ts` - API endpoints (186 lines)
- `server/routes/lead.routes.ts` - Lead REST API (106 lines)
- `server/storage/repositories/lead.repository.ts` - Database operations (84 lines)
- `server/services/tavily-search.service.ts` - Web search integration (139 lines)
- `migrations/0014_add_leads_table.sql` - Database schema

---

## Success! 🎉

The AI Agent Sales Lead system is fully implemented and operational. You can now:
- ✅ Search for leads on Reddit, Nextdoor, Houzz
- ✅ Save leads with AI assistance
- ✅ Query and manage leads with natural language
- ✅ Track lead status through the pipeline
- ✅ Use semantic memory for context-aware responses

Start testing using the browser console commands above!
