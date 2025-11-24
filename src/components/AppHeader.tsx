import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Sun, Moon, LogOut, Wifi, WifiOff } from 'lucide-react';
import { formatElapsed } from '../lib/formatters';

type AuthUser = {
    id: number;
    full_name: string;
    email: string;
    role: string;
    team_id: number | null;
    avatar_url?: string | null;
};

interface AppHeaderProps {
    authUser: AuthUser;
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
    isOnline: boolean;
    isSyncing: boolean;
    isTimerActive: boolean;
    currentLogId: number | null;
    elapsedSeconds: number;
    isIdleNow: boolean;
    idleMinutes: number;
    handleLogout: () => void;
}

export function AppHeader({
    authUser,
    theme,
    setTheme,
    isOnline,
    isSyncing,
    isTimerActive,
    currentLogId,
    elapsedSeconds,
    isIdleNow,
    idleMinutes,
    handleLogout,
}: AppHeaderProps) {
    return (
        <header className="w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
                <img src="/employee-time-tracker-icon.svg" alt="App Logo" className="h-8 w-8 rounded-full" />
                <div>
                    <div className="text-sm font-semibold">Employee Time Tracker - Desktop</div>
                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                        <span>System-wide idle detection powered by Electron</span>
                        <Badge variant={isOnline ? 'default' : 'destructive'} className="text-[10px] flex items-center gap-1">
                            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                            {isOnline ? 'Online' : 'Offline'}
                        </Badge>
                        {isSyncing && <Badge variant="secondary" className="text-[10px]">⟳ Syncing...</Badge>}
                        {isTimerActive && (
                            <>
                                <Badge variant="secondary" className="text-[10px]">
                                    Timer #{currentLogId} · Elapsed {formatElapsed(elapsedSeconds)}
                                </Badge>
                                <Badge
                                    variant={isIdleNow ? 'outline' : 'secondary'}
                                    className={`text-[10px] ${isIdleNow ? 'border-red-500 text-red-300' : 'bg-emerald-600/80'}`}
                                >
                                    {isIdleNow ? 'IDLE' : 'ACTIVE'} · Idle {idleMinutes}m
                                </Badge>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    className="border-slate-700 h-8 w-8"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
    );
}
