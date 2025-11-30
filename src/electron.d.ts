// Type definitions for Electron API exposed via preload
export interface ElectronAPI {
    getSystemIdleTime: () => Promise<number>;
    startIdleMonitoring: () => void;
    stopIdleMonitoring: () => void;
    onIdleTimeUpdate: (callback: (idleSeconds: number) => void) => () => void;
    storeToken: (token: string) => Promise<{ success: boolean }>;
    getToken: () => Promise<string | null>;
    updateNotificationSettings: (settings: any) => void;
    notifyTimerStateChanged: (isActive: boolean) => void;
    sendDailyStats: (stats: { totalSeconds: number; productiveSeconds: number }) => void;
    onRequestDailyStats: (callback: () => void) => () => void;
    checkVpnStatus: () => Promise<boolean>;
    timerStart: (data: { logId: number; taskId: number | string }) => Promise<void>;
    timerStop: (logId: number) => Promise<void>;
    timerReconcile: () => Promise<{ gapDetected: boolean }>;
    timerGetInstanceId: () => Promise<{ instanceId: string }>;
    onIdleEvent: (callback: (event: any) => void) => () => void;
    rendererReady: () => void;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

export { };
