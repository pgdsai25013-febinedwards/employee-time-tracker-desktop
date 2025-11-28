import { TimerControls } from '../components/TimerControls';
import { LogsTable } from '../components/LogsTable';

type Task = {
    id: number;
    team_id: number;
    name: string;
    category_id?: number;
    category_name?: string;
    category_description?: string;
};

interface TrackerTabProps {
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

export function TrackerTab(props: TrackerTabProps) {
    return (
        <section className="space-y-3">
            <TimerControls
                tasks={props.tasks}
                selectedTaskId={props.selectedTaskId}
                setSelectedTaskId={props.setSelectedTaskId}
                volumeInput={props.volumeInput}
                setVolumeInput={props.setVolumeInput}
                isStarting={props.isStarting}
                isStopping={props.isStopping}
                isTimerActive={props.isTimerActive}
                selectedTeamId={props.selectedTeamId}
                handleStartTimer={props.handleStartTimer}
                handleStopTimer={props.handleStopTimer}
            />
            <LogsTable
                dayGroups={props.dayGroups}
                openDays={props.openDays}
                toggleDay={props.toggleDay}
                openEditLog={props.openEditLog}
                deleteLog={props.deleteLog}
                isDeletingId={props.isDeletingId}
                pageIndex={props.pageIndex}
                hasMore={props.hasMore}
                goNextPage={props.goNextPage}
                goPrevPage={props.goPrevPage}
                weekRange={props.weekRange}
            />
        </section>
    );
}
