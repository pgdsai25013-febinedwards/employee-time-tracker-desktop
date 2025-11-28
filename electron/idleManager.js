const Store = require('electron-store');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * IdleManager - Enterprise-grade idle tracking with monotonic time reconciliation
 * 
 * Features:
 * - Layer 1: Power event detection (lock, suspend, shutdown)
 * - Layer 2: Dual timestamp heartbeat (system + monotonic) with forced writes
 * - Layer 3: Reconciliation on resume to detect gaps and clock tampering
 */
class IdleManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.store = new Store({
            name: 'idle-tracker',
            defaults: {
                instanceId: null,
                lastActiveAt: null,
                lastActiveAtMonotonic: null,
                timerRunning: false,
                currentLogId: null,
                taskId: null,
                lastEventSource: null,
                processStartTime: null
            }
        });

        this.heartbeatInterval = null;
        this.processStartTime = Date.now();

        // Initialize or get instance ID
        this.initializeInstanceId();

        console.log('🔧 IdleManager initialized with instance ID:', this.getInstanceId());
    }

    /**
     * Initialize or retrieve persistent instance ID
     */
    initializeInstanceId() {
        let instanceId = this.store.get('instanceId');
        if (!instanceId) {
            instanceId = uuidv4();
            this.store.set('instanceId', instanceId);
            console.log('✨ Generated new instance ID:', instanceId);
        }
        return instanceId;
    }

    /**
     * Get the unique instance ID for this device
     */
    getInstanceId() {
        return this.store.get('instanceId');
    }

    /**
     * Initialize power event listeners
     */
    initialize(powerMonitor) {
        console.log('🎯 Setting up power event listeners...');

        // Lock screen events
        powerMonitor.on('lock-screen', () => {
            console.log('🔒 Screen locked');
            this.handleIdleStart('lock');
        });

        powerMonitor.on('unlock-screen', () => {
            console.log('🔓 Screen unlocked');
            this.handleIdleEnd('unlock');
        });

        // System suspend/resume
        powerMonitor.on('suspend', () => {
            console.log('💤 System suspending');
            this.handleIdleStart('suspend');
        });

        powerMonitor.on('resume', () => {
            console.log('⚡ System resumed');
            this.handleIdleEnd('resume');
        });

        // Shutdown (best effort - may not always fire)
        powerMonitor.on('shutdown', () => {
            console.log('🛑 System shutting down');
            this.handleIdleStart('shutdown');
        });

        // macOS-specific events
        if (process.platform === 'darwin') {
            powerMonitor.on('user-did-become-active', () => {
                console.log('👤 User became active (macOS)');
                this.handleIdleEnd('user-active');
            });

            powerMonitor.on('user-did-resign-active', () => {
                console.log('👤 User resigned active (macOS)');
                this.handleIdleStart('user-inactive');
            });
        }

        console.log('✅ Power event listeners ready');

        // Run initial reconciliation (in case app crashed previously)
        this.reconcileTimestamps();
    }

    /**
     * Start tracking timer with dual timestamp heartbeat
     */
    startTracking(timerData) {
        const { logId, taskId } = timerData;
        console.log('▶️ Starting idle tracking for log:', logId);

        // Update store with initial values
        this.updateHeartbeat();
        this.store.set('timerRunning', true);
        this.store.set('currentLogId', logId);
        this.store.set('taskId', taskId);
        this.store.set('processStartTime', this.processStartTime);

        // Start heartbeat interval (every 1 second)
        this.heartbeatInterval = setInterval(() => {
            this.updateHeartbeat();
        }, 1000);

        console.log('💓 Heartbeat started (1s interval)');
    }

    /**
     * Stop tracking with forced write
     */
    stopTracking() {
        console.log('⏹️ Stopping idle tracking');

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        // Forced write to ensure state is persisted
        this.forcedWrite({
            timerRunning: false,
            currentLogId: null,
            taskId: null,
            lastEventSource: 'timer-stopped'
        });

        console.log('✅ Tracking stopped');
    }

    /**
     * Update heartbeat with dual timestamps
     */
    updateHeartbeat() {
        const now = Date.now();
        const monotonicNow = process.uptime() * 1000; // Convert to milliseconds

        this.store.set('lastActiveAt', now);
        this.store.set('lastActiveAtMonotonic', monotonicNow);
    }

    /**
     * Handle idle start (system becomes unavailable)
     * Uses forced synchronous write to guarantee persistence
     */
    handleIdleStart(source) {
        console.log(`🚫 Idle start: ${source}`);

        const data = {
            lastEventSource: source,
            lastActiveAt: Date.now(),
            lastActiveAtMonotonic: process.uptime() * 1000
        };

        // Forced synchronous write (critical for suspend/shutdown)
        this.forcedWrite(data);
    }

    /**
     * Handle idle end (system becomes available)
     * Triggers reconciliation
     */
    handleIdleEnd(source) {
        console.log(`✅ Idle end: ${source}`);
        this.reconcileTimestamps();
    }

    /**
     * Forced synchronous write using fs.writeFileSync
     * Guarantees data is flushed to disk even if process dies
     */
    forcedWrite(updates) {
        try {
            const storePath = this.store.path;
            const currentData = this.store.store;
            const newData = { ...currentData, ...updates };

            // Synchronous write
            fs.writeFileSync(storePath, JSON.stringify(newData, null, 2), 'utf8');

            // Update in-memory store
            Object.keys(updates).forEach(key => {
                this.store.set(key, updates[key]);
            });

            console.log('💾 Forced write complete');
        } catch (error) {
            console.error('❌ Forced write failed:', error);
        }
    }

    /**
     * Reconcile timestamps on app launch or resume
     * Implements dual reconciliation (system vs monotonic)
     */
    reconcileTimestamps() {
        const timerRunning = this.store.get('timerRunning');
        if (!timerRunning) {
            console.log('ℹ️ No active timer to reconcile');
            return null;
        }

        console.log('🔍 Starting timestamp reconciliation...');

        const lastActiveAt = this.store.get('lastActiveAt');
        const lastActiveAtMonotonic = this.store.get('lastActiveAtMonotonic');
        const currentLogId = this.store.get('currentLogId');
        const lastEventSource = this.store.get('lastEventSource');

        if (!lastActiveAt || !lastActiveAtMonotonic) {
            console.warn('⚠️ Missing timestamp data, cannot reconcile');
            return null;
        }

        // Calculate both gaps
        const now = Date.now();
        const monotonicNow = process.uptime() * 1000;

        const systemGap = now - lastActiveAt;
        const monotonicGap = monotonicNow - lastActiveAtMonotonic;

        console.log(`📊 System gap: ${Math.floor(systemGap / 1000)}s`);
        console.log(`📊 Monotonic gap: ${Math.floor(monotonicGap / 1000)}s`);

        // Detect clock tampering
        const gapDifference = Math.abs(systemGap - monotonicGap);
        if (gapDifference > 30000) {
            console.warn('⚠️ Clock tampering detected!');
            console.warn(`   System gap: ${Math.floor(systemGap / 1000)}s`);
            console.warn(`   Monotonic gap: ${Math.floor(monotonicGap / 1000)}s`);
            console.warn(`   Difference: ${Math.floor(gapDifference / 1000)}s`);
        }

        // Always trust monotonic time
        const trustedGap = monotonicGap;

        // Check if gap exceeds 60 second threshold
        if (trustedGap > 60000) {
            const idleSeconds = Math.floor(trustedGap / 1000);
            console.log(`⏱️ Idle detected: ${idleSeconds}s (source: ${lastEventSource})`);

            const idleEvent = {
                idleSeconds,
                source: lastEventSource || 'unknown',
                startedAt: lastActiveAt,
                endedAt: now,
                logId: currentLogId,
                gapDetected: true,
                clockTampering: gapDifference > 30000
            };

            // Send to renderer
            this.sendIdleEventToRenderer(idleEvent);

            // Stop tracking (timer should be auto-stopped)
            this.stopTracking();

            return idleEvent;
        } else {
            console.log(`✅ Gap within threshold (${Math.floor(trustedGap / 1000)}s), no idle`);
            // Update heartbeat and continue
            this.updateHeartbeat();
            return null;
        }
    }

    /**
     * Send idle event to renderer process via IPC
     */
    sendIdleEventToRenderer(idleEvent) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            console.log('📤 Sending idle event to renderer:', idleEvent);
            this.mainWindow.webContents.send('timer:idle-event', idleEvent);
        } else {
            console.warn('⚠️ Cannot send idle event - window not available');
        }
    }

    /**
     * Get current timer status
     */
    getStatus() {
        return {
            instanceId: this.getInstanceId(),
            timerRunning: this.store.get('timerRunning'),
            currentLogId: this.store.get('currentLogId'),
            taskId: this.store.get('taskId'),
            lastActiveAt: this.store.get('lastActiveAt'),
            lastActiveAtMonotonic: this.store.get('lastActiveAtMonotonic'),
            lastEventSource: this.store.get('lastEventSource')
        };
    }

    /**
     * Cleanup on app shutdown
     */
    cleanup() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        console.log('🧹 IdleManager cleaned up');
    }
}

module.exports = IdleManager;
