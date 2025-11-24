import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { DatePicker } from '../components/ui/date-picker';
import { Download } from 'lucide-react';

interface HistoryTabProps {
    handleDownloadCSV: (from: string, to: string) => Promise<void>;
}

export function HistoryTab({ handleDownloadCSV }: HistoryTabProps) {
    const [historyFrom, setHistoryFrom] = useState('');
    const [historyTo, setHistoryTo] = useState('');

    return (
        <section className="space-y-3">
            <Card className="bg-slate-900/70 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-sm">History Tracker export to CSV</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-slate-300">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="space-y-1">
                            <div className="text-slate-400">From Date</div>
                            <DatePicker
                                value={historyFrom}
                                onChange={(e) => setHistoryFrom(e.target.value)}
                                className="bg-slate-950 border-slate-700"
                            />
                        </div>
                        <div className="space-y-1">
                            <div className="text-slate-400">To Date</div>
                            <DatePicker
                                value={historyTo}
                                onChange={(e) => setHistoryTo(e.target.value)}
                                className="bg-slate-950 border-slate-700"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button
                                onClick={() => handleDownloadCSV(historyFrom, historyTo)}
                                className="w-full bg-blue-600 hover:bg-blue-700 flex items-center gap-1"
                            >
                                <Download className="h-4 w-4" />
                                Download CSV
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </section>
    );
}
