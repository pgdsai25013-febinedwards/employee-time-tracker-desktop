const { app, BrowserWindow, ipcMain, powerMonitor, Tray, Menu, Notification } = require('electron');
const path = require('path');
const IdleManager = require('./idleManager');
const isDev = !app.isPackaged;

let mainWindow = null;
let tray = null;
let idleCheckInterval = null;
let notificationManager = null;
let idleManager = null;

// ==================== NOTIFICATION MANAGER ====================
class NotificationManager {
    constructor(window) {
        this.window = window;
        this.settings = {
            pomodoroEnabled: true,
            workDuration: 50 * 60, // 50 minutes in seconds
            breakDuration: 10 * 60, // 10 minutes in seconds
            startTimerReminder: true,
            endOfDaySummary: true,
        };
        this.pomodoroTimer = null;
        this.pomodoroPhase = 'work'; // 'work' or 'break'
        this.pomodoroTimeLeft = this.settings.workDuration;
        this.activityCheckInterval = null;
        this.isTimerActive = false;
        this.endOfDayScheduled = false;
    }

    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
    }

    setTimerActive(active) {
        this.isTimerActive = active;

        if (active && this.settings.pomodoroEnabled) {
            this.startPomodoro();
        } else {
            this.stopPomodoro();
        }
    }

    startPomodoro() {
        if (this.pomodoroTimer) {
            clearInterval(this.pomodoroTimer);
        }

        this.pomodoroPhase = 'work';
        this.pomodoroTimeLeft = this.settings.workDuration;

        this.pomodoroTimer = setInterval(() => {
            this.pomodoroTimeLeft--;

            if (this.pomodoroTimeLeft <= 0) {
                if (this.pomodoroPhase === 'work') {
                    // Work session complete - remind to take break
                    this.showNotification(
                        'Break Time! 🎉',
                        `You've worked for ${this.settings.workDuration / 60} minutes. Take a ${this.settings.breakDuration / 60}-minute break!`
                    );
                    this.pomodoroPhase = 'break';
                    this.pomodoroTimeLeft = this.settings.breakDuration;
                } else {
                    // Break complete - back to work
                    this.showNotification(
                        'Back to Work! 💪',
                        `Break is over. Ready for another ${this.settings.workDuration / 60} minutes?`
                    );
                    this.pomodoroPhase = 'work';
                    this.pomodoroTimeLeft = this.settings.workDuration;
                }
            }
        }, 1000);
    }

    stopPomodoro() {
        if (this.pomodoroTimer) {
            clearInterval(this.pomodoroTimer);
            this.pomodoroTimer = null;
        }
    }

    startActivityCheck() {
        if (this.activityCheckInterval) {
            clearInterval(this.activityCheckInterval);
        }

        // Check every 5 minutes
        this.activityCheckInterval = setInterval(() => {
            if (!this.settings.startTimerReminder) return;

            const systemIdleTime = powerMonitor.getSystemIdleTime();

            // If user is active (idle < 60s) but timer not running
            if (systemIdleTime < 60 && !this.isTimerActive) {
                this.showNotification(
                    'Start Tracking? ⏱️',
                    'You seem to be working. Would you like to start the timer?'
                );
            }
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    stopActivityCheck() {
        if (this.activityCheckInterval) {
            clearInterval(this.activityCheckInterval);
            this.activityCheckInterval = null;
        }
    }

    scheduleEndOfDay() {
        if (this.endOfDayScheduled || !this.settings.endOfDaySummary) return;

        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setHours(18, 0, 0, 0); // 6 PM

        // If it's already past 6 PM, schedule for tomorrow
        if (now >= endOfDay) {
            endOfDay.setDate(endOfDay.getDate() + 1);
        }

        const msUntilEndOfDay = endOfDay - now;

        setTimeout(() => {
            this.showEndOfDaySummary();
            this.endOfDayScheduled = false;
            // Reschedule for next day
            this.scheduleEndOfDay();
        }, msUntilEndOfDay);

        this.endOfDayScheduled = true;
        console.log(`📅 End-of-day summary scheduled for ${endOfDay.toLocaleString()}`);
    }

    showEndOfDaySummary() {
        // Request stats from renderer
        if (this.window && !this.window.isDestroyed()) {
            this.window.webContents.send('request-daily-stats');
        }
    }

    // Called from renderer with daily stats
    displayEndOfDaySummary(stats) {
        const totalHours = Math.floor(stats.totalSeconds / 3600);
        const totalMinutes = Math.floor((stats.totalSeconds % 3600) / 60);
        const productiveHours = Math.floor(stats.productiveSeconds / 3600);
        const productiveMinutes = Math.floor((stats.productiveSeconds % 3600) / 60);

        this.showNotification(
            'Daily Summary 📊',
            `Today: ${totalHours}h ${totalMinutes}m worked, ${productiveHours}h ${productiveMinutes}m productive. Great job!`
        );
    }

    showNotification(title, body) {
        if (!Notification.isSupported()) {
            console.log('Notifications not supported');
            return;
        }

        // Try to find icon in public folder (dev) or build resources
        const iconName = 'tray-icon.png';
        const iconPath = path.join(__dirname, '../public', iconName);
        const fs = require('fs');

        const notificationOptions = {
            title,
            body,
        };

        if (fs.existsSync(iconPath)) {
            notificationOptions.icon = iconPath;
        }

        const notification = new Notification(notificationOptions);

        notification.on('click', () => {
            if (this.window) {
                this.window.show();
                this.window.focus();
            }
        });

        notification.show();
    }

    cleanup() {
        this.stopPomodoro();
        this.stopActivityCheck();
    }
}


// Create the main application window
function createWindow() {
    // Set App User Model ID for Windows Taskbar grouping and icon
    app.setAppUserModelId('employee-timetracker-Notification');

    const getIconPath = () => {
        const iconName = 'tray-icon.png';
        const publicIcon = path.join(__dirname, '../public', iconName);
        const buildIcon = path.join(__dirname, '../build/icon.png');
        const fs = require('fs');

        if (fs.existsSync(publicIcon)) {
            console.log('Using public icon:', publicIcon);
            return publicIcon;
        }
        if (fs.existsSync(buildIcon)) {
            console.log('Using build icon:', buildIcon);
            return buildIcon;
        }
        console.log('No icon found');
        return undefined;
    };

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        icon: getIconPath(),
        backgroundColor: '#020617', // slate-950
    });

    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Handle window close - minimize to tray instead
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Create system tray icon
function createTray() {
    try {
        const iconName = 'tray-icon.png';
        const iconPath = path.join(__dirname, '../public', iconName);
        console.log('Attempting to load icon from:', iconPath);

        // Check if file exists
        const fs = require('fs');
        if (!fs.existsSync(iconPath)) {
            console.error('Icon file does not exist at path:', iconPath);
            return;
        }

        tray = new Tray(iconPath);

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show App',
                click: () => {
                    mainWindow.show();
                },
            },
            {
                label: 'Quit',
                click: () => {
                    app.isQuitting = true;
                    app.quit();
                },
            },
        ]);

        tray.setToolTip('Employee Time Tracker');
        tray.setContextMenu(contextMenu);

        tray.on('click', () => {
            mainWindow.show();
        });
    } catch (error) {
        console.error('Failed to create tray:', error);
    }
}

