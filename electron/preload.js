const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Get system idle time in seconds
    getSystemIdleTime: () => ipcRenderer.invoke('get-system-idle-time'),

    // Start monitoring idle time (sends updates every second)
    startIdleMonitoring: () => ipcRenderer.send('start-idle-monitoring'),

    // Stop monitoring idle time
    stopIdleMonitoring: () => ipcRenderer.send('stop-idle-monitoring'),

    // Listen for idle time updates
    onIdleTimeUpdate: (callback) => {
        const subscription = (event, idleSeconds) => callback(idleSeconds);
        ipcRenderer.on('idle-time-update', subscription);

        // Return unsubscribe function
        return () => {
            ipcRenderer.removeListener('idle-time-update', subscription);
        };
    },

    // Token management (optional - can use localStorage too)
    storeToken: (token) => ipcRenderer.invoke('store-token', token),
    getToken: () => ipcRenderer.invoke('get-token'),

    // Notification management
    updateNotificationSettings: (settings) =>
        ipcRenderer.send('update-notification-settings', settings),

    notifyTimerStateChanged: (isActive) =>
        ipcRenderer.send('timer-state-changed', isActive),

    sendDailyStats: (stats) =>
        ipcRenderer.send('daily-stats-response', stats),

    onRequestDailyStats: (callback) => {
        const subscription = () => callback();
        ipcRenderer.on('request-daily-stats', subscription);
        return () => {
            ipcRenderer.removeListener('request-daily-stats', subscription);
        };
    },

    // Check VPN status
    checkVpnStatus: () => ipcRenderer.invoke('check-vpn-status'),

    // ==================== IDLE TRACKING APIs ====================

    // Timer lifecycle
    timerStart: (timerData) => ipcRenderer.invoke('timer:start', timerData),
    timerStop: (logId) => ipcRenderer.invoke('timer:stop', logId),
    timerStatus: () => ipcRenderer.invoke('timer:status'),
    timerReconcile: () => ipcRenderer.invoke('timer:reconcile'),
    timerGetInstanceId: () => ipcRenderer.invoke('timer:get-instance-id'),

    // Listen for idle events from main process
    onIdleEvent: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('timer:idle-event', subscription);
        return () => {
            ipcRenderer.removeListener('timer:idle-event', subscription);
        };
    },

    // Notify main process once renderer is ready to receive events
    rendererReady: () => ipcRenderer.send('renderer-ready'),
});

console.log('Preload script loaded');
