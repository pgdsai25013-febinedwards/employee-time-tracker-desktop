import { useState } from 'react';

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
    async function fetchRecentLogs(days = 3) {
        try {
            const res = await apiFetch(`/api/time-logs/recent?days=${days}`);
            if (!res.ok) {
                console.error('Failed to fetch recent logs', res.status);
                return;
            }
            const data = await res.json();
            const byDate = new Map<string, any[]>();
            for (const log of data) {
                let dateKey = '';
                try {
                    const d = new Date(log.work_date);
                    if (!isNaN(d.getTime())) {
                        const yyyy = d.getFullYear();
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const dd = String(d.getDate()).padStart(2, '0');
                        dateKey = `${yyyy}-${mm}-${dd}`;
                    } else {
                        console.warn('Invalid work_date from backend:', log.work_date);
                        continue;
                    }
                } catch {
                    console.warn('Failed to parse work_date:', log.work_date);
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
                const item = {
                    id: log.id,
                    workDate: log.work_date,
                    taskTemplateId,
                    taskName,
                    start: startLabel,
                    end: endLabel,
                    idleMinutes,
                    durationMinutes,
                    volume,
                };
                if (!byDate.has(dateKey)) byDate.set(dateKey, []);
                byDate.get(dateKey)!.push(item);
            }
            const grouped = Array.from(byDate.entries())
                .map(([date, logs]) => ({ date, logs }))
                .sort((a, b) => (a.date < b.date ? 1 : -1));
            setDayGroups(grouped);
        } catch (err) {
            console.error('Failed to load recent time logs', err);
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
    };
}
