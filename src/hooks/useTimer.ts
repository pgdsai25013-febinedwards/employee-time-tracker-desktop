import { useState, useEffect, useRef } from 'react';
import { offlineManager } from '../lib/offline-manager';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function useTimer(
    authToken: string | null,
    selectedTeamId: number | null,
    selectedTaskId: number | string,
    volumeInput: string,
    setVolumeInput: (value: string) => void,
    fetchRecentLogs: () => Promise<void>,
    tasks: any[] = []
) {
    const [currentLogId, setCurrentLogId] = useState<number | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [idleSeconds, setIdleSeconds] = useState(0);
    const [currentSystemIdle, setCurrentSystemIdle] = useState(0);

    const timerStartAtRef = useRef<number | null>(null);
    const unsubscribeIdleRef = useRef<(() => void) | null>(null);

    // API fetch helper
    async function apiFetch(input: string, init: RequestInit = {}) {
        const headers = new Headers(init.headers || {});
        if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
        const response = await fetch(`${API_BASE}${input}`, {
            ...init,
            headers,
        });
        if (response.status === 401) {
            setTimeout(() => {
                localStorage.removeItem('ett_token');
                localStorage.removeItem('ett_user');
            }, 10);
        }
        return response;
    }

    // Restore active timer
    const restoreActiveTimer = async () => {
        try {
            const res = await apiFetch('/api/time-logs/recent?days=1');
            if (!res.ok) return;
            const data = await res.json();
            const active = data.find((l: any) => l.ended_at === null);
            if (!active) return;
            setCurrentLogId(active.id);
            const startedAtMs = new Date(active.started_at).getTime();
            timerStartAtRef.current = startedAtMs;
            const diff = Math.floor((Date.now() - startedAtMs) / 1000);
            setElapsedSeconds(diff > 0 ? diff : 0);
            setIdleSeconds(active.idle_seconds ?? 0);
        } catch (err) {
            console.error('Failed to restore active timer', err);
        }
    };

    // Electron idle monitoring
    useEffect(() => {
        if (currentLogId !== null) {
            // Start monitoring when timer is active
            if (window.electronAPI) {
                window.electronAPI.startIdleMonitoring(1000);
            }

            const unsubscribe = window.electronAPI?.onIdleTimeUpdate((systemIdleSeconds: number) => {
                setCurrentSystemIdle(systemIdleSeconds);
                const IDLE_THRESHOLD = 60;
                if (systemIdleSeconds >= IDLE_THRESHOLD) {
                    setIdleSeconds(systemIdleSeconds);
                }
            });

            unsubscribeIdleRef.current = unsubscribe || null;
        } else {
            // Stop monitoring when timer is not active
            if (window.electronAPI) {
                window.electronAPI.stopIdleMonitoring();
            }
            if (unsubscribeIdleRef.current) {
                unsubscribeIdleRef.current();
                unsubscribeIdleRef.current = null;
            }
        }

        return () => {
            if (unsubscribeIdleRef.current) {
                unsubscribeIdleRef.current();
                unsubscribeIdleRef.current = null;
            }
        };
    }, [currentLogId]);

    // Elapsed interval
    useEffect(() => {
        if (!timerStartAtRef.current || currentLogId === null) return;
        const id = window.setInterval(() => {
            if (!timerStartAtRef.current) return;
            const diff = Math.floor((Date.now() - timerStartAtRef.current) / 1000);
            setElapsedSeconds(diff > 0 ? diff : 0);
        }, 1000);
        return () => clearInterval(id);
    }, [currentLogId]);

    // Start timer
    const handleStartTimer = async () => {
        if (!selectedTeamId || selectedTaskId === '') {
            alert('Please select a team and a task before starting the timer.');
            return;
        }

        // Check for offline mode
        if (!offlineManager.getOnlineStatus()) {
            try {
                const task = tasks.find((t: any) => t.id === Number(selectedTaskId));
                const taskName = task ? task.name : 'Unknown Task';

                const tempId = await offlineManager.startOfflineTimer({
                    task_template_id: Number(selectedTaskId),
                    task_name: taskName
                });

                setCurrentLogId(tempId);
                timerStartAtRef.current = Date.now();
                setElapsedSeconds(0);
                setIdleSeconds(0);

                await fetchRecentLogs();
                alert('Timer started (Offline Mode).');
            } catch (err) {
                console.error('Error starting offline timer', err);
                alert('Failed to start timer in offline mode.');
            }
            return;
        }

        try {
            setIsStarting(true);
            const res = await apiFetch('/api/time-logs/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_template_id: selectedTaskId }),
            });
            if (!res.ok) {
                let msg = 'Failed to start timer.';
                try {
                    const err = await res.json();
                    if (err?.error) msg += ' ' + err.error;
                } catch { }
                alert(msg);
                return;
            }
            const data = await res.json();
            setCurrentLogId(data.log.id);
            const startedAtMs = new Date(data.log.started_at).getTime();
            timerStartAtRef.current = startedAtMs;
            const diff = Math.floor((Date.now() - startedAtMs) / 1000);
            setElapsedSeconds(diff > 0 ? diff : 0);
            setIdleSeconds(0);
            await fetchRecentLogs();
        } catch (err) {
            console.error('Error starting timer', err);
            alert('Error starting timer. Check console.');
        } finally {
            setIsStarting(false);
        }
    };

    // Stop timer
    const handleStopTimer = async () => {
        if (!currentLogId) {
            alert('No active timer found.');
            return;
        }

        const volume = Number(volumeInput) || 0;
        const idle_seconds = idleSeconds;

        // Check for offline mode
        if (!offlineManager.getOnlineStatus()) {
            try {
                await offlineManager.stopOfflineTimer({
                    time_log_id: currentLogId,
                    volume,
                    idle_seconds
                });

                setCurrentLogId(null);
                setVolumeInput('');
                timerStartAtRef.current = null;
                setElapsedSeconds(0);
                setIdleSeconds(0);

                await fetchRecentLogs();
                alert('Timer stopped (Offline Mode). Changes will sync when online.');
            } catch (err) {
                console.error('Error stopping offline timer', err);
                alert('Failed to stop timer in offline mode.');
            }
            return;
        }

        try {
            setIsStopping(true);
            const res = await apiFetch('/api/time-logs/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ time_log_id: currentLogId, volume, idle_seconds }),
            });
            if (!res.ok) {
                let msg = 'Failed to stop timer.';
                try {
                    const err = await res.json();
                    if (err?.error) msg += ' ' + err.error;
                } catch { }
                alert(msg);
                return;
            }
            await res.json();
            setCurrentLogId(null);
            setVolumeInput('');
            timerStartAtRef.current = null;
            setElapsedSeconds(0);
            setIdleSeconds(0);
            await fetchRecentLogs();
        } catch (err) {
            console.error('Error stopping timer', err);
            alert('Error stopping timer. Check console.');
        } finally {
            setIsStopping(false);
        }
    };

    const idleMinutes = Math.floor(idleSeconds / 60);
    const isIdleNow = currentSystemIdle >= 60;
    const isTimerActive = currentLogId !== null;

    return {
        currentLogId,
        isStarting,
        isStopping,
        elapsedSeconds,
        idleSeconds,
        idleMinutes,
        currentSystemIdle,
        isIdleNow,
        isTimerActive,
        handleStartTimer,
        handleStopTimer,
        restoreActiveTimer,
    };
}