// App lifecycle
app.whenReady().then(() => {
    createWindow();
    createTray();

    // Initialize notification manager
    notificationManager = new NotificationManager(mainWindow);
    notificationManager.startActivityCheck();
    notificationManager.scheduleEndOfDay();

    // Initialize idle manager (after app is ready, powerMonitor is available)
    idleManager = new IdleManager(mainWindow);
    idleManager.initialize(powerMonitor);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    if (notificationManager) {
        notificationManager.cleanup();
    }
    if (idleManager) {
        idleManager.cleanup();
    }
});

app.on('before-quit', () => {
    app.isQuitting = true;
});

// ==================== IPC Handlers ====================

// Get system idle time (in seconds)
ipcMain.handle('get-system-idle-time', () => {
    try {
        return powerMonitor.getSystemIdleTime();
    } catch (error) {
        console.error('Error getting system idle time:', error);
        return 0;
    }
});

// Start idle monitoring
ipcMain.on('start-idle-monitoring', (event) => {
    if (idleCheckInterval) {
        clearInterval(idleCheckInterval);
    }

    // Check idle time every second
    idleCheckInterval = setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            const idleSeconds = powerMonitor.getSystemIdleTime();
            mainWindow.webContents.send('idle-time-update', idleSeconds);
        }
    }, 1000);
});

// Stop idle monitoring
ipcMain.on('stop-idle-monitoring', () => {
    if (idleCheckInterval) {
        clearInterval(idleCheckInterval);
        idleCheckInterval = null;
    }
});

// Store token securely (using localStorage in renderer for now, can be upgraded to safeStorage)
ipcMain.handle('store-token', async (event, token) => {
    // In production, use electron.safeStorage for encryption
    // For now, we'll let the renderer handle localStorage
    return { success: true };
});

// Get stored token
ipcMain.handle('get-token', async () => {
    // In production, retrieve from safeStorage
    return null;
});

// ==================== NOTIFICATION IPC HANDLERS ====================

// Update notification settings
ipcMain.on('update-notification-settings', (event, settings) => {
    if (notificationManager) {
        notificationManager.updateSettings(settings);
    }
});

// Notify timer state change
ipcMain.on('timer-state-changed', (event, isActive) => {
    if (notificationManager) {
        notificationManager.setTimerActive(isActive);
    }
});

// Send daily stats for end-of-day summary
ipcMain.on('daily-stats-response', (event, stats) => {
    if (notificationManager) {
        notificationManager.displayEndOfDaySummary(stats);
    }
});

