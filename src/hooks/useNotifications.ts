import { useEffect } from 'react';

export function useNotifications(
    dayGroups: any[],
    currentLogId: number | null
) {
    // Listen for daily stats requests from Electron
    useEffect(() => {
        if (!window.electronAPI) return;

        const unsubscribe = window.electronAPI.onRequestDailyStats(() => {
            calculateDailyStats();
        });

        return () => {
            if (unsubscribe) unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dayGroups]);

    // Notify Electron when timer state changes
    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.notifyTimerStateChanged(currentLogId !== null);
        }
    }, [currentLogId]);

    // Calculate and send daily stats for end-of-day summary
    const calculateDailyStats = () => {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const todayGroup = dayGroups.find(g => g.date === todayStr);
        if (!todayGroup) {
            window.electronAPI?.sendDailyStats({ totalSeconds: 0, productiveSeconds: 0 });
            return;
        }

        let totalSeconds = 0;
        let totalIdleSeconds = 0;

        todayGroup.logs.forEach((log: any) => {
            totalSeconds += (log.durationMinutes || 0) * 60;
            totalIdleSeconds += (log.idleMinutes || 0) * 60;
        });

        const productiveSeconds = Math.max(0, totalSeconds - totalIdleSeconds);

        window.electronAPI?.sendDailyStats({ totalSeconds, productiveSeconds });
    };

    // Handle notification settings changes
    const handleNotificationSettingsChange = (settings: any) => {
        if (window.electronAPI) {
            window.electronAPI.updateNotificationSettings(settings);
        }
    };

    return {
        handleNotificationSettingsChange,
    };
}
