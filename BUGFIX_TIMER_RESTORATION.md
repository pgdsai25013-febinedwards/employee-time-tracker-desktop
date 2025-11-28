# Bug Fix: Active Timer Restoration After Lock/Unlock

## Problems Fixed

### ❌ Problem 1: Timer UI Disappeared After Lock/Unlock
**Issue:** When locking system and returning, the active timer was not visible in the UI even though it was still running in the backend.

**Root Cause:** `restoreActiveTimer()` function was defined but never called after reconciliation.

**Fix:** ✅ Call `restoreActiveTimer()` during reconciliation on component mount

---

### ❌ Problem 2: Idle Time Not Captured During Lock
**Issue:** Idle time was not being tracked or displayed when system was locked.

**Root Cause:** Idle event handler was too aggressive - it cleared the timer UI for ANY idle event, not just long gaps.

**Fix:** ✅ Updated idle event handler to only clear timer for gaps >= 60s

---

## What Was Changed

### `src/hooks/useTimer.ts`

#### 1. **Reconciliation Now Restores Active Timer** (Lines 68-90)
```typescript
// BEFORE: Reconciliation didn't restore timer
useEffect(() => {
    const runReconciliation = async () => {
        if (window.electronAPI?.timerReconcile) {
            // ... reconciliation logic
        }
    };
    runReconciliation();
}, []);

// AFTER: Reconciliation restores timer first
useEffect(() => {
    const runReconciliation = async () => {
        // First, restore any active timer from backend
        await restoreActiveTimer();  // ✅ NEW

        // Then run idle time reconciliation
        if (window.electronAPI?.timerReconcile) {
            // ... reconciliation logic
        }
    };
    runReconciliation();
}, []);
```

**Impact:** Timer now appears in UI on app launch/unlock!

---

#### 2. **Idle Event Handler Only Clears Timer for Long Gaps** (Lines 95-135)
```typescript
// BEFORE: Cleared timer for ANY idle event
window.electronAPI.onIdleEvent(async (idleEvent) => {
    // Always clear timer
    setCurrentLogId(null);
    setElapsedSeconds(0);
    // ...
});

// AFTER: Only clear timer if idle >= 60s
window.electronAPI.onIdleEvent(async (idleEvent) => {
    if (idle >= 60) {  // ✅ NEW: Check threshold
        // Clear timer only for long gaps
        setCurrentLogId(null);
        setElapsedSeconds(0);
        alert(`Timer stopped, ${minutes}m idle recorded`);
    } else {
        // Short gaps: just update idle time, keep timer running
        setIdleSeconds(idle);
    }
});
```

**Impact:** Timer stays visible for short idle periods!

---

#### 3. **Window Focus Listener Restores Timer** (Lines 146-161)
```typescript
// NEW: Added window focus event listener
useEffect(() => {
    const handleFocus = async () => {
        console.log('🔍 Window focused - checking for active timer...');
        if (!currentLogId) {
            // No timer in UI, check backend for active timer
            await restoreActiveTimer();
        }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
}, [currentLogId]);
```

**Impact:** Timer restores when you click back into the app after unlock!

---

## How It Works Now

### **Scenario 1: Lock Screen for 2 Minutes**

**Before:**
1. User locks screen
2. Returns after 2 minutes
3. ❌ Timer UI is blank (even though backend has active timer)
4. ❌ Idle time not shown

**After:**
1. User locks screen
2. Returns after 2 minutes
3. ✅ Alert: "System was locked for 2m, timer stopped, 2 minutes idle recorded"
4. ✅ Timer UI shows it was stopped
5. ✅ Logs refresh, showing 2 minutes of idle time

---

### **Scenario 2: Lock Screen for 30 Seconds**

**Before:**
1. User locks screen
2. Returns after 30 seconds
3. ❌ Timer UI disappeared

**After:**
1. User locks screen
2. Returns after 30 seconds
3. ✅ No notification (< 60s threshold)
4. ✅ Timer continues running
5. ✅ Idle time updates to 30s
6. ✅ Timer UI stays visible

---

### **Scenario 3: App Crash/Restart**

**Before:**
1. Timer running
2. App crashes or user force-quits
3. User restarts app
4. ❌ Timer UI is blank

**After:**
1. Timer running
2. App crashes or user force-quits
3. User restarts app
4. ✅ Reconciliation runs on mount
5. ✅ `restoreActiveTimer()` called automatically
6. ✅ Timer UI shows active task
7. ✅ Elapsed time calculated correctly

---

## Testing Instructions

### Test 1: Short Lock (< 60s)
1. Start a timer
2. Lock screen (Windows + L) 
3. Wait 30 seconds
4. Unlock

**Expected:**
- ✅ Timer still visible in UI
- ✅ Task name shown
- ✅ Idle time updated to ~30s
- ✅ No notification
- ✅ Timer continues running

---

### Test 2: Long Lock (> 60s)
1. Start a timer
2. Lock screen
3. Wait 3 minutes
4. Unlock

**Expected:**
- ✅ Alert: "System was locked for 3m 0s. Timer has been stopped and 3 minutes of idle time recorded."
- ✅ Timer UI cleared
- ✅ Logs refreshed
- ✅ New log entry shows 3 minutes idle
- ✅ Timer is stopped

---

### Test 3: App Restart with Active Timer
1. Start a timer
2. Close app normally (not force-quit)
3. Wait 1 minute
4. Restart app
5. Login

**Expected:**
- ✅ Console log: "🔍 Running timestamp reconciliation on mount..."
- ✅ Timer appears in UI automatically
- ✅ Task name shown
- ✅ Elapsed time correct
- ✅ No notification (< 60s gap)

---

### Test 4: Window Focus After Lock
1. Start a timer
2. Lock screen
3. Unlock screen
4. Click into the Electron app window

**Expected:**
- ✅ Console log: "🔍 Window focused - checking for active timer..."
- ✅ Timer restores if missing from UI
- ✅ Task name and time shown

---

## Console Logs to Watch For

### On App Launch:
```
🔍 Running timestamp reconciliation on mount...
📱 Instance ID: 1a3a921a-96eb-4c48-85ae-f7617b750f7a
✅ Sync complete - no pending operations
```

### On Window Focus:
```
🔍 Window focused - checking for active timer...
```

### On Short Idle (< 60s):
```
✅ Short idle period (30s), timer continues
```

### On Long Idle (>= 60s):
```
🚨 Idle event received: { idleSeconds: 180, source: 'lock', ... }
```

---

## Files Changed

- ✅ `src/hooks/useTimer.ts` - Main fix
- ✅ `task.md` - Updated bug fix section
- ✅ Git commit: "fix: restore active timer after lock/unlock and preserve timer UI"
- ✅ Pushed to origin/main

---

## Summary

**Fixed:**
1. ✅ Timer now restores on app launch/unlock
2. ✅ Timer UI stays visible for short idle periods
3. ✅ Idle time is tracked and displayed
4. ✅ Window focus listener ensures timer always appears

**Behavior:**
- Gaps < 60s → Timer continues, idle time updated
- Gaps >= 60s → Timer stopped, notification shown, idle recorded

**Result:** Active timer now persists through lock/unlock cycles and properly tracks idle time! 🎉
