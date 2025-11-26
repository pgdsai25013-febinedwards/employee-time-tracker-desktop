/// <reference types="vite/client" />

interface ElectronAPI {
    getSystemIdleTime: () => Promise<number>;
    startIdleMonitoring: (interval?: number) => void;
    stopIdleMonitoring: () => void;
    onIdleTimeUpdate: (callback: (idleSeconds: number) => void) => () => void;
    storeToken: (token: string) => Promise<{ success: boolean }>;
    getToken: () => Promise<string | null>;
    updateNotificationSettings: (settings: any) => void;
    notifyTimerStateChanged: (isActive: boolean) => void;
    sendDailyStats: (stats: any) => void;
    onRequestDailyStats: (callback: () => void) => () => void;
    checkVpnStatus: () => Promise<boolean>;
}

interface Window {
    electronAPI?: ElectronAPI;
}
