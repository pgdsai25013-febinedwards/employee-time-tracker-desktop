/// <reference types="vite/client" />

interface TimerData {
    logId: number;
    taskId: string | number;
}

interface IdleEventData {
    idleSeconds: number;
    source: string;
    startedAt: number;
    endedAt: number;
    logId: number;
    gapDetected: boolean;
    clockTampering: boolean;
}

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

    // Idle tracking APIs
    timerStart: (timerData: TimerData) => Promise<{ success: boolean; instanceId?: string; error?: string }>;
    timerStop: (logId: number) => Promise<{ success: boolean; error?: string }>;
    timerStatus: () => Promise<any>;
    timerReconcile: () => Promise<any>;
    timerGetInstanceId: () => Promise<{ instanceId: string | null }>;
    onIdleEvent: (callback: (data: IdleEventData) => void) => () => void;
}

interface Window {
    electronAPI?: ElectronAPI;
}
