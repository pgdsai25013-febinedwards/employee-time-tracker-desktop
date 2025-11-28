import { useState, useEffect } from 'react';
import { db } from '../lib/indexed-db';
import { offlineManager } from '../lib/offline-manager';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function useTimeLogs(
    authToken: string | null,
    tasks: any[]
) {
    const [dayGroups, setDayGroups] = useState<any[]>([]);
    const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
    const [editingLog, setEditingLog] = useState<any | null>(null);
    const [editDate, setEditDate] = useState('');
    const [editTaskId, setEditTaskId] = useState<number | ''>('');
    const [editVolume, setEditVolume] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

    // Week navigation state (0 = current week, 1 = previous week, etc.)
    const [weekOffset, setWeekOffset] = useState(0);

    // Helper to get date range for a given week offset (calendar weeks: Monday-Sunday)
    const getWeekRange = (offset: number) => {
        const today = new Date();

        // Get current day of week (0 = Sunday, 1 = Monday, ... 6 = Saturday)
        const currentDay = today.getDay();

        // Calculate days since Monday (Monday = 0, Sunday = 6)
        const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;

        // Get this week's Monday
        const thisMonday = new Date(today);
        thisMonday.setDate(today.getDate() - daysSinceMonday);
        thisMonday.setHours(0, 0, 0, 0);

        // Calculate the Monday for the offset week
        const targetMonday = new Date(thisMonday);
        targetMonday.setDate(thisMonday.getDate() - (offset * 7));

        // Calculate the Sunday for the offset week
        const targetSunday = new Date(targetMonday);
        targetSunday.setDate(targetMonday.getDate() + 6);

        const formatDate = (d: Date) => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        // For current week (offset 0), end date is today
        // For past weeks, end date is Sunday
        const endDate = offset === 0 ? today : targetSunday;

        return {
            from: formatDate(targetMonday),
            to: formatDate(endDate)
        };
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

    // Fetch recent logs
    async function fetchRecentLogs() {
        const { from, to } = getWeekRange(weekOffset);
        let serverLogs: any[] = [];

        // 1. Try to fetch from server if online
        if (offlineManager.getOnlineStatus()) {
            try {
                // Try filter endpoint first (might not exist)
                let res = await apiFetch(`/api/time-logs/filter?from=${from}&to=${to}`);

                // If filter endpoint doesn't exist (404), fall back to recent endpoint
                if (res.status === 404) {
                    console.log('Filter endpoint not found, falling back to recent endpoint');
                    // Calculate days to fetch - need enough to cover the week we're viewing
                    const targetMonday = new Date(from + 'T00:00:00');
                    const daysSinceTargetMonday = Math.ceil((new Date().getTime() - targetMonday.getTime()) / (1000 * 60 * 60 * 24));
                    const daysToFetch = Math.max(7, daysSinceTargetMonday + 1);

                    console.log(`Fetching ${daysToFetch} days from recent endpoint for week ${from} to ${to}`);
                    res = await apiFetch(`/api/time-logs/recent?days=${daysToFetch}`);
                }

                if (res.ok) {
                    serverLogs = await res.json();
                    console.log(`Fetched ${serverLogs.length} logs from server`);

                    // Filter server logs to only include those in current date range
                    // Use string comparison for YYYY-MM-DD dates (more reliable than Date objects)
                    serverLogs = serverLogs.filter((log: any) => {
                        // Extract just the date part (YYYY-MM-DD)
                        const logDate = log.work_date ? log.work_date.split('T')[0] : log.work_date;
                        const inRange = logDate >= from && logDate <= to;
                        return inRange;
                    });

                    console.log(`After filtering: ${serverLogs.length} logs in range ${from} to ${to}`);
                }
            } catch (err) {
                console.error('Failed to fetch recent logs from server', err);
            }
        }

        // 2. Get local cached logs
        const localLogs = await db.getCachedLogs();

        // 3. Merge logs
        const mergedLogs = [...serverLogs];
        const serverLogMap = new Map(serverLogs.map(l => [l.id, l]));

        for (const local of localLogs) {
            // Filter local logs to only include those in the current date range
            const localDate = local.work_date ? local.work_date.split('T')[0] : local.work_date;

            if (localDate >= from && localDate <= to) {
                if (serverLogMap.has(local.id)) {
                    // Update existing server log with local version (e.g. stopped offline)
                    const index = mergedLogs.findIndex(l => l.id === local.id);
                    if (index !== -1) {
                        mergedLogs[index] = local;
                    }
                } else {
                    // Add new local log (e.g. started offline)
                    mergedLogs.push(local);
                }
            }
        }

        try {
            const byDate = new Map<string, any[]>();
            for (const log of mergedLogs) {
                let dateKey = '';
                try {
                    const d = new Date(log.work_date);
                    if (!isNaN(d.getTime())) {
                        const yyyy = d.getFullYear();
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        dateKey = `${yyyy}-${mm}-${dd}`;
                    } else {
                        continue;
                    }
                } catch {
                    continue;
                }

                const started = log.started_at ? new Date(log.started_at) : null;
                const ended = log.ended_at ? new Date(log.ended_at) : null;
                const startLabel = started
                    ? started.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
                    : '--:--';
                const endLabel = ended
                    ? ended.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
                    : '--:--';
                const durationSeconds = log.duration_seconds ?? 0;
                const durationMinutes = Math.max(0, Math.round(durationSeconds / 60));
                const idleSecondsVal = log.idle_seconds ?? 0;
                const idleMinutes = Math.max(0, Math.round(idleSecondsVal / 60));
                const volume = log.volume ?? 0;
                const taskName = log.task_templates?.name ?? 'Unknown';
                const taskTemplateId = log.task_templates?.id ?? log.task_template_id ?? null;
                const categoryName = log.task_templates?.category_name;
                const workLocation = log.work_location ?? 'unknown';

                // Debug: Log work location for first few entries
                if (mergedLogs.indexOf(log) < 3) {
                    console.log(`Log ${log.id}: work_location from API = "${log.work_location}", mapped to "${workLocation}"`);
                }

                const item = {
                    id: log.id,
                    workDate: log.work_date,
                    taskTemplateId,
                    taskName,
                    categoryName,
                    start: startLabel,
                    end: endLabel,
                    idleMinutes,
                    durationMinutes,
                    volume,
                    workLocation,
                };
                if (!byDate.has(dateKey)) byDate.set(dateKey, []);
                byDate.get(dateKey)!.push(item);
            }
            const grouped = Array.from(byDate.entries())
                .map(([date, logs]) => ({ date, logs }))
                .sort((a, b) => (a.date < b.date ? 1 : -1));
            setDayGroups(grouped);
        } catch (err) {
            console.error('Failed to process time logs', err);
        }
    }

    // Edit log handlers
    const openEditLog = (log: any) => {
        setEditingLog(log);
        try {
            const d = new Date(log.workDate);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            setEditDate(`${yyyy}-${mm}-${dd}`);
        } catch {
            setEditDate('');
        }
        setEditVolume(String(log.volume ?? ''));
        setEditTaskId(log.taskTemplateId ?? '');
    };

    const cancelEdit = () => {
        setEditingLog(null);
        setEditDate('');
        setEditTaskId('');
        setEditVolume('');
    };

    const saveEdit = async () => {
        if (!editingLog) return;
        if (!editDate) {
            alert('Please select a date.');
            return;
        }
        if (editTaskId === '') {
            alert('Please select a task.');
            return;
        }
        try {
            setIsSavingEdit(true);
            const body: any = { work_date: editDate, task_template_id: editTaskId, volume: Number(editVolume) || 0 };
            const res = await apiFetch(`/api/time-logs/${editingLog.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                let msg = 'Failed to update log.';
                try {
                    const err = await res.json();
                    if (err?.error) msg += ' ' + err.error;
                } catch { }
                alert(msg);
                return;
            }
            await fetchRecentLogs();
            cancelEdit();
        } catch (err) {
            console.error('Error updating log', err);
            alert('Error updating log. Check console.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    // Delete log
    const deleteLog = async (log: any) => {
        const confirmDelete = window.confirm(`Delete this log for ${log.taskName} on ${log.workDate}?`);
        if (!confirmDelete) return;
        try {
            setIsDeletingId(log.id);
            const res = await apiFetch(`/api/time-logs/${log.id}`, { method: 'DELETE' });
            if (!res.ok) {
                let msg = 'Failed to delete log.';
                try {
                    const err = await res.json();
                    if (err?.error) msg += ' ' + err.error;
                } catch { }
                alert(msg);
                return;
            }
            await fetchRecentLogs();
            if (editingLog && editingLog.id === log.id) cancelEdit();
        } catch (err) {
            console.error('Error deleting log', err);
            alert('Error deleting log. Check console.');
        } finally {
            setIsDeletingId(null);
        }
    };

    // Toggle day collapse
    const toggleDay = (date: string) => {
        setOpenDays((prev) => ({
            ...prev,
            [date]: !prev[date],
        }));
    };

    // CSV export
    const handleDownloadCSV = async (historyFrom: string, historyTo: string) => {
        if (!historyFrom || !historyTo) {
            alert('Please select both From and To dates.');
            return;
        }
        try {
            const res = await apiFetch(`/api/time-logs/export?from=${historyFrom}&to=${historyTo}`);
            if (!res.ok) {
                let msg = 'Failed to download CSV.';
                try {
                    const err = await res.json();
                    if (err?.error) msg += ` ${err.error}`;
                } catch { }
                alert(msg);
                return;
            }
            const csvText = await res.text();
            const blob = new Blob([csvText], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'time-logs-export.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading CSV', err);
            alert('Error downloading CSV. Check console.');
        }
    };

    // Week navigation functions
    const goNextPage = async () => {
        // Go forward toward current week (decrease offset)
        if (weekOffset > 0) {
            setWeekOffset(prev => prev - 1);
        }
    };

    const goPrevPage = async () => {
        // Go back to older week (increase offset)
        setWeekOffset(prev => prev + 1);
    };

    // Refetch logs when week changes
    useEffect(() => {
        if (authToken) {
            fetchRecentLogs();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weekOffset, authToken]);

    // Calculate current week range for display
    const currentRange = getWeekRange(weekOffset);
    const formatDateDisplay = (dateStr: string) => {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };
    const weekRange = `${formatDateDisplay(currentRange.from)} - ${formatDateDisplay(currentRange.to)}`;

    return {
        dayGroups,
        openDays,
        editingLog,
        editDate,
        setEditDate,
        editTaskId,
        setEditTaskId,
        editVolume,
        setEditVolume,
        isSavingEdit,
        isDeletingId,
        fetchRecentLogs,
        openEditLog,
        cancelEdit,
        saveEdit,
        deleteLog,
        toggleDay,
        handleDownloadCSV,
        pageIndex: weekOffset,
        hasMore: true, // Can always go further back in time
        goNextPage,
        goPrevPage,
        weekRange,
    };
}
