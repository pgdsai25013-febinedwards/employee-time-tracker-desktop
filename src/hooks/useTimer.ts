import { useState, useEffect, useRef } from 'react';
import { offlineManager } from '../lib/offline-manager';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function useTimer(
    authToken: string | null,
    selectedTeamId: number | null,
    selectedTaskId: number | string,
    volumeInput: string,
    setVolumeInput: (value: string) => void,
    setSelectedTaskId: (id: number | '') => void,
    fetchRecentLogs: () => Promise<void>,
    tasks: any[] = []
) {
    const [currentLogId, setCurrentLogId] = useState<number | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [idleSeconds, setIdleSeconds] = useState(0);
    const [currentSystemIdle, setCurrentSystemIdle] = useState(0);
    const [instanceId, setInstanceId] = useState<string | null>(null);

    const timerStartAtRef = useRef<number | null>(null);
    const unsubscribeIdleRef = useRef<(() => void) | null>(null);
    const unsubscribeIdleEventRef = useRef<(() => void) | null>(null);
    const accumulatedIdleRef = useRef(0);
    const lastSystemIdleRef = useRef(0);
    const ignoreNextSoftIdleResetRef = useRef(false);
    const currentLogIdRef = useRef<number | null>(null);

    const getIdleStorageKey = (logId: number) => `ett_idle_${logId}`;

    const persistIdleState = (value?: number) => {
        const logId = currentLogIdRef.current;
        if (!logId) return;
        const key = getIdleStorageKey(logId);
        const toStore = typeof value === 'number' ? value : accumulatedIdleRef.current;
        localStorage.setItem(key, String(toStore));
    };

    const clearIdleState = (logId?: number) => {
        const target = logId ?? currentLogIdRef.current;
        if (!target) return;
        localStorage.removeItem(getIdleStorageKey(target));
    };

    const loadIdleState = (logId: number, fallback: number) => {
        const stored = localStorage.getItem(getIdleStorageKey(logId));
        if (stored == null) return fallback;
        const parsed = Number(stored);
        if (!Number.isFinite(parsed) || parsed < 0) return fallback;
        return parsed;
    };

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

    // Keep ref in sync for persistence helpers
    useEffect(() => {
        currentLogIdRef.current = currentLogId;
    }, [currentLogId]);

    // Notify main process once renderer mounted
    useEffect(() => {
        window.electronAPI?.rendererReady?.();
    }, []);

    // Restore active timer
    const restoreActiveTimer = async () => {
        if (!authToken) return; // Don't fetch if not authenticated

        try {
            const res = await apiFetch('/api/time-logs/recent?days=30');
            if (!res.ok) return;
            const data = await res.json();
            const active = data.find((l: any) => l.ended_at === null);
            if (!active) return;
            setCurrentLogId(active.id);
            currentLogIdRef.current = active.id;

            // Restore selected task ID if available
            if (active.task_template_id) {
                console.log('🔄 Restoring task ID:', active.task_template_id);
                setSelectedTaskId(active.task_template_id);
            }

            const startedAtMs = new Date(active.started_at).getTime();
            timerStartAtRef.current = startedAtMs;
            const diff = Math.floor((Date.now() - startedAtMs) / 1000);
            setElapsedSeconds(diff > 0 ? diff : 0);
            const restoredIdle = loadIdleState(active.id, active.idle_seconds ?? 0);
            setIdleSeconds(restoredIdle);
            accumulatedIdleRef.current = restoredIdle;
            persistIdleState(restoredIdle);

            // Start idle tracking for restored timer
            if (window.electronAPI?.timerStart) {
                await window.electronAPI.timerStart({ logId: active.id, taskId: active.task_template_id });
            }
        } catch (err) {
            console.error('Failed to restore active timer', err);
        }
    };

    // Reconcile timestamps on component mount (handle crash/shutdown recovery)
    useEffect(() => {
        if (!authToken) return; // Wait for auth token to be available

        const runReconciliation = async () => {
            // First, restore any active timer from backend
            await restoreActiveTimer();

            // Then run idle time reconciliation
            if (window.electronAPI?.timerReconcile) {
                console.log('🔍 Running timestamp reconciliation on mount...');
                const result = await window.electronAPI.timerReconcile();
                if (result?.gapDetected) {
                    console.log('⚠️ Gap detected during reconciliation:', result);
                    // Idle event will be sent via onIdleEvent listener
                }
            }

            // Get instance ID
            if (window.electronAPI?.timerGetInstanceId) {
                const { instanceId: id } = await window.electronAPI.timerGetInstanceId();
                setInstanceId(id);
                console.log('📱 Instance ID:', id);
            }
        };

        runReconciliation();
    }, [authToken]);

    // Subscribe to idle events from main process (Hard Idle: Lock, Sleep, Shutdown)
    useEffect(() => {
        if (!window.electronAPI?.onIdleEvent) return;

        const unsubscribe = window.electronAPI.onIdleEvent(async (idleEvent: any) => {
            console.log('🚨 Idle event received:', idleEvent);

            const { idleSeconds: idle, source, clockTampering } = idleEvent;
            const minutes = Math.floor(idle / 60);
            const seconds = idle % 60;

            // If this idle event is for a gap > 60s, we accumulate it
            if (idle >= 60) {
                let message = `You were away for ${minutes}m ${seconds}s`;
                if (source === 'lock') message = `System was locked for ${minutes}m ${seconds}s`;
                else if (source === 'suspend') message = `System went to sleep for ${minutes}m ${seconds}s`;
                else if (source === 'shutdown') message = `System was off for ${minutes}m ${seconds}s`;

                if (clockTampering) {
                    message += ' ⚠️ Clock tampering detected!';
                }

                // Notify user but KEEP TIMER RUNNING
                alert(`${message}\n\nThis time has been added to your idle time.`);

                // Accumulate idle time
                accumulatedIdleRef.current += idle;
                setIdleSeconds(accumulatedIdleRef.current);
                persistIdleState();

                // Prevent soft idle from double counting this event
                ignoreNextSoftIdleResetRef.current = true;
                setTimeout(() => {
                    ignoreNextSoftIdleResetRef.current = false;
                }, 2000);

                // Refresh logs to ensure backend is in sync (optional, but good for UI)
                await fetchRecentLogs();
            } else {
                // For short gaps < 60s, just update idle time but keep timer running
                console.log(`✅ Short idle period (${idle}s), timer continues`);
                // For short gaps from IdleManager (which shouldn't happen for <60s), we accumulate
                accumulatedIdleRef.current += idle;
                setIdleSeconds(accumulatedIdleRef.current);
            }
        });

        unsubscribeIdleEventRef.current = unsubscribe;

        return () => {
            if (unsubscribeIdleEventRef.current) {
                unsubscribeIdleEventRef.current();
                unsubscribeIdleEventRef.current = null;
            }
        };
    }, [fetchRecentLogs, setVolumeInput]);

    // Electron idle monitoring (Soft Idle: Mouse/Keyboard Inactivity)
    useEffect(() => {
        if (currentLogId !== null) {
            // Start monitoring when timer is active
            if (window.electronAPI) {
                window.electronAPI.startIdleMonitoring();
            }

            const unsubscribe = window.electronAPI?.onIdleTimeUpdate((systemIdleSeconds: number) => {
                const IDLE_THRESHOLD = 60;

                // Detect reset (User came back)
                if (systemIdleSeconds < lastSystemIdleRef.current) {
                    // Was the previous idle session valid?
                    if (lastSystemIdleRef.current >= IDLE_THRESHOLD) {
                        if (!ignoreNextSoftIdleResetRef.current) {
                            console.log(`👤 User returned. Accumulating soft idle: ${lastSystemIdleRef.current}s`);
                            accumulatedIdleRef.current += lastSystemIdleRef.current;
                            persistIdleState();
                        } else {
                            console.log('🛡️ Ignoring soft idle reset (covered by hard idle event)');
                        }
                    }
                }
                lastSystemIdleRef.current = systemIdleSeconds;

                setCurrentSystemIdle(systemIdleSeconds);

                // Calculate total idle = accumulated (hard events + past soft idle) + current (soft idle)
                let currentSoftIdle = 0;
                if (systemIdleSeconds >= IDLE_THRESHOLD) {
                    currentSoftIdle = systemIdleSeconds;
                }

                setIdleSeconds(accumulatedIdleRef.current + currentSoftIdle);
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

    // Window focus listener - restore active timer when returning from lock screen
    useEffect(() => {
        const handleFocus = async () => {
            if (!authToken) return; // Don't check if not authenticated

            console.log('🔍 Window focused - checking for active timer...');
            // Check if we have a timer in UI
            if (!currentLogId) {
                // No timer in UI, check backend for active timer
                await restoreActiveTimer();
            }
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, [currentLogId, authToken]);

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
                currentLogIdRef.current = tempId;
                timerStartAtRef.current = Date.now();
                setElapsedSeconds(0);
                setIdleSeconds(0);
                accumulatedIdleRef.current = 0;
                localStorage.setItem(getIdleStorageKey(tempId), '0');

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

            // Check work location (VPN detection)
            let workLocation = 'unknown';
            console.log('🔍 Checking VPN status...');
            console.log('window.electronAPI available:', !!window.electronAPI);

            if (window.electronAPI) {
                try {
                    const isVpnConnected = await window.electronAPI.checkVpnStatus();
                    console.log('VPN detected:', isVpnConnected);
                    workLocation = isVpnConnected ? 'wfh' : 'office';
                    console.log('Work location set to:', workLocation);
                } catch (error) {
                    console.error('Error checking VPN status:', error);
                }
            } else {
                console.warn('electronAPI not available - work location will be unknown');
            }

            const res = await apiFetch('/api/time-logs/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_template_id: selectedTaskId,
                    work_location: workLocation,
                    instance_id: instanceId // Include instance ID for backend validation
                }),
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
            currentLogIdRef.current = data.log.id;
            const startedAtMs = new Date(data.log.started_at).getTime();
            timerStartAtRef.current = startedAtMs;
            const diff = Math.floor((Date.now() - startedAtMs) / 1000);
            setElapsedSeconds(diff > 0 ? diff : 0);
            setIdleSeconds(0);
            accumulatedIdleRef.current = 0;
            localStorage.setItem(getIdleStorageKey(data.log.id), '0');

            // Start idle tracking in Electron
            if (window.electronAPI?.timerStart) {
                await window.electronAPI.timerStart({
                    logId: data.log.id,
                    taskId: selectedTaskId
                });
                console.log('✅ Idle tracking started for log:', data.log.id);
            }

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

        // Validation Logic
        const currentTask = tasks.find((t: any) => t.id === Number(selectedTaskId));
        if (currentTask) {
            const categoryName = (currentTask.category_name || '').toLowerCase();
            const isCore = categoryName === 'core';
            const isNonCoreOrUnproductive = categoryName === 'non-core' || categoryName === 'unproductive';

            if (isCore && volume <= 0) {
                alert('Volume is required for Core tasks. Please enter the volume processed.');
                return;
            }

            if (isNonCoreOrUnproductive && volume > 0) {
                alert(`Volume should not be entered for ${currentTask.category_name} tasks. Please remove the volume.`);
                return;
            }
        }

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
                setSelectedTaskId(''); // Clear task selection
                timerStartAtRef.current = null;
                setElapsedSeconds(0);
                setIdleSeconds(0);
                clearIdleState(currentLogId);

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

            // Stop idle tracking in Electron
            if (window.electronAPI?.timerStop) {
                await window.electronAPI.timerStop(currentLogId);
                console.log('✅ Idle tracking stopped for log:', currentLogId);
            }

            setCurrentLogId(null);
            setVolumeInput('');
            setSelectedTaskId(''); // Clear task selection
            timerStartAtRef.current = null;
            setElapsedSeconds(0);
            setIdleSeconds(0);
            clearIdleState(currentLogId);
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
