import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
    Play,
    Square,
    Check,
    ChevronsUpDown,
} from "lucide-react";
import { cn } from "../lib/utils";

type Task = {
    id: number;
    team_id: number;
    name: string;
    category_name?: string;
};

interface TimerControlsProps {
    tasks: Task[];
    selectedTaskId: number | "";
    setSelectedTaskId: (id: number | "") => void;
    volumeInput: string;
    setVolumeInput: (value: string) => void;
    isStarting: boolean;
    isStopping: boolean;
    isTimerActive: boolean;
    selectedTeamId: number | null;
    handleStartTimer: () => Promise<void>;
    handleStopTimer: () => Promise<void>;
}

interface CustomDropdownProps {
    tasks: Task[];
    selectedTaskId: number | "";
    setSelectedTaskId: (id: number | "") => void;
    disabled?: boolean;
}

function useOnClickOutside(ref: React.RefObject<HTMLElement>, handler: () => void) {
    useEffect(() => {
        const listener = (e: MouseEvent | TouchEvent) => {
            if (!ref.current) return;
            if (e.composedPath && e.composedPath().includes(ref.current)) return;
            if (ref.current.contains(e.target as Node)) return;
            handler();
        };
        document.addEventListener("mousedown", listener, true);
        document.addEventListener("touchstart", listener, true);
        return () => {
            document.removeEventListener("mousedown", listener, true);
            document.removeEventListener("touchstart", listener, true);
        };
    }, [ref, handler]);
}

