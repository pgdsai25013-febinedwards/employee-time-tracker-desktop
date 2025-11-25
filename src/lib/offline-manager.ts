import { db, QueuedOperation, CachedLog } from './indexed-db';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export class OfflineManager {
    private isOnline: boolean = navigator.onLine;
    private authToken: string | null = null;
    private onSyncCallback: (() => void) | null = null;
    private onlineCheckInterval: NodeJS.Timeout | null = null;

    constructor() {
        // Listen to browser online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        // Start periodic connectivity check
        this.startConnectivityCheck();
        // Initialize IndexedDB
        db.init();
    }

    setAuthToken(token: string | null) {
        this.authToken = token;
    }

    onSync(callback: () => void) {
        this.onSyncCallback = callback;
    }

    private startConnectivityCheck() {
        // Check connectivity every 10 seconds
        this.onlineCheckInterval = setInterval(async () => {
            await this.checkConnectivity();
        }, 10000);
    }

    private async checkConnectivity(): Promise<void> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(`${API_BASE}/api/health`, {
                method: 'GET',
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                if (!this.isOnline) this.handleOnline();
            } else {
                if (this.isOnline) this.handleOffline();
            }
        } catch (error) {
            if (this.isOnline) this.handleOffline();
        }
    }

    private handleOnline() {
        console.log('📡 Connection restored - syncing queued operations...');
        this.isOnline = true;
        this.syncQueue();
    }

    private handleOffline() {
        console.log('📴 Connection lost - operations will be queued');
        this.isOnline = false;
    }

    getOnlineStatus(): boolean {
        return this.isOnline;
    }

    async queueOperation(operation: Omit<QueuedOperation, 'id'>): Promise<number> {
        console.log('📥 Queueing operation:', operation.type);
        return await db.addQueuedOperation(operation);
    }

    async startOfflineTimer(payload: { task_template_id: number; task_name: string }): Promise<number> {
        const tempId = -Date.now(); // Negative ID for temporary local log
        const now = new Date().toISOString();
        const newLog: CachedLog = {
            id: tempId,
            user_id: 0,
            team_id: 0,
            task_template_id: payload.task_template_id,
            work_date: now.split('T')[0],
            started_at: now,
            ended_at: null,
            duration_seconds: 0,
            idle_seconds: 0,
            productive_seconds: 0,
            volume: 0,
            task_templates: { name: payload.task_name, id: payload.task_template_id },
        };
        await db.addCachedLog(newLog);
        await this.queueOperation({
            type: 'START_TIMER',
            payload: { ...payload, tempId },
            timestamp: Date.now(),
            retries: 0,
        });
        return tempId;
    }

    async stopOfflineTimer(payload: { time_log_id: number; volume: number; idle_seconds: number }): Promise<void> {
        const now = new Date().toISOString();
        const logs = await db.getCachedLogs();
        const log = logs.find(l => l.id === payload.time_log_id);
        if (log) {
            const startedAt = new Date(log.started_at).getTime();
            const endedAt = new Date(now).getTime();
            const durationSeconds = Math.floor((endedAt - startedAt) / 1000);
            const updatedLog: CachedLog = {
                ...log,
                ended_at: now,
                duration_seconds: durationSeconds,
                idle_seconds: payload.idle_seconds,
                productive_seconds: Math.max(0, durationSeconds - payload.idle_seconds),
                volume: payload.volume,
            };
            await db.updateCachedLog(updatedLog);
        }
        await this.queueOperation({
            type: 'STOP_TIMER',
            payload,
            timestamp: Date.now(),
            retries: 0,
        });
    }

    async syncQueue(): Promise<void> {
        if (!this.isOnline) {
            console.log('⏸️ Sync skipped - offline');
            return;
        }
        const queue = await db.getAllQueuedOperations();
        if (queue.length === 0) {
            console.log('✅ Sync complete - no pending operations');
            return;
        }
        console.log(`🔄 Syncing ${queue.length} queued operations...`);
        queue.sort((a, b) => a.timestamp - b.timestamp);
        const idMapping = new Map<number, number>();
        for (const operation of queue) {
            try {
                // Apply ID mapping for STOP_TIMER if needed
                if (operation.payload.time_log_id && idMapping.has(operation.payload.time_log_id)) {
                    operation.payload.time_log_id = idMapping.get(operation.payload.time_log_id);
                }
                const result = await this.processOperation(operation);
                // START_TIMER: map temp ID to real ID and clean up temp cached log
                if (operation.type === 'START_TIMER' && operation.payload.tempId) {
                    const data = await result.json();
                    if (data.log && data.log.id) {
                        idMapping.set(operation.payload.tempId, data.log.id);
                        await db.removeCachedLog(operation.payload.tempId);
                    }
                }
                // STOP_TIMER: on success, remove cached log
                if (operation.type === 'STOP_TIMER' && result.ok) {
                    await db.removeCachedLog(operation.payload.time_log_id);
                }
                await db.removeQueuedOperation(operation.id!);
                console.log(`✅ Synced operation ${operation.type}`);
            } catch (error) {
                console.error(`❌ Failed to sync operation ${operation.type}:`, error);
                operation.retries = (operation.retries || 0) + 1;
                if (operation.retries > 5) {
                    console.error(`🗑️ Removing operation after ${operation.retries} failed attempts`);
                    await db.removeQueuedOperation(operation.id!);
                } else {
                    await db.updateQueuedOperation(operation.id!, operation);
                }
            }
        }
        console.log('✅ Sync complete');
        if (this.onSyncCallback) this.onSyncCallback();
    }

    private async processOperation(operation: QueuedOperation): Promise<Response> {
        const headers = new Headers({ 'Content-Type': 'application/json' });
        if (this.authToken) headers.set('Authorization', `Bearer ${this.authToken}`);
        const { tempId, ...cleanPayload } = operation.payload;
        switch (operation.type) {
            case 'START_TIMER':
                return await fetch(`${API_BASE}/api/time-logs/start`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(cleanPayload),
                });
            case 'STOP_TIMER':
                return await fetch(`${API_BASE}/api/time-logs/stop`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(cleanPayload),
                });
            case 'EDIT_LOG':
                return await fetch(`${API_BASE}/api/time-logs/${operation.payload.id}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(operation.payload.data),
                });
            case 'DELETE_LOG':
                return await fetch(`${API_BASE}/api/time-logs/${operation.payload.id}`, {
                    method: 'DELETE',
                    headers,
                });
            default:
                throw new Error(`Unknown operation type: ${operation.type}`);
        }
    }

    async cacheLogs(logs: CachedLog[]): Promise<void> {
        await db.cacheLogs(logs);
    }

    async getCachedLogs(): Promise<CachedLog[]> {
        return await db.getCachedLogs();
    }

    cleanup() {
        if (this.onlineCheckInterval) clearInterval(this.onlineCheckInterval);
        window.removeEventListener('online', () => this.handleOnline());
        window.removeEventListener('offline', () => this.handleOffline());
    }
}

export const offlineManager = new OfflineManager();
