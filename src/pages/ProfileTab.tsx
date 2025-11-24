import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import NotificationSettings from '../components/NotificationSettings';

interface ProfileTabProps {
    teams: Array<{ id: number; name: string }>;
    selectedTeamId: number | null;
    setSelectedTeamId: (id: number | null) => void;
    setTeamForUser: (teamId: number) => Promise<void>;
    handleNotificationSettingsChange: (settings: any) => void;
}

export function ProfileTab({
    teams,
    selectedTeamId,
    setSelectedTeamId,
    setTeamForUser,
    handleNotificationSettingsChange,
}: ProfileTabProps) {
    return (
        <section className="space-y-3">
            <Card className="bg-slate-900/70 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-sm">Team Selection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                        <div className="space-y-1 sm:col-span-2">
                            <div className="text-xs text-slate-400">Select your default team</div>
                            <select
                                value={selectedTeamId ?? ''}
                                onChange={(e) => {
                                    const next = Number(e.target.value);
                                    setSelectedTeamId(next || null);
                                }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-2 text-xs sm:text-sm"
                            >
                                <option value="">Select team…</option>
                                {teams.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Button
                            onClick={() => {
                                if (selectedTeamId) {
                                    setTeamForUser(selectedTeamId);
                                }
                            }}
                            disabled={!selectedTeamId}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            Save Team
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <NotificationSettings
                onSettingsChange={handleNotificationSettingsChange}
            />
        </section>
    );
}
