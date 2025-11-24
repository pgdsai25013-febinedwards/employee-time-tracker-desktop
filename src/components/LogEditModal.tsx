import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { DatePicker } from './ui/date-picker';
import { Input } from './ui/input';

type Task = { id: number; team_id: number; name: string };

interface LogEditModalProps {
    editingLog: any | null;
    editDate: string;
    setEditDate: (date: string) => void;
    editTaskId: number | '';
    setEditTaskId: (id: number | '') => void;
    editVolume: string;
    setEditVolume: (volume: string) => void;
    tasks: Task[];
    isSavingEdit: boolean;
    saveEdit: () => Promise<void>;
    cancelEdit: () => void;
}

export function LogEditModal({
    editingLog,
    editDate,
    setEditDate,
    editTaskId,
    setEditTaskId,
    editVolume,
    setEditVolume,
    tasks,
    isSavingEdit,
    saveEdit,
    cancelEdit,
}: LogEditModalProps) {
    if (!editingLog) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <Card className="w-full max-w-md bg-slate-900 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-sm">Edit Time Log</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="space-y-1">
                        <div className="text-xs text-slate-400">Date</div>
                        <DatePicker
                            value={editDate}
                            onChange={(value) => setEditDate(value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <div className="text-xs text-slate-400">Task</div>
                        <select
                            value={editTaskId}
                            onChange={(e) => setEditTaskId(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-2 text-xs sm:text-sm"
                        >
                            <option value="">Select task…</option>
                            {tasks.map((task) => (
                                <option key={task.id} value={task.id}>
                                    {task.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <div className="text-xs text-slate-400">Volume</div>
                        <Input
                            type="number"
                            value={editVolume}
                            onChange={(e) => setEditVolume(e.target.value)}
                            className="bg-slate-950 border-slate-700"
                        />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={cancelEdit} className="border-slate-700">
                            Cancel
                        </Button>
                        <Button onClick={saveEdit} disabled={isSavingEdit} className="bg-blue-600 hover:bg-blue-700">
                            {isSavingEdit ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
