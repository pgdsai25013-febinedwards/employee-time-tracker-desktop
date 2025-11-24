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
                if (!this.isOnline) {
                    this.handleOnline();
                }
            } else {
                if (this.isOnline) {
                    this.handleOffline();
                }
            }
        } catch (error) {
            if (this.isOnline) {
                this.handleOffline();
            }
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

        for (const operation of queue) {
            try {
                await this.processOperation(operation);
                await db.removeQueuedOperation(operation.id!);
                console.log(`✅ Synced operation ${operation.type}`);
            } catch (error) {
                console.error(`❌ Failed to sync operation ${operation.type}:`, error);

                // Increment retry count
                operation.retries = (operation.retries || 0) + 1;

                // Remove if too many retries (> 5)
                if (operation.retries > 5) {
                    console.error(`🗑️ Removing operation after ${operation.retries} failed attempts`);
                    await db.removeQueuedOperation(operation.id!);
                } else {
                    await db.updateQueuedOperation(operation.id!, operation);
                }
            }
        }

        console.log('✅ Sync complete');

        // Notify callback
        if (this.onSyncCallback) {
            this.onSyncCallback();
        }
    }

    private async processOperation(operation: QueuedOperation): Promise<any> {
        const headers = new Headers({
            'Content-Type': 'application/json',
        });

        if (this.authToken) {
            headers.set('Authorization', `Bearer ${this.authToken}`);
        }

        switch (operation.type) {
            case 'START_TIMER':
                return await fetch(`${API_BASE}/api/time-logs/start`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(operation.payload),
                });

            case 'STOP_TIMER':
                return await fetch(`${API_BASE}/api/time-logs/stop`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(operation.payload),
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
        if (this.onlineCheckInterval) {
            clearInterval(this.onlineCheckInterval);
        }
        window.removeEventListener('online', () => this.handleOnline());
        window.removeEventListener('offline', () => this.handleOffline());
    }
}

// Singleton instance
export const offlineManager = new OfflineManager();
