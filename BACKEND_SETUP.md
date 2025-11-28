# 🚀 Backend + Frontend Setup Guide

## ✅ Your Backend is Live on Render!

**URL:** https://employee-time-tracker-desktop.onrender.com

**Status:** Backend running on port 10000 ✅

---

## 🔧 Frontend Setup (Connect to Production Backend)

### Step 1: Create `.env` File

Create a file named `.env` in the root directory (same level as `package.json`):

```bash
# Copy from .env.example
cp .env.example .env
```

Or create manually with this content:

```env
# Backend API URL - Production (Render)
VITE_API_BASE_URL=https://employee-time-tracker-desktop.onrender.com

# Google OAuth Client ID
VITE_GOOGLE_CLIENT_ID=your-actual-google-client-id.apps.googleusercontent.com
```

### Step 2: Get Google Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create one
3. Navigate to **APIs & Services** → **Credentials**
4. Create/find your **OAuth 2.0 Client ID**
5. Copy the Client ID
6. Paste it in your `.env` file (replace the placeholder)

### Step 3: Restart the App

```bash
# Stop the app (Ctrl+C)
# Start again
npm run dev
```

---

## 🧪 Test the Connection

### Option 1: Browser Test
Open in browser: https://employee-time-tracker-desktop.onrender.com

**Expected response:**
```json
{
  "message": "Employee Time Tracker API is running",
  "version": "1.0.0",
  "timestamp": "2025-11-28T..."
}
```

### Option 2: Health Check
Visit: https://employee-time-tracker-desktop.onrender.com/api/health

**Expected response:**
```json
{
  "status": "ok",
  "database": "connected",
  "db_time": "2025-11-28T..."
}
```

### Option 3: From Electron App
1. Open DevTools in Electron app (Ctrl+Shift+I)
2. Check Console for logs like:
   ```
   📱 Instance ID: abc123-...
   ✅ Idle tracking started for log: 42
   ```
3. Start a timer - it should work without errors

---

## 🔄 Switch Between Local and Production

### Use Production Backend (Render):
```env
VITE_API_BASE_URL=https://employee-time-tracker-desktop.onrender.com
```

### Use Local Backend (Development):
```env
VITE_API_BASE_URL=http://localhost:4000
```

**Note:** You need to restart the Electron app after changing `.env` file.

---

## 🐛 Troubleshooting

### Problem: "Failed to start timer" or "Network Error"

**Check:**
1. Is `.env` file created? (in root folder)
2. Does it have `VITE_API_BASE_URL=https://employee-time-tracker-desktop.onrender.com`?
3. Did you restart the app after creating `.env`?
4. Is backend up? Check https://employee-time-tracker-desktop.onrender.com

### Problem: "Google login not working"

**Check:**
1. Is `VITE_GOOGLE_CLIENT_ID` set in `.env`?
2. Is the Client ID valid and from Google Cloud Console?
3. Did you add authorized JavaScript origins in Google Cloud Console?
   - Add: `http://localhost:5173`
   - Add: `file://` (for Electron)

### Problem: "CORS error"

**Solution:** Already fixed! Backend now allows:
- Electron apps (`file://` protocol) ✅
- Localhost ports (5173, 5174, 3000) ✅
- Netlify deployment ✅
- Render backend itself ✅

### Problem: Backend says "Connection refused"

**Possible causes:**
1. **Render free tier cold start** - Wait 30-60 seconds, Render spins up
2. **Backend crashed** - Check Render logs
3. **Wrong URL** - Should be `https://employee-time-tracker-desktop.onrender.com`

---

## ✨ What Was Improved in Backend

1. ✅ **Enhanced CORS** - Now accepts Electron, Render, Netlify
2. ✅ **JWT Security Warning** - Logs if JWT_SECRET is missing
3. ✅ **Root route** - GET `/` returns API status
4. ✅ **Better health check** - Shows DB connection time
5. ✅ **DB validation on startup** - Confirms Postgres connection
6. ✅ **Instance ID support** - Accepts `instance_id` from frontend
7. ✅ **Idle validation** - Prevents negative/excessive idle times

---

## 📦 Deployment Checklist

- [x] Supabase database running
- [x] `instance_id` column added to `time_logs`
- [x] Backend deployed to Render
- [x] Backend environment variables set (DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID)
- [ ] Frontend `.env` file created with production URL
- [ ] Google Client ID added to frontend `.env`
- [ ] App restarted to load new environment variables
- [ ] Test timer start/stop
- [ ] Test idle tracking (lock screen)

---

## 🎯 Next Steps

1. **Create `.env` file** in your project root
2. **Add production URL**: `VITE_API_BASE_URL=https://employee-time-tracker-desktop.onrender.com`
3. **Add Google Client ID**: Get from Google Cloud Console
4. **Restart app**: `npm run dev`
5. **Test login and timer**: Should now connect to Render backend

Your app is ready to use the production backend! 🚀
