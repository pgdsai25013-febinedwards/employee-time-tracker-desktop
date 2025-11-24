import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Bell, BellOff } from 'lucide-react';

interface NotificationSettingsProps {
    onSettingsChange: (settings: any) => void;
}

export function NotificationSettings({ onSettingsChange }: NotificationSettingsProps) {
    const [settings, setSettings] = useState({
        pomodoroEnabled: true,
        workDuration: 50,
        breakDuration: 10,
        startTimerReminder: true,
        endOfDaySummary: true,
    });

    const updateSetting = (key: string, value: any) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);

        // Convert minutes to seconds for work/break duration
        const electronSettings = {
            ...newSettings,
            workDuration: newSettings.workDuration * 60,
            breakDuration: newSettings.breakDuration * 60,
        };

        onSettingsChange(electronSettings);
    };

    return (
        <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notification Settings
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Pomodoro */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-slate-300">Pomodoro Timer</label>
                        <button
                            onClick={() => updateSetting('pomodoroEnabled', !settings.pomodoroEnabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.pomodoroEnabled ? 'bg-emerald-600' : 'bg-slate-700'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.pomodoroEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                    {settings.pomodoroEnabled && (
                        <div className="grid grid-cols-2 gap-2 pl-4">
                            <div className="space-y-1">
                                <label className="text-[11px] text-slate-400">Work (minutes)</label>
                                <input
                                    type="number"
                                    value={settings.workDuration}
                                    onChange={(e) => updateSetting('workDuration', Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs"
                                    min="1"
                                    max="120"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] text-slate-400">Break (minutes)</label>
                                <input
                                    type="number"
                                    value={settings.breakDuration}
                                    onChange={(e) => updateSetting('breakDuration', Number(e.target.value))}
                                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs"
                                    min="1"
                                    max="60"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Activity Reminder */}
                <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-300">Remind to start timer</label>
                    <button
                        onClick={() => updateSetting('startTimerReminder', !settings.startTimerReminder)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.startTimerReminder ? 'bg-emerald-600' : 'bg-slate-700'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.startTimerReminder ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>

                {/* End of Day Summary */}
                <div className="flex items-center justify-between">
                    <label className="text-xs text-slate-300">End-of-day summary (6 PM)</label>
                    <button
                        onClick={() => updateSetting('endOfDaySummary', !settings.endOfDaySummary)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.endOfDaySummary ? 'bg-emerald-600' : 'bg-slate-700'
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.endOfDaySummary ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>

                <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
                    <p>• Pomodoro: Get reminders to take breaks after work sessions</p>
                    <p>• Activity reminder: Get notified if you're working but forgot to start the timer</p>
                    <p>• Daily summary: Receive your productivity stats at 6 PM (system timezone)</p>
                </div>
            </CardContent>
        </Card>
    );
}
