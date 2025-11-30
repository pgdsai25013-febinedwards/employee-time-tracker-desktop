import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function LoginPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
            <Card className="w-full max-w-md bg-slate-900/80 border-slate-800">
                <CardHeader className="flex flex-col items-center gap-2 py-6">
                    <img src="/tray-icon.png" alt="App Logo" className="h-12 w-12 rounded-full" />
                    <CardTitle className="text-lg text-center">Employee Time Tracker</CardTitle>
                    <p className="text-[12px] text-slate-400 text-center max-w-xs">
                        Sign in with your Google account to start tracking time with system-wide idle detection.
                    </p>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4 pb-8">
                    <div id="google-signin-button" className="w-full flex justify-center" />
                    <div className="text-[11px] text-slate-500 text-center max-w-xs">
                        We only use your name &amp; email to create your profile in this app.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
