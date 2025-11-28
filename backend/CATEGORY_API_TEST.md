# Backend API Testing Guide

## Changes Made

✅ **Backend endpoints updated** to include category information:

1. **GET `/api/categories`** - Returns all categories
2. **GET `/api/tasks?team_id={id}`** - Now includes:
   - `category_id`
   - `category_name`
   - `category_description`
3. **GET `/api/time-logs/recent`** - Time logs now include category info in `task_templates` object
4. **GET `/api/time-logs/filter`** - Same category info included

Tasks are now ordered by: **category name, then task name** (so core tasks appear first)

---

## How to Test

### Step 1: Restart Backend Server

```powershell
cd backend
node index.js
```

Wait for: `✅ Connected to Postgres at: ...`

### Step 2: Test Categories Endpoint

Open your browser dev tools console or use the Electron app console:

```javascript
// In browser/app console
fetch('http://localhost:4000/api/categories', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
})
.then(r => r.json())
.then(d => console.log('Categories:', d));
```

**Expected Response:**
```json
[
  { "id": 1, "name": "core", "description": "Primary productive work tasks" },
  { "id": 2, "name": "non-core", "description": "Secondary or support tasks" },
  { "id": 3, "name": "unproductive", "description": "Non-productive time" }
]
```

### Step 3: Test Tasks Endpoint

```javascript
// Replace 1 with your team_id
fetch('http://localhost:4000/api/tasks?team_id=1', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
})
.then(r => r.json())
.then(d => console.log('Tasks:', d));
```

**Expected Response** (sample):
```json
[
  {
    "id": 1,
    "team_id": 1,
    "name": "Loan - Position Reconciliation",
    "category_id": 1,
    "category_name": "core",
    "category_description": "Primary productive work tasks"
  },
  ...
]
```

### Step 4: Test Time Logs

```javascript
fetch('http://localhost:4000/api/time-logs/recent?days=3', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN_HERE'
  }
})
.then(r => r.json())
.then(d => console.log('Recent logs:', d));
```

**Expected**: Each log should have `task_templates` object with category fields.

---

## Quick Validation (Easier Method)

**Just start the Electron app!** If the backend is running:
1. Login
2. Select your team
3. Open browser DevTools in Electron (Ctrl+Shift+I)
4. Go to Network tab
5. Look at the `/api/tasks` request
6. Check the Response to see if it includes `category_id`, `category_name`, etc.

---

## Next Steps

Once you confirm the backend is returning category data:
✅ I'll implement the frontend UI (badges, colors, dashboard analytics)
