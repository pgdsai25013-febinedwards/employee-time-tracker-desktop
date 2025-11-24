// src/App.tsx - Electron version with system-wide idle detection, offline support, and smart notifications
import React, { useEffect, useState, useRef } from "react";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { DatePicker } from "./components/ui/date-picker";
import { Input } from "./components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import {
    ChevronLeft,
    ChevronRight,
    LogOut,
    Moon,
    Sun,
    Trash2,
    Edit,
    Wifi,
    WifiOff,
} from "lucide-react";
import { offlineManager } from "./lib/offline-manager";
import { NotificationSettings } from "./components/NotificationSettings";

/* ---------------- Types ---------------- */
type AuthUser = {
    id: number;
    full_name: string;
    email: string;
    role: string;
    team_id: number | null;
    avatar_url?: string | null;
};

type Team = { id: number; name: string };
type Task = { id: number; team_id: number; name: string };
type TabId = "tracker" | "dashboard" | "history" | "profile";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

declare global {
    interface Window {
        google?: any;
    }
}

/* ---------------- Formatters ---------------- */
const formatDateLabel = (isoDate: string) => {
    const d = new Date(isoDate + "T00:00:00");
    return d.toLocaleDateString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
    });
};

const formatElapsed = (totalSeconds: number) => {
    if (totalSeconds <= 0) return "00:00";
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
        return `${hrs.toString().padStart(2, "0")}:${mins
            .toString()
            .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

/* ---------------- App ---------------- */
const App: React.FC = () => {
    // Auth
    const [authUser, setAuthUser] = useState<AuthUser | null>(null);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    // UI
    const [activeTab, setActiveTab] = useState<TabId>("tracker");
    const [theme, setTheme] = useState<"dark" | "light">("dark");

    // Teams & tasks
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedTaskId, setSelectedTaskId] = useState<number | "">("");

    // Timer & logs state
    const [volumeInput, setVolumeInput] = useState<string>("");
    const [currentLogId, setCurrentLogId] = useState<number | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const [dayGroups, setDayGroups] = useState<any[]>([]);
    const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

    // Edit
    const [editingLog, setEditingLog] = useState<any | null>(null);
    const [editDate, setEditDate] = useState("");
    const [editTaskId, setEditTaskId] = useState<number | "">("");
    const [editVolume, setEditVolume] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [isDeletingId, setIsDeletingId] = useState<number | null>(null);

    // ========== ELECTRON IDLE DETECTION (System-Wide) ==========
    const [idleSeconds, setIdleSeconds] = useState(0); // Total accumulated idle time
    const [currentSystemIdle, setCurrentSystemIdle] = useState(0); // Current system idle state
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const timerStartAtRef = useRef<number | null>(null);
    const unsubscribeIdleRef = useRef<(() => void) | null>(null);

    // ========== OFFLINE SUPPORT ==========
    const [isOnline, setIsOnline] = useState(true);
    const [queuedOpsCount, setQueuedOpsCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    // Misc
    const [historyFrom, setHistoryFrom] = useState("");
    const [historyTo, setHistoryTo] = useState("");
    const [lockYear, setLockYear] = useState("");
    const [lockMonth, setLockMonth] = useState("");
    const [lockStatus] = useState<string | null>(null);

    // Load session from localStorage
    useEffect(() => {
        const token = localStorage.getItem("ett_token");
        const userStr = localStorage.getItem("ett_user");
        if (token && userStr) {
            try {
                const u = JSON.parse(userStr) as AuthUser;
                setAuthToken(token);
                setAuthUser(u);
            } catch {
                localStorage.removeItem("ett_token");
                localStorage.removeItem("ett_user");
            }
        }
        setIsAuthReady(true);
    }, []);

    // Apply theme class to <html>
    useEffect(() => {
        const root = document.documentElement;
        if (theme === "dark") root.classList.add("dark");
        else root.classList.remove("dark");
    }, [theme]);

    // ========== OFFLINE MANAGER INTEGRATION ==========
    useEffect(() => {
        // Set auth token for offline manager
        offlineManager.setAuthToken(authToken);

        // Track online/offline status
        const checkStatus = () => {
            setIsOnline(offlineManager.getOnlineStatus());
        };

        checkStatus();
        const interval = setInterval(checkStatus, 2000);

        // Set up sync callback
        offlineManager.onSync(async () => {
            setIsSyncing(false);
            await fetchRecentLogs();
        });

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authToken]);

    // Track online status changes for sync
    useEffect(() => {
        if (isOnline) {
            setIsSyncing(true);
            offlineManager.syncQueue().finally(() => setIsSyncing(false));
        }
    }, [isOnline]);

    // ========== NOTIFICATION INTEGRATION ==========
    useEffect(() => {
        if (!window.electronAPI) return;

        // Listen for daily stats requests from Electron
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

    // API fetch helper
    async function apiFetch(input: string, init: RequestInit = {}) {
        const headers = new Headers(init.headers || {});
        if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
        const response = await fetch(`${API_BASE}${input}`, {
            ...init,
            headers,
        });
        if (response.status === 401) {
            setTimeout(() => {
                localStorage.removeItem("ett_token");
                localStorage.removeItem("ett_user");
                setAuthToken(null);
                setAuthUser(null);
            }, 10);
        }
        return response;
    }

    // Logout
    const handleLogout = () => {
        localStorage.removeItem("ett_token");
        localStorage.removeItem("ett_user");
        setAuthToken(null);
        setAuthUser(null);
        setSelectedTeamId(null);
        setTasks([]);
    };

    // Google authentication
    const handleGoogleCredential = async (credential: string) => {
        try {
            const res = await fetch(`${API_BASE}/api/auth/google`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken: credential }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => null);
                alert("Login failed: " + (err?.error || "Unknown error"));
                return;
            }

            const data = await res.json();
            setAuthToken(data.token);
            setAuthUser(data.user);
            localStorage.setItem("ett_token", data.token);
            localStorage.setItem("ett_user", JSON.stringify(data.user));
            setTimeout(() => loadTeams(), 10);
        } catch (e) {
            console.error("Google login error", e);
            alert("Login failed. Check console.");
        }
    };

    // Initialize Google Sign-In
    useEffect(() => {
        if (authUser) return;
        const interval = setInterval(() => {
            if (window.google && window.google.accounts && window.google.accounts.id) {
                clearInterval(interval);
                try {
                    window.google.accounts.id.initialize({
                        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                        callback: (response: any) => handleGoogleCredential(response.credential),
                    });
                    window.google.accounts.id.renderButton(
                        document.getElementById("google-signin-button"),
                        { theme: "outline", size: "large", width: 320 }
                    );
                } catch (err) {
                    console.error("GSI init error:", err);
                }
            }
        }, 250);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authUser]);

    // Load teams
    const loadTeams = async () => {
        if (!authToken) return;
        try {
            const res = await apiFetch("/api/teams");
            if (!res.ok) {
                console.error("Failed to fetch teams", res.status);
                return;
            }
            const data = await res.json();
            setTeams(data);
            if (data.length > 0 && selectedTeamId == null) {
                if (authUser?.team_id) setSelectedTeamId(authUser.team_id);
                else setSelectedTeamId(data[0].id);
            }
        } catch (err) {
            console.error("Failed to load teams", err);
        }
    };

    useEffect(() => {
        if (authUser && authToken) loadTeams();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authUser, authToken]);

    // Load tasks when team changes
    useEffect(() => {
        const fetchTasks = async () => {
            if (!selectedTeamId) {
                setTasks([]);
                setSelectedTaskId("");
                return;
            }
            try {
                const res = await apiFetch(`/api/tasks?team_id=${selectedTeamId}`);
                if (!res.ok) {
                    console.error("Failed to fetch tasks", res.status);
                    setTasks([]);
                    return;
                }
                const data = await res.json();
                setTasks(data);
                setSelectedTaskId("");
            } catch (err) {
                console.error("Failed to load tasks", err);
                setTasks([]);
            }
        };
        fetchTasks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTeamId]);

    // Fetch recent logs
    async function fetchRecentLogs(days = 3) {
        try {
            const res = await apiFetch(`/api/time-logs/recent?days=${days}`);
            if (!res.ok) {
                console.error("Failed to fetch recent logs", res.status);
                return;
            }
            const data = await res.json();
            const byDate = new Map<string, any[]>();
            for (const log of data) {
                let dateKey = "";
                try {
                    const d = new Date(log.work_date);
                    if (!isNaN(d.getTime())) {
                        const yyyy = d.getFullYear();
                        const mm = String(d.getMonth() + 1).padStart(2, "0");
                        const dd = String(d.getDate()).padStart(2, "0");
                        dateKey = `${yyyy}-${mm}-${dd}`;
                    } else {
                        console.warn("Invalid work_date from backend:", log.work_date);
                        continue;
                    }
                } catch {
                    console.warn("Failed to parse work_date:", log.work_date);
                    continue;
                }

                const started = log.started_at ? new Date(log.started_at) : null;
                const ended = log.ended_at ? new Date(log.ended_at) : null;
                const startLabel = started
                    ? started.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
                    : "--:--";
                const endLabel = ended
                    ? ended.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
                    : "--:--";
                const durationSeconds = log.duration_seconds ?? 0;
                const durationMinutes = Math.max(0, Math.round(durationSeconds / 60));
                const idleSecondsVal = log.idle_seconds ?? 0;
                const idleMinutes = Math.max(0, Math.round(idleSecondsVal / 60));
                const volume = log.volume ?? 0;
                const taskName = log.task_templates?.name ?? "Unknown";
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
            console.error("Failed to load recent time logs", err);
        }
    }

    // Restore active timer
    const restoreActiveTimer = async () => {
        try {
            const res = await apiFetch("/api/time-logs/recent?days=1");
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
            console.error("Failed to restore active timer", err);
        }
    };

    // Fetch logs + restore timer after auth
    useEffect(() => {
        if (!authUser) return;
        fetchRecentLogs();
        restoreActiveTimer();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authUser]);

    // ========== ELECTRON SYSTEM-WIDE IDLE DETECTION ==========
    useEffect(() => {
        const isTimerActive = currentLogId !== null;

        if (isTimerActive && window.electronAPI) {
            // Start monitoring system idle time
            window.electronAPI.startIdleMonitoring();

            // Listen for idle time updates from Electron main process
            const unsubscribe = window.electronAPI.onIdleTimeUpdate((systemIdleSeconds) => {
                // Update current system idle state (for badge display)
                setCurrentSystemIdle(systemIdleSeconds);

                // System idle time is how long the OS has been idle
                // If user is idle for more than 60 seconds, accumulate idle time
                const IDLE_THRESHOLD = 60;

                if (systemIdleSeconds >= IDLE_THRESHOLD) {
                    // User is idle - accumulate idle time
                    setIdleSeconds(systemIdleSeconds);
                } else {
                    // User is active - don't reset accumulated idle, keep it for when we stop timer
                    // The badge will show ACTIVE because currentSystemIdle < 60
                }
            });

            unsubscribeIdleRef.current = unsubscribe;
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
        if (!selectedTeamId || selectedTaskId === "") {
            alert("Please select a team and a task before starting the timer.");
            return;
        }
        try {
            setIsStarting(true);
            const res = await apiFetch("/api/time-logs/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ task_template_id: selectedTaskId }),
            });
            if (!res.ok) {
                let msg = "Failed to start timer.";
                try {
                    const err = await res.json();
                    if (err?.error) msg += " " + err.error;
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
            console.error("Error starting timer", err);
            alert("Error starting timer. Check console.");
        } finally {
            setIsStarting(false);
        }
    };

    // Stop timer
    const handleStopTimer = async () => {
        if (!currentLogId) {
            alert("No active timer found.");
            return;
        }
        try {
            setIsStopping(true);
            const volume = Number(volumeInput) || 0;
            const idle_seconds = idleSeconds;
            const res = await apiFetch("/api/time-logs/stop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ time_log_id: currentLogId, volume, idle_seconds }),
            });
            if (!res.ok) {
                let msg = "Failed to stop timer.";
                try {
                    const err = await res.json();
                    if (err?.error) msg += " " + err.error;
                } catch { }
                alert(msg);
                return;
            }
            await res.json();
            setCurrentLogId(null);
            setVolumeInput("");
            timerStartAtRef.current = null;
            setElapsedSeconds(0);
            setIdleSeconds(0);
            await fetchRecentLogs();
        } catch (err) {
            console.error("Error stopping timer", err);
            alert("Error stopping timer. Check console.");
        } finally {
            setIsStopping(false);
        }
    };

    // Edit / Delete handlers
    const openEditLog = (log: any) => {
        setEditingLog(log);
        try {
            const d = new Date(log.workDate);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            setEditDate(`${yyyy}-${mm}-${dd}`);
        } catch {
            setEditDate("");
        }
        setEditVolume(String(log.volume ?? ""));
        setEditTaskId(log.taskTemplateId ?? "");
    };

    const cancelEdit = () => {
        setEditingLog(null);
        setEditDate("");
        setEditTaskId("");
        setEditVolume("");
    };

    const saveEdit = async () => {
        if (!editingLog) return;
        if (!editDate) {
            alert("Please select a date.");
            return;
        }
        if (editTaskId === "") {
            alert("Please select a task.");
            return;
        }
        try {
            setIsSavingEdit(true);
            const body: any = { work_date: editDate, task_template_id: editTaskId, volume: Number(editVolume) || 0 };
            const res = await apiFetch(`/api/time-logs/${editingLog.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                let msg = "Failed to update log.";
                try {
                    const err = await res.json();
                    if (err?.error) msg += " " + err.error;
                } catch { }
                alert(msg);
                return;
            }
            await fetchRecentLogs();
            cancelEdit();
        } catch (err) {
            console.error("Error updating log", err);
            alert("Error updating log. Check console.");
        } finally {
            setIsSavingEdit(false);
        }
    };

    const deleteLog = async (log: any) => {
        const confirmDelete = window.confirm(`Delete this log for ${log.taskName} on ${log.workDate}?`);
        if (!confirmDelete) return;
        try {
            setIsDeletingId(log.id);
            const res = await apiFetch(`/api/time-logs/${log.id}`, { method: "DELETE" });
            if (!res.ok) {
                let msg = "Failed to delete log.";
                try {
                    const err = await res.json();
                    if (err?.error) msg += " " + err.error;
                } catch { }
                alert(msg);
                return;
            }
            await fetchRecentLogs();
            if (editingLog && editingLog.id === log.id) cancelEdit();
        } catch (err) {
            console.error("Error deleting log", err);
            alert("Error deleting log. Check console.");
        } finally {
            setIsDeletingId(null);
        }
    };

    const toggleDay = (date: string) => {
        setOpenDays((prev) => ({
            ...prev,
            [date]: !prev[date],
        }));
    };

    // CSV export
    const handleDownloadCSV = async () => {
        if (!historyFrom || !historyTo) {
            alert("Please select both From and To dates.");
            return;
        }
        try {
            const res = await apiFetch(`/api/time-logs/export?from=${historyFrom}&to=${historyTo}`);
            if (!res.ok) {
                let msg = "Failed to download CSV.";
                try {
                    const err = await res.json();
                    if (err?.error) msg += ` ${err.error}`;
                } catch { }
                alert(msg);
                return;
            }
            const csvText = await res.text();
            const blob = new Blob([csvText], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "time-logs-export.csv";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Error downloading CSV", err);
            alert("Error downloading CSV. Check console.");
        }
    };

    // Set team for user
    const setTeamForUser = async (teamId: number) => {
        try {
            const res = await apiFetch("/api/users/set-team", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: authUser?.id, team_id: teamId }),
            });
            if (!res.ok) {
                let msg = "Failed to set team.";
                try {
                    const err = await res.json();
                    if (err?.error) msg += ` ${err.error}`;
                } catch { }
                alert(msg);
                return;
            }
            const data = await res.json();
            const updatedUser = data.user;
            setAuthUser((prev) => (prev ? { ...prev, team_id: updatedUser.team_id } : prev));
            localStorage.setItem("ett_user", JSON.stringify({ ...authUser, team_id: updatedUser.team_id }));
            alert("Team saved to your profile.");
        } catch (err) {
            console.error("Error setting team", err);
            alert("Error setting team. Check console.");
        }
    };

    const idleMinutes = Math.floor(idleSeconds / 60);
    const isIdleNow = currentSystemIdle >= 60; // Status based on CURRENT system state
    const isTimerActive = currentLogId !== null;

    /* -------------------- RENDER -------------------- */
    if (!isAuthReady) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    if (!authUser) {
        // Login page
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
                <Card className="w-full max-w-md bg-slate-900/80 border-slate-800">
                    <CardHeader className="flex flex-col items-center gap-2 py-6">
                        <img src="/employee-time-tracker-icon.svg" alt="App Logo" className="h-12 w-12 rounded-full" />
                        <CardTitle className="text-lg text-center">Employee Time Tracker - Desktop</CardTitle>
                        <p className="text-[12px] text-slate-400 text-center max-w-xs">
                            Sign in with your Google account to start tracking time with system-wide idle detection.
                        </p>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-4 pb-8">
                        <div id="google-signin-button" className="w-full flex justify-center" />
                        <div className="text-[11px] text-slate-500 text-center max-w-xs">
                            We only use your name &amp; email to create your profile in this app.
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Main app UI
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
            <header className="w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                    <img src="/employee-time-tracker-icon.svg" alt="App Logo" className="h-8 w-8 rounded-full" />
                    <div>
                        <div className="text-sm font-semibold">Employee Time Tracker - Desktop</div>
                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                            <span>System-wide idle detection powered by Electron</span>
                            <Badge variant={isOnline ? "default" : "destructive"} className="text-[10px] flex items-center gap-1">
                                {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                {isOnline ? "Online" : "Offline"}
                            </Badge>
                            {isSyncing && (<Badge variant="secondary" className="text-[10px]"> Syncing...</Badge>)}
                            {isTimerActive && (
                                <>
                                    <Badge variant="secondary" className="text-[10px]">Timer #{currentLogId}  Elapsed {formatElapsed(elapsedSeconds)}</Badge>
                                    <Badge variant={isIdleNow ? "outline" : "secondary"} className={	ext-[10px] }>
                                        {isIdleNow ? "IDLE" : "ACTIVE"}  Idle {idleMinutes}m
                                    </Badge>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="border-slate-700 h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>
                    <div className="hidden sm:flex flex-col items-end mr-1">
                        <span className="text-xs font-medium">{authUser.full_name}</span>
                        <span className="text-[11px] text-slate-400">{authUser.email}</span>
                    </div>
                    <Button variant="outline" size="icon" className="border-slate-700 h-8 w-8" onClick={handleLogout}>
                        <LogOut className="h-4 w-4" />
                    </Button>
                </div>
            </header>
            <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
                        <TabsList className="bg-slate-900/80">
                    <TabsTrigger value="tracker">Tracker</TabsTrigger>
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                    <TabsTrigger value="history">History Tracker</TabsTrigger>
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                </TabsList >
            </Tabs >

    <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Team:</span>
        <select
            value={selectedTeamId ?? ""}
            onChange={(e) => {
                const next = Number(e.target.value);
                setSelectedTeamId(next || null);
                setSelectedTaskId("");
            }}
            className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs sm:text-sm"
        >
            <option value="">Select teamâ€¦</option>
            {teams.map((t) => (
                <option key={t.id} value={t.id}>
                    {t.name}
                </option>
            ))}
        </select>
    </div>
        </div >

    { activeTab === "tracker" && (
        <section className="space-y-3">
            <Card className="bg-slate-900/70 border-slate-800">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tracker â€“ record today's time &amp; volume</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div className="space-y-1">
                            <div className="text-xs text-slate-400">Task</div>
                            <select
                                value={selectedTaskId}
                                onChange={(e) => setSelectedTaskId(e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-2 text-xs sm:text-sm"
                                disabled={!selectedTeamId || isTimerActive}
                            >
                                <option value="">{selectedTeamId ? "Select taskâ€¦" : "Select a team firstâ€¦"}</option>
                                {tasks.map((task) => (
                                    <option key={task.id} value={task.id}>
                                        {task.name}
                                    </option>
                                ))}
                            </select>
                            <div className="text-[10px] text-slate-500">Task list based on the team you selected.</div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-xs text-slate-400">Volume (units processed)</div>
                            <Input
                                placeholder="e.g. 120"
                                value={volumeInput}
                                onChange={(e) => setVolumeInput(e.target.value)}
                                className="bg-slate-950 border-slate-700 text-xs sm:text-sm"
                            />
                            <div className="text-[10px] text-slate-500">Enter Volume</div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <Button
                                className="bg-emerald-500 hover:bg-emerald-600 text-xs sm:text-sm"
                                disabled={selectedTaskId === "" || !selectedTeamId || isStarting || isTimerActive}
                                onClick={handleStartTimer}
                            >
                                {isStarting ? "Startingâ€¦" : "Start timer"}
                            </Button>
                            <Button
                                variant="outline"
                                className="border-slate-700 text-xs sm:text-sm"
                                disabled={!isTimerActive || isStopping}
                                onClick={handleStopTimer}
                            >
                                {isStopping ? "Savingâ€¦" : "Stop & save"}
                            </Button>
                        </div>
                    </div>

                    <div className="text-[11px] text-slate-500">
                        <strong>System-wide idle detection:</strong> Idle time is calculated using OS-level APIs that track
                        your entire computer activity (keyboard, mouse, etc.), not just this app window. Final productive
                        time = Duration âˆ’ Idle.
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-slate-900/70 border-slate-800">
                <CardHeader className="flex items-center justify-between">
                    <CardTitle className="text-sm">Tasks recorded</CardTitle>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 border-slate-700"
                            onClick={() => alert("Paging not implemented in demo.")}
                        >
                            <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 border-slate-700"
                            onClick={() => alert("Paging not implemented in demo.")}
                        >
                            <ChevronRight className="h-3 w-3" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-2">
                    {dayGroups.length === 0 && (
                        <div className="text-xs text-slate-500">No logs recorded for the last 3 days yet.</div>
                    )}

                    {dayGroups.map((day) => {
                        const isOpen = openDays[day.date] ?? true;
                        const totalMinutes = day.logs.reduce((s: number, l: any) => s + l.durationMinutes, 0);
                        const totalVolume = day.logs.reduce((s: number, l: any) => s + (l.volume || 0), 0);
                        const totalIdle = day.logs.reduce((s: number, l: any) => s + l.idleMinutes, 0);
                        const totalProductive = Math.max(0, totalMinutes - totalIdle);
                        return (
                            <div key={day.date} className="border border-slate-800 rounded-md overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => toggleDay(day.date)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-900/80 hover:bg-slate-800/80 text-xs"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{formatDateLabel(day.date)}</span>
                                        <span className="text-[11px] text-slate-400">{day.logs.length} entries</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                                        <span>{totalMinutes} min</span>
                                        <span>Idle {totalIdle} min</span>
                                        <span>Final prod {totalProductive} min</span>
                                        <span>{totalVolume} units</span>
                                        <span>{isOpen ? "Hide" : "Show"}</span>
                                    </div>
                                </button>

                                {isOpen && (
                                    <div className="px-2 pb-2 bg-slate-950/60">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="text-xs">Task</TableHead>
                                                    <TableHead className="text-xs">Start</TableHead>
                                                    <TableHead className="text-xs">End</TableHead>
                                                    <TableHead className="text-xs text-right">Idle</TableHead>
                                                    <TableHead className="text-xs text-right">Duration</TableHead>
                                                    <TableHead className="text-xs text-right">Productive</TableHead>
                                                    <TableHead className="text-xs text-right">Volume</TableHead>
                                                    <TableHead className="text-xs text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {day.logs.map((log: any) => {
                                                    const productive = Math.max(0, log.durationMinutes - log.idleMinutes);
                                                    return (
                                                        <TableRow key={log.id}>
                                                            <TableCell className="text-[11px]">{log.taskName}</TableCell>
                                                            <TableCell className="text-[11px]">{log.start}</TableCell>
                                                            <TableCell className="text-[11px]">{log.end}</TableCell>
                                                            <TableCell className="text-[11px] text-right">{log.idleMinutes} min</TableCell>
                                                            <TableCell className="text-[11px] text-right">{log.durationMinutes} min</TableCell>
                                                            <TableCell className="text-[11px] text-right">{productive} min</TableCell>
                                                            <TableCell className="text-[11px] text-right">{log.volume}</TableCell>
                                                            <TableCell className="text-[11px] text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Button
                                                                        size="icon"
                                                                        variant="outline"
                                                                        className="h-6 w-6 border-slate-700"
                                                                        onClick={() => openEditLog(log)}
                                                                    >
                                                                        <Edit className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button
                                                                        size="icon"
                                                                        variant="outline"
                                                                        className="h-6 w-6 border-slate-700 text-red-400 hover:text-red-300"
                                                                        onClick={() => deleteLog(log)}
                                                                        disabled={isDeletingId === log.id}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            {editingLog && (
                <Card id="edit-panel" className="bg-slate-900/80 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-sm">Edit log #{editingLog.id}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <div className="text-[11px] text-slate-400">Work date</div>
                                <DatePicker value={editDate} onChange={setEditDate} />
                            </div>
                            <div className="space-y-1">
                                <div className="text-[11px] text-slate-400">Task (same team)</div>
                                <select
                                    value={editTaskId}
                                    onChange={(e) => setEditTaskId(e.target.value === "" ? "" : Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-2 text-xs"
                                >
                                    <option value="">{selectedTeamId ? "Select taskâ€¦" : "Select team at topâ€¦"}</option>
                                    {tasks.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="text-[10px] text-slate-500">
                                    The list is based on the currently selected team in the top-right.
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[11px] text-slate-400">Volume (units)</div>
                                <Input
                                    value={editVolume}
                                    onChange={(e) => setEditVolume(e.target.value)}
                                    className="bg-slate-950 border-slate-700 text-xs"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-2">
                            <Button
                                variant="outline"
                                className="border-slate-700 text-xs"
                                onClick={cancelEdit}
                                disabled={isSavingEdit}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-emerald-500 hover:bg-emerald-600 text-xs"
                                onClick={saveEdit}
                                disabled={isSavingEdit}
                            >
                                {isSavingEdit ? "Savingâ€¦" : "Save changes"}
                            </Button>
                        </div>

                        <p className="text-[10px] text-slate-500 mt-1">
                            You can edit <strong>date</strong>, <strong>task</strong>, and <strong>volume</strong>. Idle time
                            is controlled by the system and cannot be changed here.
                        </p>
                    </CardContent>
                </Card>
            )}
        </section>
    )}

{
    activeTab === "dashboard" && (
        <section className="space-y-3">
            <Card className="bg-slate-900/70 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-sm">Dashboard â€“ manager tools &amp; future metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs text-slate-300">
                    <div className="space-y-1">
                        <p>
                            Here we will show metrics like productive time, idle time, total volume, and utilization for the
                            selected employee and period.
                        </p>
                        <p>For now, we have a Month Lock feature used by managers to freeze/unfreeze months.</p>
                    </div>
                    <div className="border border-slate-800 rounded-md p-3 bg-slate-950/60 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
                            <div className="space-y-1">
                                <div className="text-[11px] text-slate-400">Year</div>
                                <Input
                                    type="number"
                                    placeholder="2025"
                                    value={lockYear}
                                    onChange={(e) => setLockYear(e.target.value)}
                                    className="bg-slate-950 border-slate-700 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <div className="text-[11px] text-slate-400">Month</div>
                                <select
                                    value={lockMonth}
                                    onChange={(e) => setLockMonth(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-2 text-xs"
                                >
                                    <option value="">Select monthâ€¦</option>
                                    <option value="1">Jan</option>
                                    <option value="2">Feb</option>
                                    <option value="3">Mar</option>
                                    <option value="4">Apr</option>
                                    <option value="5">May</option>
                                    <option value="6">Jun</option>
                                    <option value="7">Jul</option>
                                    <option value="8">Aug</option>
                                    <option value="9">Sep</option>
                                    <option value="10">Oct</option>
                                    <option value="11">Nov</option>
                                    <option value="12">Dec</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <Button
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-[11px]"
                                    onClick={async () => alert("Check status in demo")}
                                    disabled={!selectedTeamId}
                                >
                                    Check status
                                </Button>
                            </div>
                            <div className="flex flex-col gap-1">
                                <Button
                                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-[11px]"
                                    onClick={() => alert("Locking is demo-only")}
                                    disabled={!selectedTeamId}
                                >
                                    Lock month
                                </Button>
                                <Button
                                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-[11px]"
                                    onClick={() => alert("Unlocking is demo-only")}
                                    disabled={!selectedTeamId}
                                >
                                    Unlock month
                                </Button>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[11px] text-slate-400">Status</div>
                                {lockStatus === null && (
                                    <div className="text-[11px] text-slate-500">
                                        No status yet. Check, lock or unlock to see result.
                                    </div>
                                )}
                                {lockStatus === "locked" && (
                                    <Badge variant="secondary" className="text-[10px] bg-emerald-600/80">
                                        Locked â€“ edits, deletes &amp; stop blocked by backend
                                    </Badge>
                                )}
                                {lockStatus === "unlocked" && (
                                    <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-300">
                                        Unlocked â€“ edits &amp; deletes allowed
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </section>
    )
}

{
    activeTab === "history" && (
        <section className="space-y-3">
            <Card className="bg-slate-900/70 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-sm">History Tracker â€“ export CSV</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-300">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="space-y-1">
                            <div className="text-[11px] text-slate-400">From date</div>
                            <DatePicker value={historyFrom} onChange={setHistoryFrom} placeholder="From date" />
                        </div>
                        <div className="space-y-1">
                            <div className="text-[11px] text-slate-400">To date</div>
                            <DatePicker value={historyTo} onChange={setHistoryTo} placeholder="To date" />
                        </div>
                        <div className="flex items-end">
                            <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-xs" onClick={handleDownloadCSV}>
                                Download CSV
                            </Button>
                        </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                        This downloads all your time logs between these dates as a CSV file.
                    </p>
                </CardContent>
            </Card>
        </section>
    )
}

{
    activeTab === "profile" && (
        <section className="space-y-3">
            <Card className="bg-slate-900/70 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-sm">Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-300">
                    <div>
                        <span className="font-semibold">Name: </span>
                        {authUser.full_name}
                    </div>
                    <div>
                        <span className="font-semibold">Email: </span>
                        {authUser.email}
                    </div>
                    <div>
                        <span className="font-semibold">Team: </span>
                        {teams.find((t) => t.id === selectedTeamId)?.name ??
                            (authUser.team_id ? `Team #${authUser.team_id}` : "None selected")}
                    </div>
                    <div>
                        <span className="font-semibold">Role: </span>
                        {authUser.role}
                    </div>

                    {authUser.team_id == null && (
                        <div className="mt-2">
                            <div className="text-[11px] text-slate-400 mb-1">
                                You don't have a team assigned. Choose one below and click Save.
                            </div>
                            <div className="flex gap-2 items-center">
                                <select
                                    value={selectedTeamId ?? ""}
                                    onChange={(e) => setSelectedTeamId(Number(e.target.value) || null)}
                                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-xs"
                                >
                                    <option value="">Select teamâ€¦</option>
                                    {teams.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                                <Button
                                    className="bg-emerald-500 hover:bg-emerald-600 text-xs"
                                    onClick={() => {
                                        if (!selectedTeamId) alert("Choose a team first.");
                                        else setTeamForUser(selectedTeamId);
                                    }}
                                >
                                    Save team
                                </Button>
                            </div>
                        </div>
                    )}

                    <p className="text-[11px] text-slate-500 mt-2">
                        Your account was created via Google sign-in. You can update your team here if needed.
                    </p>
                </CardContent>
            </Card>
        </section>
    )
}
    </main >
        </div >
    );
};

export default App;
