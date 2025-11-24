# Employee Time Tracker - Electron Desktop App

A desktop application for employee time tracking with **system-wide idle detection** powered by Electron.

## Features

- ✅ **System-Wide Idle Detection**: Uses Electron's `powerMonitor` API to track idle time across your entire computer
- ✅ **Google OAuth Authentication**: Secure sign-in with Google accounts
- ✅ **Timer Management**: Start/stop timers for different tasks
- ✅ **Volume Tracking**: Record units processed during work sessions
- ✅  **Team & Task Management**: Organize work by teams and tasks
- ✅ **Historical Data**: View and export time logs as CSV
- ✅ **Month Locking**: Managers can lock/unlock months to prevent edits
- ✅ **System Tray Integration**: Minimize to tray and keep tracking in background
- ✅ **Dark/Light Themes**: Modern UI with theme switching

## Prerequisites

- Node.js 18+ and npm
- Running backend server (Express + PostgreSQL/Supabase)
- Google OAuth Client ID

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```env
VITE_API_BASE_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
```

### 3. Start Backend Server

Make sure your backend server is running on the configured API URL. The backend handles authentication, database operations, and business logic.

```bash
cd backend
npm install
node index.js
```

### 4. Run Development Mode

```bash
npm run dev
```

This will:
- Start Vite dev server on `http://localhost:5173`
- Launch Electron app with hot reload
- Open DevTools for debugging

## Building for Production

### Create Distributable Package

```bash
npm run package
```

This creates a Windows installer in the `release/` directory.

## How System-Wide Idle Detection Works

Unlike the web version that only tracks activity within the browser window, this Electron app uses **OS-level APIs** to detect idle time:

1. **Main Process** (`electron/main.js`):
   - Uses `powerMonitor.getSystemIdleTime()` to query OS idle time
   - Polls every second when timer is active
   - Sends updates to renderer via IPC

2. **Renderer Process** (`src/App.tsx`):
   - Receives idle time updates through `electronAPI.onIdleTimeUpdate()`
   - Calculates accumulated idle time
   - No browser event listeners needed!

3. **Benefits**:
   - ✅ Works even when app is minimized
   - ✅ Tracks activity across multiple monitors
   - ✅ More accurate than web-based detection
   - ✅ No false positives from tab switching

## Project Structure

```
employee-timetracker-electron/
├── electron/           # Electron main process
│   ├── main.js        # App window & system tray
│   └── preload.js     # Secure IPC bridge
├── src/               # React frontend
│   ├── App.tsx        # Main application
│   ├── components/    # UI components
│   └── lib/           # Utilities
├── backend/           # Express API (separate server)
│   └── index.js       # Backend from your web app
├── build/             # Build resources (icons, etc.)
├── dist/              # Vite build output
├── release/           # Electron packaged apps
└── package.json
```

## Development Notes

### Key Differences from Web Version

1. **Idle Detection**: Uses `electronAPI.getSystemIdleTime()` instead of `mousemove`/`keydown` events
2. **Token Storage**: Can use Electron's `safeStorage` for encrypted credentials (currently using localStorage)
3. **System Integration**: Tray icon, notifications, auto-start capabilities
4. **Offline Support**: Can cache data and sync when connection restored (future enhancement)

### IPC Communication

The app uses a secure IPC architecture:
- **Preload script** exposes limited APIs to renderer
- **Context isolation** prevents direct Node.js access
- **Type-safe** communication via TypeScript definitions

## Troubleshooting

### App won't start
- Check that backend server is running
- Verify `.env` file exists and has correct values
- Try deleting `node_modules` and running `npm install` again

### Idle detection not working
- The app uses `powerMonitor` which requires Electron to be running
- Check console for any IPC errors
- Verify `electronAPI` is available in renderer (check browser console)

### Google Sign-In fails
- Ensure your Google Client ID is correct
- Check that `http://localhost` is in your authorized redirect URIs
- Open DevTools and check Network tab for failed requests

## License

MIT

## Credits

Built with:
- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)
