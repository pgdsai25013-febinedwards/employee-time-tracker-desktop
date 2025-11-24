import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function DashboardTab() {
    return (
        <section className="space-y-3">
            <Card className="bg-slate-900/70 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-sm">Dashboard</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-xs text-slate-400">
                        Dashboard view - Coming soon.
                    </p>
                </CardContent>
            </Card>
        </section>
    );
}
