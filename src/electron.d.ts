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
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}

export { };
