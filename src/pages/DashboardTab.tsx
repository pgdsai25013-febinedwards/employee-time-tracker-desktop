import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useDashboardData } from '../hooks/useDashboardData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Loader2, Clock, CheckCircle2, TrendingUp, MapPin, Gauge } from 'lucide-react';

interface DashboardTabProps {
    authToken: string | null;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function DashboardTab({ authToken }: DashboardTabProps) {
    const {
        metrics,
        dailyActivity,
        taskDistribution,
        categoryDistribution,
        locationData,
        isLoading,
        targetHours,
        setTargetHours,
        dateRange,
        setDateRange
    } = useDashboardData(authToken);
    const [chartsReady, setChartsReady] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setChartsReady(true), 200);
        return () => clearTimeout(timer);
    }, []);

    const handleDateChange = (type: 'from' | 'to', value: string) => {
        if (!value) return;
        const newDate = new Date(value);
        setDateRange(prev => ({
            ...prev,
            [type]: newDate
        }));
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    // Animation classes
    const cardAnimation = "transition-all duration-500 ease-in-out hover:scale-[1.02] hover:bg-slate-800/80";
    const fadeIn = "animate-[fadeIn_0.5s_ease-out_forwards]";

    return (
        <section className="space-y-4 pb-8">
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className="text-xl font-semibold text-white">Dashboard Overview</h2>

                <div className="flex flex-wrap items-center gap-3 bg-slate-900/70 p-2 rounded-lg border border-slate-800">
                    {/* Date Range Picker */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Range:</span>
                        <input
                            type="date"
                            value={dateRange.from.toISOString().split('T')[0]}
                            onChange={(e) => handleDateChange('from', e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-slate-500">-</span>
                        <input
                            type="date"
                            value={dateRange.to.toISOString().split('T')[0]}
                            onChange={(e) => handleDateChange('to', e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    <div className="w-px h-4 bg-slate-700 mx-1"></div>

                    {/* Target Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Target:</span>
                        <select
                            value={targetHours}
                            onChange={(e) => setTargetHours(Number(e.target.value))}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value={7.25}>7.25h</option>
                            <option value={8.0}>8.0h</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    { title: "Total Hours", icon: Clock, color: "text-blue-500", value: `${metrics.totalHours}h`, sub: "In selected range" },
                    { title: "Productivity Score", icon: TrendingUp, color: "text-green-500", value: `${metrics.productivityScore}%`, sub: `${metrics.productiveHours}h productive` },
                    { title: "Top Task", icon: CheckCircle2, color: "text-purple-500", value: metrics.topTask, sub: "Most time spent", truncate: true },
                    { title: "Work Location", icon: MapPin, color: "text-orange-500", value: `${metrics.wfhPercentage}%`, sub: "Work From Home" },
                    { title: "Utilization", icon: Gauge, color: "text-cyan-500", value: `${metrics.utilization}%`, sub: `Based on ${targetHours}h target` }
                ].map((kpi, index) => (
                    <Card key={index} className={`bg-slate-900/70 border-slate-800 ${cardAnimation}`} style={{ animationDelay: `${index * 100}ms` }}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">{kpi.title}</CardTitle>
                            <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold text-white ${kpi.truncate ? 'truncate' : ''}`} title={kpi.truncate ? kpi.value : undefined}>
                                {kpi.value}
                            </div>
                            <p className="text-xs text-slate-500">{kpi.sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts Row 1 */}
            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${fadeIn}`} style={{ animationDelay: '500ms' }}>
                {/* Daily Activity Trend */}
                <Card className="bg-slate-900/70 border-slate-800 col-span-1 lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-300">Daily Activity Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            {chartsReady && (
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                                    <BarChart data={dailyActivity}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                            itemStyle={{ color: '#f8fafc' }}
                                            cursor={{ fill: '#334155', opacity: 0.4 }}
                                        />
                                        <Legend />
                                        <Bar dataKey="core" name="Core" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} animationDuration={1000} />
                                        <Bar dataKey="non_core" name="Non-Core" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} animationDuration={1000} />
                                        <Bar dataKey="unproductive" name="Unproductive" stackId="a" fill="#64748b" radius={[0, 0, 0, 0]} animationDuration={1000} />
                                        <Bar dataKey="other" name="Other" stackId="a" fill="#a8a29e" radius={[4, 4, 0, 0]} animationDuration={1000} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 2 */}
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${fadeIn}`} style={{ animationDelay: '700ms' }}>
                {/* Category Distribution */}
                <Card className="bg-slate-900/70 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-300">Time by Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            {chartsReady && (
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                                    <PieChart>
                                        <Pie
                                            data={categoryDistribution}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            animationDuration={1000}
                                            animationBegin={200}
                                        >
                                            {categoryDistribution.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                        />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Task Distribution */}
                <Card className="bg-slate-900/70 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-300">Top Tasks</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            {chartsReady && (
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                                    <BarChart layout="vertical" data={taskDistribution}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                        <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="name" type="category" width={100} stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                            cursor={{ fill: '#334155', opacity: 0.4 }}
                                        />
                                        <Bar dataKey="value" name="Hours" fill="#8b5cf6" radius={[0, 4, 4, 0]} animationDuration={1000} animationBegin={400} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Work Location */}
                <Card className="bg-slate-900/70 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-300">Work Location</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            {chartsReady && (
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                                    <PieChart>
                                        <Pie
                                            data={locationData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            animationDuration={1000}
                                            animationBegin={600}
                                        >
                                            {locationData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                        />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}

