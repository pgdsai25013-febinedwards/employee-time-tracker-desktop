import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { ChevronLeft, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { formatDateLabel } from '../lib/formatters';

interface LogsTableProps {
    dayGroups: any[];
    openDays: Record<string, boolean>;
    toggleDay: (date: string) => void;
    openEditLog: (log: any) => void;
    deleteLog: (log: any) => Promise<void>;
    isDeletingId: number | null;
    pageIndex: number;
    hasMore: boolean;
    goNextPage: () => Promise<void>;
    goPrevPage: () => Promise<void>;
    weekRange: string;
}

export function LogsTable({
    dayGroups,
    openDays,
    toggleDay,
    openEditLog,
    deleteLog,
    isDeletingId,
    pageIndex,
    hasMore,
    goNextPage,
    goPrevPage,
    weekRange,
}: LogsTableProps) {
    return (
        <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader className="flex items-center justify-between">
                <div>
                    <CardTitle className="text-sm">Tasks recorded</CardTitle>
                    <p className="text-xs text-slate-400">{weekRange}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 border-slate-700"
                        onClick={goPrevPage}
                        disabled={false}
                    >
                        <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 border-slate-700"
                        onClick={goNextPage}
                        disabled={pageIndex === 0}
                    >
                        <ChevronRight className="h-3 w-3" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                {dayGroups.length === 0 && (
                    <div className="text-xs text-slate-500">No logs recorded for this week yet.</div>
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
                                    <span>{isOpen ? 'Hide' : 'Show'}</span>
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
                                                                    className="h-6 w-6 border-slate-700 text-red-400"
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
    );
}
