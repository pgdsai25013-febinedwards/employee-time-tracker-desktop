import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database schema
interface TimeTrackerDB extends DBSchema {
    queuedOperations: {
        key: number;
        value: QueuedOperation;
        indexes: { 'by-timestamp': number };
    };
    cachedLogs: {
        key: number;
        value: CachedLog;
    };
    syncMetadata: {
        key: string;
        value: any;
    };
}

export interface QueuedOperation {
    id?: number;
    type: 'START_TIMER' | 'STOP_TIMER' | 'EDIT_LOG' | 'DELETE_LOG';
    payload: any;
    timestamp: number;
    retries: number;
}

export interface CachedLog {
    id: number;
    user_id: number;
    team_id: number;
    task_template_id: number;
    work_date: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number;
    idle_seconds: number;
    productive_seconds: number;
    volume: number;
    task_templates?: any;
}

class IndexedDBManager {
    private db: IDBPDatabase<TimeTrackerDB> | null = null;
    private dbName = 'TimeTrackerDB';
    private version = 1;

    async init(): Promise<void> {
        this.db = await openDB<TimeTrackerDB>(this.dbName, this.version, {
            upgrade(db) {
                // Create queuedOperations store
                if (!db.objectStoreNames.contains('queuedOperations')) {
                    const queueStore = db.createObjectStore('queuedOperations', {
                        keyPath: 'id',
                        autoIncrement: true,
                    });
                    queueStore.createIndex('by-timestamp', 'timestamp');
                }

                // Create cachedLogs store
                if (!db.objectStoreNames.contains('cachedLogs')) {
                    db.createObjectStore('cachedLogs', { keyPath: 'id' });
                }

                // Create syncMetadata store
                if (!db.objectStoreNames.contains('syncMetadata')) {
                    db.createObjectStore('syncMetadata');
                }
            },
        });
    }

    // Queued Operations
    async addQueuedOperation(operation: Omit<QueuedOperation, 'id'>): Promise<number> {
        if (!this.db) await this.init();
        return this.db!.add('queuedOperations', operation as QueuedOperation);
    }

    async getAllQueuedOperations(): Promise<QueuedOperation[]> {
        if (!this.db) await this.init();
        return this.db!.getAll('queuedOperations');
    }

    async removeQueuedOperation(id: number): Promise<void> {
        if (!this.db) await this.init();
        await this.db!.delete('queuedOperations', id);
    }

    async updateQueuedOperation(id: number, operation: QueuedOperation): Promise<void> {
        if (!this.db) await this.init();
        await this.db!.put('queuedOperations', { ...operation, id });
    }

    // Cached Logs
    async cacheLogs(logs: CachedLog[]): Promise<void> {
        if (!this.db) await this.init();
        const tx = this.db!.transaction('cachedLogs', 'readwrite');
        await Promise.all(logs.map(log => tx.store.put(log)));
        await tx.done;
    }

    async getCachedLogs(): Promise<CachedLog[]> {
        if (!this.db) await this.init();
        return this.db!.getAll('cachedLogs');
    }

    async clearCachedLogs(): Promise<void> {
        if (!this.db) await this.init();
        await this.db!.clear('cachedLogs');
    }

    // Sync Metadata
    async setMetadata(key: string, value: any): Promise<void> {
        if (!this.db) await this.init();
        await this.db!.put('syncMetadata', value, key);
    }

    async getMetadata(key: string): Promise<any> {
        if (!this.db) await this.init();
        return this.db!.get('syncMetadata', key);
    }
}

// Singleton instance
export const db = new IndexedDBManager();
