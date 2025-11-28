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
    const { metrics, dailyActivity, taskDistribution, categoryDistribution, locationData, isLoading, targetHours, setTargetHours } = useDashboardData(authToken);
    const [chartsReady, setChartsReady] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setChartsReady(true), 200);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <section className="space-y-4 pb-8">
            <div className="flex justify-end mb-2">
                <div className="flex items-center gap-2 bg-slate-900/70 p-2 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400">Daily Target:</span>
                    <select
                        value={targetHours}
                        onChange={(e) => setTargetHours(Number(e.target.value))}
                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        <option value={7.25}>7.25 Hours</option>
                        <option value={8.0}>8.0 Hours</option>
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="bg-slate-900/70 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Total Hours</CardTitle>
                        <Clock className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{metrics.totalHours}h</div>
                        <p className="text-xs text-slate-500">Last 30 days</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/70 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Productivity Score</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{metrics.productivityScore}%</div>
                        <p className="text-xs text-slate-500">{metrics.productiveHours}h productive</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/70 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Top Task</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold text-white truncate" title={metrics.topTask}>
                            {metrics.topTask}
                        </div>
                        <p className="text-xs text-slate-500">Most time spent</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/70 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Work Location</CardTitle>
                        <MapPin className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{metrics.wfhPercentage}%</div>
                        <p className="text-xs text-slate-500">Work From Home</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-900/70 border-slate-800">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">Utilization</CardTitle>
                        <Gauge className="h-4 w-4 text-cyan-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-white">{metrics.utilization}%</div>
                        <p className="text-xs text-slate-500">Based on {targetHours}h target</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Daily Activity Trend */}
                <Card className="bg-slate-900/70 border-slate-800 col-span-1 lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-300">Daily Activity Trend (Last 7 Days)</CardTitle>
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
                                        <Bar dataKey="hours" name="Total Hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="productive" name="Productive Hours" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                        <Bar dataKey="value" name="Hours" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
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

