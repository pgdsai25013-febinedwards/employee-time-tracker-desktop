import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

type Task = { id: number; team_id: number; name: string };

interface TimerControlsProps {
    tasks: Task[];
    selectedTaskId: number | '';
    setSelectedTaskId: (id: number | '') => void;
    volumeInput: string;
    setVolumeInput: (value: string) => void;
    isStarting: boolean;
    isStopping: boolean;
    isTimerActive: boolean;
    selectedTeamId: number | null;
    handleStartTimer: () => Promise<void>;
    handleStopTimer: () => Promise<void>;
}

export function TimerControls({
    tasks,
    selectedTaskId,
    setSelectedTaskId,
    volumeInput,
    setVolumeInput,
    isStarting,
    isStopping,
    isTimerActive,
    selectedTeamId,
    handleStartTimer,
    handleStopTimer,
}: TimerControlsProps) {
    return (
        <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tracker - record today's time &amp; volume</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div className="space-y-1">
                        <div className="text-xs text-slate-400">Task</div>
                        <select
                            value={selectedTaskId}
                            onChange={(e) => setSelectedTaskId(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-2 text-xs sm:text-sm"
                            disabled={!selectedTeamId || isTimerActive}
                        >
                            <option value="">{selectedTeamId ? 'Select task…' : 'Select a team first…'}</option>
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
                            disabled={selectedTaskId === '' || !selectedTeamId || isStarting || isTimerActive}
                            onClick={handleStartTimer}
                        >
                            {isStarting ? 'Starting…' : 'Start timer'}
                        </Button>
                        <Button
                            variant="outline"
                            className="border-slate-700 text-xs sm:text-sm"
                            disabled={!isTimerActive || isStopping}
                            onClick={handleStopTimer}
                        >
                            {isStopping ? 'Saving…' : 'Stop & save'}
                        </Button>
                    </div>
                </div>

                <div className="text-[11px] text-slate-500">
                    <strong>System-wide idle detection:</strong> Idle time is calculated using OS-level APIs that track
                    your entire computer activity (keyboard, mouse, etc.), not just this app window. Final productive
                    time = Duration − Idle.
                </div>
            </CardContent>
        </Card>
    );
}