function CustomDropdown({ tasks, selectedTaskId, setSelectedTaskId, disabled }: CustomDropdownProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [highlight, setHighlight] = useState<number>(-1);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const listRef = useRef<HTMLUListElement | null>(null);
    useOnClickOutside(wrapperRef, () => setOpen(false));

    // Group tasks by category and produce flattened list for keyboard navigation
    const grouped = useMemo(() => {
        const map = tasks.reduce<Record<string, Task[]>>((acc, t) => {
            const cat = t.category_name?.toLowerCase() || "uncategorized";
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(t);
            return acc;
        }, {});
        const order = ["core", "non-core", "unproductive"];
        const keys = Object.keys(map).sort((a, b) => {
            const ia = order.indexOf(a), ib = order.indexOf(b);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return a.localeCompare(b);
        });
        return keys.map((k) => ({ category: k, items: map[k] }));
    }, [tasks]);

    const flattened = useMemo(() => {
        const flat: { task: Task; category: string }[] = [];
        for (const g of grouped) {
            for (const t of g.items) flat.push({ task: t, category: g.category });
        }
        return flat.filter((p) => p.task.name.toLowerCase().includes(search.toLowerCase()));
    }, [grouped, search]);

    // Reset highlight when open/search changes
    useEffect(() => {
        setHighlight(flattened.length ? 0 : -1);
    }, [open, search, flattened.length]);

    // Keyboard handling on wrapper
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
            return;
        }
        if (!open) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(flattened.length - 1, h + 1));
            scrollToHighlight();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(0, h - 1));
            scrollToHighlight();
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (highlight >= 0 && flattened[highlight]) {
                const id = flattened[highlight].task.id;
                setSelectedTaskId(id);
                setOpen(false);
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
        }
    };

    const scrollToHighlight = () => {
        if (!listRef.current || highlight < 0) return;
        const el = listRef.current.querySelectorAll("[data-index]")[highlight] as HTMLElement | undefined;
        if (el) el.scrollIntoView({ block: "nearest" });
    };

    // Pointer selection (fires before blur)
    const onSelectPointer = (task: Task, e?: React.PointerEvent) => {
        if (e?.preventDefault) e.preventDefault();
        setSelectedTaskId(task.id);
        setTimeout(() => setOpen(false), 0);
    };

    const selectedName = tasks.find((t) => t.id === selectedTaskId)?.name ?? null;

    return (
        <div ref={wrapperRef} className="relative w-full" onKeyDown={onKeyDown}>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                disabled={disabled}
                onClick={() => setOpen((s) => !s)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs sm:text-sm h-9 sm:h-10 bg-slate-950 border border-slate-700 rounded text-slate-200 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <span className="truncate">{selectedName ?? (disabled ? "Select a team first..." : "Select task...")}</span>
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
            </button>

            {/* Menu - absolutely positioned, portal-free */}
            {open && (
                <div
                    role="dialog"
                    aria-modal="false"
                    className="absolute left-0 mt-2 w-full bg-slate-950 border border-slate-800 rounded shadow-lg z-[9999] pointer-events-auto"
                >
                    <div className="p-2">
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search task..."
                            className="w-full px-2 py-1 text-xs sm:text-sm bg-slate-900 border border-slate-800 rounded text-slate-200"
                            autoFocus
                        />
                    </div>

                    <ul ref={listRef} className="max-h-56 overflow-auto px-1 pb-2" role="listbox">
                        {grouped.map((g) => {
                            const visibleItems = g.items.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()));
                            if (!visibleItems.length) return null;
                            return (
                                <li key={g.category} className="mb-2 last:mb-0">
                                    <div className="px-2 text-[11px] text-slate-400 py-1">{g.category.charAt(0).toUpperCase() + g.category.slice(1)}</div>
                                    <ul>
                                        {visibleItems.map((task) => {
                                            const idx = flattened.findIndex((f) => f.task.id === task.id);
                                            const isHighlighted = idx === highlight;
                                            return (
                                                <li
                                                    key={task.id}
                                                    data-index={idx}
                                                    onPointerDown={(e) => onSelectPointer(task, e)}
                                                    className={cn(
                                                        "px-2 py-1 rounded cursor-pointer flex items-center text-xs sm:text-sm text-slate-200",
                                                        isHighlighted ? "bg-slate-800" : "hover:bg-slate-900"
                                                    )}
                                                >
                                                    <span className={cn("mr-2 inline-block w-4 h-4", selectedTaskId === task.id ? "opacity-100" : "opacity-0")}>
                                                        <Check className="w-4 h-4" />
                                                    </span>
                                                    <span className="truncate">{task.name}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </li>
                            );
                        })}

                        {flattened.length === 0 && (
                            <li className="px-3 py-2 text-xs text-slate-500">No task found.</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
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
                <CardTitle className="text-sm">
                    Tracker - record today's time & volume
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
                {/* Top Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">

                    {/* Task Dropdown */}
                    <div className="space-y-1 flex flex-col overflow-visible">
                        <div className="text-xs text-slate-400">Task</div>

                        <CustomDropdown
                            tasks={tasks}
                            selectedTaskId={selectedTaskId}
                            setSelectedTaskId={setSelectedTaskId}
                            disabled={!selectedTeamId || isTimerActive}
                        />

                        <div className="text-[10px] text-slate-500">
                            Task list updates based on the selected team.
                        </div>
                    </div>

                    {/* Volume Input */}
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

                    {/* Start / Stop Button */}
                    <div className="flex gap-2 justify-end">
                        <Button
                            className={cn(
                                "transition-all duration-300 min-w-[140px] gap-2 text-white",
                                isTimerActive
                                    ? "bg-red-500 hover:bg-red-600"
                                    : "bg-emerald-500 hover:bg-emerald-600"
                            )}
                            disabled={
                                (!isTimerActive &&
                                    (!selectedTaskId || !selectedTeamId || isStarting)) ||
                                (isTimerActive && isStopping)
                            }
                            onClick={isTimerActive ? handleStopTimer : handleStartTimer}
                        >
                            {isTimerActive ? (
                                <>
                                    <Square className="w-4 h-4" />
                                    {isStopping ? "Saving…" : "Stop & save"}
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" />
                                    {isStarting ? "Starting…" : "Start timer"}
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Idle Info */}
                <div className="text-[11px] text-slate-500 leading-relaxed">
                    <strong>System-wide idle detection:</strong> Idle time is calculated
                    using OS-level APIs for full-computer activity (keyboard, mouse, app
                    usage). Final productive time = Total Duration − Idle.
                </div>
            </CardContent>
        </Card>
    );
}
