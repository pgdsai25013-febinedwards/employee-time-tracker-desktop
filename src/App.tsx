import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useTimer } from './hooks/useTimer';
import { useTimeLogs } from './hooks/useTimeLogs';
import { useOffline } from './hooks/useOffline';
import { useNotifications } from './hooks/useNotifications';

// Components
import { AppHeader } from './components/AppHeader';
import { LogEditModal } from './components/LogEditModal';

// Pages
import { LoginPage } from './pages/LoginPage';
import { TrackerTab } from './pages/TrackerTab';
import { DashboardTab } from './pages/DashboardTab';
import { HistoryTab } from './pages/HistoryTab';
import { ProfileTab } from './pages/ProfileTab';
type Team = { id: number; name: string };
type Task = { id: number; team_id: number; name: string };
type TabId = 'tracker' | 'dashboard' | 'history' | 'profile';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const App: React.FC = () => {
    // Auth hook
    const auth = useAuth();

    // UI state
    const [activeTab, setActiveTab] = useState<TabId>('tracker');
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    // Teams & tasks
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedTaskId, setSelectedTaskId] = useState<number | ''>('');
    const [volumeInput, setVolumeInput] = useState<string>('');

    // Initialize time logs hook
    const timeLogs = useTimeLogs(auth.authToken, tasks);

    // Initialize timer hook (needs to call timeLogs.fetchRecentLogs)
    const timer = useTimer(
        auth.authToken,
        selectedTeamId,
        selectedTaskId,
        volumeInput,
        setVolumeInput,
        setSelectedTaskId,          // ← ADD THIS LINE
        timeLogs.fetchRecentLogs,   // ← This moves to line 55
        tasks
    );

    // Initialize offline hook
    const offline = useOffline(auth.authToken);

    // Initialize notifications hook
    const notifications = useNotifications(timeLogs.dayGroups, timer.currentLogId);

    // Apply theme
    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
    }, [theme]);

    // Register sync callback for offline manager
    useEffect(() => {
        offline.registerSyncCallback(async () => {
            await timeLogs.fetchRecentLogs();
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // API fetch helper
    async function apiFetch(input: string, init: RequestInit = {}) {
        const headers = new Headers(init.headers || {});
        if (auth.authToken) headers.set('Authorization', `Bearer ${auth.authToken}`);
        const response = await fetch(`${API_BASE}${input}`, {
            ...init,
            headers,
        });
        if (response.status === 401) {
            setTimeout(() => {
                auth.handleLogout();
            }, 10);
        }
        return response;
    }

    // Load teams
    const loadTeams = async () => {
        if (!auth.authToken) return;
        try {
            const res = await apiFetch('/api/teams');
            if (!res.ok) {
                console.error('Failed to fetch teams', res.status);
                return;
            }
            const data = await res.json();
            setTeams(data);
            if (data.length > 0 && selectedTeamId == null) {
                if (auth.authUser?.team_id) setSelectedTeamId(auth.authUser.team_id);
                else setSelectedTeamId(data[0].id);
            }
        } catch (err) {
            console.error('Failed to load teams', err);
        }
    };

    useEffect(() => {
        if (auth.authUser && auth.authToken) loadTeams();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.authUser, auth.authToken]);

    // Load tasks when team changes
    useEffect(() => {
        const fetchTasks = async () => {
            if (!selectedTeamId) {
                setTasks([]);
                setSelectedTaskId('');
                return;
            }
            try {
                const res = await apiFetch(`/api/tasks?team_id=${selectedTeamId}`);
                if (!res.ok) {
                    console.error('Failed to fetch tasks', res.status);
                    setTasks([]);
                    return;
                }
                const data = await res.json();
                setTasks(data);
                setSelectedTaskId('');
            } catch (err) {
                console.error('Failed to load tasks', err);
                setTasks([]);
            }
        };
        fetchTasks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTeamId]);

    // Fetch logs + restore timer after auth
    useEffect(() => {
        if (!auth.authUser) return;
        timeLogs.fetchRecentLogs();
        timer.restoreActiveTimer();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.authUser]);

    // Set team for user
    const setTeamForUser = async (teamId: number) => {
        try {
            const res = await apiFetch(`/api/users/${auth.authUser?.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ team_id: teamId }),
            });
            if (!res.ok) {
                alert('Failed to update user team.');
                return;
            }
            const data = await res.json();
            auth.setAuthUser(data);
            localStorage.setItem('ett_user', JSON.stringify(data));
            alert('Team updated successfully!');
        } catch (err) {
            console.error('Error updating team', err);
            alert('Error updating team. Check console.');
        }
    };

    // Render loading state
    if (!auth.isAuthReady) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
                <p>Loading...</p>
            </div>
        );
    }

    // Render login page if not authenticated
    if (!auth.authUser) {
        return <LoginPage />;
    }

    // Render main app
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
            <AppHeader
                authUser={auth.authUser}
                theme={theme}
                setTheme={setTheme}
                isOnline={offline.isOnline}
                isSyncing={offline.isSyncing}
                isTimerActive={timer.isTimerActive}
                currentLogId={timer.currentLogId}
                elapsedSeconds={timer.elapsedSeconds}
                isIdleNow={timer.isIdleNow}
                idleMinutes={timer.idleMinutes}
                handleLogout={auth.handleLogout}
            />

            <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 space-y-3">
                {/* Team Selector */}
                <Card className="bg-slate-900/70 border-slate-800">
                    <CardContent className="py-3">
                        <div className="flex items-center gap-2 text-xs">
                            <label className="text-slate-400 whitespace-nowrap">Select Team:</label>
                            <select
                                value={selectedTeamId ?? ''}
                                onChange={(e) => {
                                    const next = Number(e.target.value);
                                    setSelectedTeamId(next || null);
                                }}
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-xs"
                            >
                                <option value="">–– Select a team ––</option>
                                {teams.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                            {selectedTeamId && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-slate-700 text-xs"
                                    onClick={() => setSelectedTeamId(null)}
                                >
                                    Clear
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={(val: string) => setActiveTab(val as TabId)}>
                    <TabsList className="grid w-full grid-cols-4 bg-slate-900/70 border border-slate-800">
                        <TabsTrigger value="tracker" className="text-xs sm:text-sm">
                            Tracker
                        </TabsTrigger>
                        <TabsTrigger value="dashboard" className="text-xs sm:text-sm">
                            Dashboard
                        </TabsTrigger>
                        <TabsTrigger value="history" className="text-xs sm:text-sm">
                            Reports
                        </TabsTrigger>
                        <TabsTrigger value="profile" className="text-xs sm:text-sm">
                            Profile
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="tracker">
                        <TrackerTab
                            tasks={tasks}
                            selectedTaskId={selectedTaskId}
                            setSelectedTaskId={setSelectedTaskId}
                            volumeInput={volumeInput}
                            setVolumeInput={setVolumeInput}
                            isStarting={timer.isStarting}
                            isStopping={timer.isStopping}
                            isTimerActive={timer.isTimerActive}
                            selectedTeamId={selectedTeamId}
                            handleStartTimer={timer.handleStartTimer}
                            handleStopTimer={timer.handleStopTimer}
                            dayGroups={timeLogs.dayGroups}
                            openDays={timeLogs.openDays}
                            toggleDay={timeLogs.toggleDay}
                            openEditLog={timeLogs.openEditLog}
                            deleteLog={timeLogs.deleteLog}
                            isDeletingId={timeLogs.isDeletingId}
                            pageIndex={timeLogs.pageIndex}
                            hasMore={timeLogs.hasMore}
                            goNextPage={timeLogs.goNextPage}
                            goPrevPage={timeLogs.goPrevPage}
                            weekRange={timeLogs.weekRange}
                        />
                    </TabsContent>

                    <TabsContent value="dashboard">
                        <DashboardTab authToken={auth.authToken} />
                    </TabsContent>

                    <TabsContent value="history">
                        <HistoryTab handleDownloadCSV={timeLogs.handleDownloadCSV} />
                    </TabsContent>

                    <TabsContent value="profile">
                        <ProfileTab
                            teams={teams}
                            selectedTeamId={selectedTeamId}
                            setSelectedTeamId={setSelectedTeamId}
                            setTeamForUser={setTeamForUser}
                            handleNotificationSettingsChange={notifications.handleNotificationSettingsChange}
                        />
                    </TabsContent>
                </Tabs>
            </main>

            {/* Edit Modal */}
            <LogEditModal
                editingLog={timeLogs.editingLog}
                editDate={timeLogs.editDate}
                setEditDate={timeLogs.setEditDate}
                editTaskId={timeLogs.editTaskId}
                setEditTaskId={timeLogs.setEditTaskId}
                editVolume={timeLogs.editVolume}
                setEditVolume={timeLogs.setEditVolume}
                tasks={tasks}
                isSavingEdit={timeLogs.isSavingEdit}
                saveEdit={timeLogs.saveEdit}
                cancelEdit={timeLogs.cancelEdit}
            />
        </div>
    );
};

export default App;