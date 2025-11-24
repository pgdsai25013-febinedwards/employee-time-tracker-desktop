import { useState, useEffect } from 'react';
import { offlineManager } from '../lib/offline-manager';

export function useOffline(authToken: string | null) {
    const [isOnline, setIsOnline] = useState(true);
    const [queuedOpsCount, setQueuedOpsCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    // Set auth token for offline manager
    useEffect(() => {
        offlineManager.setAuthToken(authToken);
    }, [authToken]);

    // Track online/offline status
    useEffect(() => {
        const checkStatus = () => {
            setIsOnline(offlineManager.getOnlineStatus());
        };

        checkStatus();
        const interval = setInterval(checkStatus, 2000);

        return () => clearInterval(interval);
    }, []);

    // Track online status changes for sync
    useEffect(() => {
        if (isOnline) {
            setIsSyncing(true);
            offlineManager.syncQueue().finally(() => setIsSyncing(false));
        }
    }, [isOnline]);

    // Set up sync callback
    const registerSyncCallback = (callback: () => void) => {
        offlineManager.onSync(async () => {
            setIsSyncing(false);
            await callback();
        });
    };

    return {
        isOnline,
        queuedOpsCount,
        setQueuedOpsCount,
        isSyncing,
        registerSyncCallback,
    };
}
