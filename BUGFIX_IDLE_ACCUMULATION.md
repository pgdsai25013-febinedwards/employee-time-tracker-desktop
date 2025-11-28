# Bug Fix: Idle Time Accumulation

## Problem
**Issue:** Idle time was not accumulating across multiple idle events. When the system was locked or slept, the timer would stop, preventing the user from tracking total idle time within a single session.
**Root Cause:**
1. `IdleManager` (backend) was automatically stopping the tracking when a gap > 60s was detected.
2. `useTimer` (frontend) was clearing the timer state upon receiving an idle event.
3. `useTimer` was overwriting accumulated idle time with current real-time idle duration.

## Fix Implemented

### 1. Backend: `IdleManager.js`
- **Changed:** Removed `this.stopTracking()` call when idle is detected.
- **New Behavior:** Instead of stopping, it now reports the idle event and continues tracking (resets heartbeat). This keeps the backend timer active.

### 2. Frontend: `useTimer.ts`
- **Changed:** `onIdleEvent` handler now **accumulates** idle time instead of stopping the timer.
  ```typescript
  // Accumulate idle time
  accumulatedIdleRef.current += idle;
  setIdleSeconds(accumulatedIdleRef.current);
  ```
- **Added:** `accumulatedIdleRef` to track total hard idle time (lock/sleep) separately from soft idle (mouse inactivity).
- **Updated:** `onIdleTimeUpdate` now calculates total idle as `accumulated + current`.
  ```typescript
  setIdleSeconds(accumulatedIdleRef.current + currentSoftIdle);
  ```
- **Updated:** `restoreActiveTimer` now syncs `accumulatedIdleRef` from backend data.

## How It Works Now

### Scenario: Multiple Idle Events
1. **Start Timer**
2. **Lock Screen (5 mins)**
   - `IdleManager` detects 300s gap.
   - Sends event.
   - `useTimer` adds 300s to `accumulatedIdleRef`.
   - `idleSeconds` = 300.
   - Timer **continues running**.
   - Notification: "This time has been added to your idle time."
3. **Work for 10 mins**
   - `idleSeconds` stays at 300.
4. **Sleep System (10 mins)**
   - `IdleManager` detects 600s gap.
   - Sends event.
   - `useTimer` adds 600s to `accumulatedIdleRef`.
   - `idleSeconds` = 300 + 600 = 900 (15 mins).
   - Timer **continues running**.
5. **Stop Timer**
   - Sends `idle_seconds = 900` to backend.
   - Log saved with 15 mins idle time.

## Testing
1. Start timer.
2. Lock screen for > 1 min.
3. Unlock.
4. Verify timer is **still running**.
5. Verify idle time increased.
6. Repeat lock/unlock.
7. Verify idle time increased again (accumulated).
