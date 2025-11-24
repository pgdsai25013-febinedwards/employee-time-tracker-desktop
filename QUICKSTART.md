# Quick Start Guide

## Current Setup Status ✅

Your Electron app is configured and ready to run with:
- **Backend API**: https://employee-time-tracker.onrender.com
- **Google OAuth**: Configured with your Client ID
- **Dependencies**: All installed

## Option 1: Run with Your Render Backend (Recommended for Quick Test)

Since your backend is already deployed on Render, you can start the Electron app immediately:

```bash
cd c:\Febin\Employee-TimeTracker-Electron
npm run dev
```

That's it! The app will connect to your existing Render backend.

## Option 2: Run Backend Locally (For Development)

If you want to run the backend locally for development:

### 1. Copy your existing backend folder here:
```bash
# Copy your backend folder to this location
# From: (wherever your current backend is)
# To: c:\Febin\Employee-TimeTracker-Electron\backend\
```

### 2. Install backend dependencies:
```bash
cd c:\Febin\Employee-TimeTracker-Electron\backend
npm install
```

### 3. Create backend/.env file with your credentials:
```env
SUPABASE_DB_URL="postgresql://postgres.jakqscjxyhictzcatefw:ztB.%23%24%23Sbn%262j4W@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"
SUPABASE_URL=https://jakqscjxyhictzcatefw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impha3FzY2p4eWhpY3R6Y2F0ZWZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzgxMzIxNSwiZXhwIjoyMDc5Mzg5MjE1fQ.zGuFP-R3L_oTQ5wqAYi6pAPRi86mOZKgykswRjRh9CU
JWT_SECRET=my_super_secret_981293879123
JWT_EXPIRES_IN=8h
GOOGLE_CLIENT_ID=737730394378-mo1smt14tkjpn3b5eh92vluivdpfhpnb.apps.googleusercontent.com
PORT=4000
```

### 4. Start backend:
```bash
node index.js
```

### 5. Update Electron app .env to use local backend:
```env
VITE_API_BASE_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=737730394378-mo1smt14tkjpn3b5eh92vluivdpfhpnb.apps.googleusercontent.com
```

### 6. Start Electron app (in new terminal):
```bash
cd c:\Febin\Employee-TimeTracker-Electron
npm run dev
```

## Testing System-Wide Idle Detection

Once the app is running:

1. **Sign in** with your Google account
2. **Select a team and task**
3. **Click "Start timer"**
4. **Leave your computer idle** for 2-3 minutes (don't touch keyboard or mouse)
5. **Return and check** - you should see:
   - Idle time increasing in the header badge
   - Badge color changing to red when idle
   - Accurate idle tracking even if app was minimized!

## What's Different from Web Version?

The desktop app uses **OS-level idle detection** instead of browser events:

### Web Version (Limited):
- Only tracks activity when browser tab is active
- Stops working when you switch tabs
- Can't detect idle time in other apps

### Desktop Version (Powerful):
- Tracks system-wide keyboard and mouse activity
- Works even when app is minimized to tray
- Accurate across multiple monitors and applications
- Uses Electron's `powerMonitor.getSystemIdleTime()` API

## Building Windows Installer

When you're ready to distribute:

```bash
npm run package
```

This creates a Windows installer in the `release/` folder.

## Troubleshooting

### Backend Connection Failed
- Check if backend is running (Render or localhost)
- Verify `VITE_API_BASE_URL` in `.env` file
- Check browser console (F12) for errors

### Google Sign-In Not Working
- Make sure your Google Client ID is correct
- Add `http://localhost` to authorized origins in Google Cloud Console
- Try clearing browser cache

### Idle Detection Not Working
- This only works in the Electron app (not in browser)
- Make sure you're running `npm run dev`, not just opening in browser
- Check that `electronAPI` is available (open DevTools with F12)

## Next Steps

1. **Test the app** - Run it and verify all features work
2. **Try idle detection** - Leave computer idle for a few minutes
3. **Check data sync** - Verify logs appear in your Supabase database
4. **Build installer** - Create distributable package with `npm run package`

Enjoy your new desktop app with proper idle tracking! 🎉