// Check VPN status
// Check VPN status
ipcMain.handle('check-vpn-status', async () => {
    try {
        const util = require('util');
        const exec = util.promisify(require('child_process').exec);
        const os = require('os');

        // 1. Check Network Interfaces (Enhanced)
        const checkInterfaces = () => {
            const interfaces = os.networkInterfaces();
            // Expanded keyword list to include more VPN types
            const vpnKeywords = [
                'tun', 'tap', 'wintun',
                'openvpn', 'wireguard', 'wg',
                'zscaler', 'z-tunnel',
                'vpn', 'bdvpnservice',  // Added: generic vpn and bdvpnservice (user's VPN)
                'cisco', 'anyconnect',   // Cisco VPN
                'pulse', 'juniper',      // Pulse Secure / Juniper VPN
                'forticlient', 'fortinet', // FortiClient VPN
                'pptp', 'l2tp',          // Legacy VPN protocols
                'sonicwall', 'globalprotect' // Other common VPNs
            ];

            for (const name of Object.keys(interfaces)) {
                const lowerName = name.toLowerCase();
                if (vpnKeywords.some(keyword => lowerName.includes(keyword))) {
                    const iface = interfaces[name].find(details =>
                        !details.internal &&
                        details.family === 'IPv4' &&
                        details.address !== '0.0.0.0'
                    );
                    if (iface) {
                        console.log(`VPN detected on interface: ${name} (${iface.address})`);
                        return true;
                    }
                }
            }
            console.log('No VPN interface detected');
            return false;
        };

        // 2. Check Zscaler Services
        const checkZscalerServices = async () => {
            try {
                const { stdout } = await exec('tasklist /FI "IMAGENAME eq ZscalerTunnel.exe" /FI "IMAGENAME eq ZSATrayManager.exe" /FI "IMAGENAME eq ZscalerService.exe" /FI "IMAGENAME eq ZSATunnel.exe"');
                return stdout.includes('ZscalerTunnel') || stdout.includes('ZSATrayManager') || stdout.includes('ZscalerService') || stdout.includes('ZSATunnel');
            } catch (e) {
                console.error('Error checking Zscaler services:', e);
                return false;
            }
        };

        // 3. Check System Proxy (PAC)
        const checkSystemProxy = async () => {
            try {
                const { stdout } = await exec('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v AutoConfigURL');
                const lower = stdout.toLowerCase();
                return lower.includes('zscaler') || lower.includes('pac') || lower.includes('wpad');
            } catch (e) {
                // Registry key might not exist if no PAC is configured
                return false;
            }
        };

        // 4. Check Zscaler Root Certificate
        const checkZscalerCert = async () => {
            try {
                // This command lists all root certs, we grep for Zscaler
                const { stdout } = await exec('certutil -store root');
                return stdout.toLowerCase().includes('zscaler');
            } catch (e) {
                console.error('Error checking certificates:', e);
                return false;
            }
        };

        // Run checks
        // We run interface check first as it's fastest
        if (checkInterfaces()) return true;

        // Run system checks in parallel
        const [services, proxy, cert] = await Promise.all([
            checkZscalerServices(),
            checkSystemProxy(),
            checkZscalerCert()
        ]);

        if (services) console.log('Zscaler services detected');
        if (proxy) console.log('Zscaler proxy configuration detected');
        if (cert) console.log('Zscaler root certificate detected');

        return services || proxy || cert;

    } catch (error) {
        console.error('Error checking VPN status:', error);
        return false;
    }
});

// ==================== IDLE TRACKING IPC HANDLERS ====================

// Start timer tracking
ipcMain.handle('timer:start', async (event, timerData) => {
    try {
        if (idleManager) {
            idleManager.startTracking(timerData);
            return { success: true, instanceId: idleManager.getInstanceId() };
        }
        return { success: false, error: 'Idle manager not initialized' };
    } catch (error) {
        console.error('Error starting timer tracking:', error);
        return { success: false, error: error.message };
    }
});

// Stop timer tracking
ipcMain.handle('timer:stop', async (event, logId) => {
    try {
        if (idleManager) {
            idleManager.stopTracking();
            return { success: true };
        }
        return { success: false, error: 'Idle manager not initialized' };
    } catch (error) {
        console.error('Error stopping timer tracking:', error);
        return { success: false, error: error.message };
    }
});

// Get timer status
ipcMain.handle('timer:status', async () => {
    try {
        if (idleManager) {
            return idleManager.getStatus();
        }
        return null;
    } catch (error) {
        console.error('Error getting timer status:', error);
        return null;
    }
});

// Manual reconciliation trigger
ipcMain.handle('timer:reconcile', async () => {
    try {
        if (idleManager) {
            const result = idleManager.reconcileTimestamps();
            return result || { reconciled: false, message: 'No reconciliation needed' };
        }
        return { reconciled: false, error: 'Idle manager not initialized' };
    } catch (error) {
        console.error('Error reconciling timestamps:', error);
        return { reconciled: false, error: error.message };
    }
});

// Get instance ID
ipcMain.handle('timer:get-instance-id', async () => {
    try {
        if (idleManager) {
            return { instanceId: idleManager.getInstanceId() };
        }
        return { instanceId: null };
    } catch (error) {
        console.error('Error getting instance ID:', error);
        return { instanceId: null };
    }
});

// Renderer ready handshake
ipcMain.on('renderer-ready', () => {
    if (idleManager) {
        idleManager.setRendererReady(true);
    }
});

console.log('Electron main process started');
