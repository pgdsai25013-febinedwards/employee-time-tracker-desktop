# Backend Updates for Idle Tracking System

## Changes Made

### 1. Timer Start Endpoint (`POST /api/time-logs/start`)

**Added:**
- Accept `instance_id` from request body
- UUID format validation for `instance_id`
- Instance-level duplicate timer check (prevents same device from running multiple timers)
- Store `instance_id` in database

**Validation Logic:**
```javascript
// Check 1: User can't have multiple active timers
if (user already has active timer) return 400

// Check 2: Instance can't have multiple active timers  
if (instance_id provided && instance already has active timer) return 409

// Check 3: Validate UUID format
if (instance_id format invalid) return 400
```

---

### 2. Timer Stop Endpoint (`POST /api/time-logs/stop`)

**Enhanced Idle Validation:**
- ✅ Reject negative idle time (log warning)
- ✅ Cap idle time to duration if it exceeds (log warning)
- ✅ Cap idle time to 48 hours max (log warning for suspicious values)
- ✅ All validations log to console for monitoring

**Example Warnings:**
```
⚠️ Negative idle time rejected: -30s for log 123
⚠️ Idle time exceeds duration: 500s > 300s for log 456
⚠️ Suspicious idle time: 180000s (50h) for log 789
```

---

### 3. Database Schema

**Already migrated:**
```sql
ALTER TABLE time_logs ADD COLUMN instance_id TEXT;
CREATE INDEX idx_time_logs_instance_id ON time_logs(instance_id);
```

---

## API Request/Response Changes

### Start Timer

**Request:**
```json
{
  "task_template_id": 42,
  "work_location": "office",
  "instance_id": "abc123-def456-ghi789-jkl012"  // NEW
}
```

**Response (unchanged):**
```json
{
  "message": "Timer started",
  "log": { ...log data including instance_id... }
}
```

**New Error Cases:**
- `400` - Invalid instance_id format
- `409` - Timer already running on this device

---

### Stop Timer (unchanged API, enhanced validation)

**Request (unchanged):**
```json
{
  "time_log_id": 123,
  "volume": 50,
  "idle_seconds": 120
}
```

**Backend now validates:**
1. Idle ≥ 0 (caps to 0 if negative)
2. Idle ≤ duration (caps to duration if exceeds)
3. Idle ≤ 48 hours (caps and logs warning)

---

## Security & Anti-Cheating

### Implemented:
✅ **Instance ID validation** - UUID format check  
✅ **Duplicate timer prevention** - Same device can't run 2 timers  
✅ **Idle time sanity checks** - Negative/excessive values rejected  
✅ **48-hour cap** - Prevents absurd idle times  
✅ **Logging** - All suspicious activity logged to console

### Recommended (Future Enhancement):
- Detect overlapping timers across instances for same user
- Flag users with multiple instances running simultaneously
- Admin dashboard to view instance conflicts

---

## Testing

### Test 1: Start timer with instance_id
```bash
curl -X POST http://localhost:4000/api/time-logs/start \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "task_template_id": 1,
    "work_location": "office",
    "instance_id": "abc123-def456-ghi789-jkl012"
  }'
```

**Expected:** Timer starts, instance_id stored in DB

---

### Test 2: Attempt duplicate timer on same instance
```bash
# Start timer 1
curl -X POST .../start -d '{"task_template_id": 1, "instance_id": "abc123..."}'

# Try to start timer 2 with same instance_id
curl -X POST .../start -d '{"task_template_id": 2, "instance_id": "abc123..."}'
```

**Expected:** Second request returns `409` error: "Timer already running on this device"

---

### Test 3: Invalid instance_id format
```bash
curl -X POST .../start -d '{
  "task_template_id": 1,
  "instance_id": "invalid-uuid-format"
}'
```

**Expected:** `400` error: "Invalid instance_id format"

---

### Test 4: Excessive idle time
```bash
curl -X POST .../stop -d '{
  "time_log_id": 123,
  "idle_seconds": 200000  # 55+ hours
}'
```

**Expected:** 
- Timer stops successfully
- Idle capped to 48 hours (172800s)
- Console log: "⚠️ Suspicious idle time: 200000s (55h) for log 123"

---

## Next Steps

1. ✅ Backend updated
2. ✅ Frontend sends instance_id
3. ✅ Database migrated
4. **TODO:** Test end-to-end flow
5. **Optional:** Add admin dashboard for instance monitoring

---

## Compatibility

✅ **Backward compatible** - If `instance_id` is `null`, system works as before  
✅ **No breaking changes** - Existing clients without instance_id still work  
✅ **Graceful degradation** - Missing instance_id doesn't break timer functionality
