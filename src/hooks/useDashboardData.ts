import { useState, useEffect } from 'react';
import { db } from '../lib/indexed-db';
import { offlineManager } from '../lib/offline-manager';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export interface DashboardMetrics {
    totalHours: number;
    productiveHours: number;
    productivityScore: number;
    topTask: string;
    wfhPercentage: number;
    utilization: number;
}

export interface DailyActivity {
    date: string;
    hours: number;
    productive: number;
}

export interface TaskDistribution {
    name: string;
    value: number; // hours
}

export interface WorkLocationData {
    name: string;
    value: number;
    [key: string]: any;
}

export interface CategoryDistribution {
    name: string;
    value: number; // hours
    color: string;
}

export function useDashboardData(authToken: string | null) {
    const [metrics, setMetrics] = useState<DashboardMetrics>({
        totalHours: 0,
        productiveHours: 0,
        productivityScore: 0,
        topTask: '-',
        wfhPercentage: 0,
        utilization: 0
    });
    const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
    const [taskDistribution, setTaskDistribution] = useState<TaskDistribution[]>([]);
    const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([]);
    const [locationData, setLocationData] = useState<WorkLocationData[]>([]);
    const [targetHours, setTargetHours] = useState<number>(8.0);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch data for the last 30 days
    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            const today = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);

            const from = thirtyDaysAgo.toISOString().split('T')[0];
            const to = today.toISOString().split('T')[0];

            let logs: any[] = [];

            // 1. Fetch from API
            if (authToken && offlineManager.getOnlineStatus()) {
                try {
                    // Try filter endpoint first (preferred)
                    let res = await fetch(`${API_BASE}/api/time-logs/filter?from=${from}&to=${to}`, {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    });

                    // If filter endpoint doesn't exist (404), fall back to recent endpoint
                    if (res.status === 404) {
                        console.log('Filter endpoint not found, falling back to recent endpoint');
                        res = await fetch(`${API_BASE}/api/time-logs/recent?days=30`, {
                            headers: { 'Authorization': `Bearer ${authToken}` }
                        });
                    }

                    if (res.ok) {
                        logs = await res.json();
                    } else {
                        console.error('Failed to fetch dashboard data:', res.status);
                    }
                } catch (e) {
                    console.error('Failed to fetch dashboard data from API', e);
                }
            }

            // 2. Merge with local DB (for offline support)
            const localLogs = await db.getCachedLogs();
            // Simple merge: if ID exists in logs, replace, else add.
            // Note: This is a simplified merge strategy.
            const logMap = new Map(logs.map(l => [l.id, l]));
            localLogs.forEach(l => {
                const d = l.work_date ? l.work_date.split('T')[0] : '';
                if (d >= from && d <= to) {
                    logMap.set(l.id, l);
                }
            });
            const mergedLogs = Array.from(logMap.values());

            // 3. Process Data
            processLogs(mergedLogs);

        } catch (err) {
            console.error('Error fetching dashboard data', err);
        } finally {
            setIsLoading(false);
        }
    };

    const processLogs = (logs: any[]) => {
        let totalSeconds = 0;
        let idleSeconds = 0;
        let wfhCount = 0;
        let officeCount = 0;
        const taskHours: Record<string, number> = {};
        const categoryHours: Record<string, number> = {
            'core': 0,
            'non-core': 0,
            'unproductive': 0
        };
        const dailyMap: Record<string, { total: number, idle: number }> = {};

        logs.forEach(log => {
            const duration = log.duration_seconds || 0;
            const idle = log.idle_seconds || 0;
            // const productive = Math.max(0, duration - idle); // Unused
            const taskName = log.task_templates?.name || log.task_name || 'Unknown';
            const categoryName = (log.task_templates?.category_name || 'unknown').toLowerCase();
            const location = log.work_location;
            const date = log.work_date ? log.work_date.split('T')[0] : '';

            totalSeconds += duration;
            idleSeconds += idle;

            // Task Distribution
            if (!taskHours[taskName]) taskHours[taskName] = 0;
            taskHours[taskName] += duration;

            // Category Distribution
            if (categoryHours[categoryName] !== undefined) {
                categoryHours[categoryName] += duration;
            } else {
                // Handle unknown categories if any
                if (!categoryHours['other']) categoryHours['other'] = 0;
                categoryHours['other'] += duration;
            }

            // Location
            if (location === 'wfh') wfhCount++;
            else if (location === 'office') officeCount++;

            // Daily Trend
            if (date) {
                if (!dailyMap[date]) dailyMap[date] = { total: 0, idle: 0 };
                dailyMap[date].total += duration;
                dailyMap[date].idle += idle;
            }
        });

        // Metrics
        const totalHours = Math.round(totalSeconds / 3600 * 10) / 10;
        const productiveHours = Math.round((totalSeconds - idleSeconds) / 3600 * 10) / 10;
        const productivityScore = totalSeconds > 0 ? Math.round(((totalSeconds - idleSeconds) / totalSeconds) * 100) : 0;

        let topTask = '-';
        let maxTaskSeconds = 0;
        Object.entries(taskHours).forEach(([name, seconds]) => {
            if (seconds > maxTaskSeconds) {
                maxTaskSeconds = seconds;
                topTask = name;
            }
        });

        const totalLocation = wfhCount + officeCount;
        const wfhPercentage = totalLocation > 0 ? Math.round((wfhCount / totalLocation) * 100) : 0;

        setMetrics({
            totalHours,
            productiveHours,
            productivityScore,
            topTask,
            wfhPercentage,
            utilization: 0 // Will be updated below
        });

        // Calculate Utilization
        const uniqueDays = Object.keys(dailyMap).length;
        const avgDailyProductive = uniqueDays > 0 ? productiveHours / uniqueDays : 0;
        const utilization = uniqueDays > 0 ? Math.round((avgDailyProductive / targetHours) * 100) : 0;

        setMetrics(prev => ({ ...prev, utilization }));

        // Charts: Daily Activity
        const activityData = Object.entries(dailyMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, data]) => ({
                date: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                hours: Math.round(data.total / 3600 * 10) / 10,
                productive: Math.round((data.total - data.idle) / 3600 * 10) / 10
            }))
            .slice(-7); // Last 7 days for better visibility
        setDailyActivity(activityData);

        // Charts: Task Distribution (Top 5)
        const taskDistData = Object.entries(taskHours)
            .map(([name, seconds]) => ({
                name,
                value: Math.round(seconds / 3600 * 10) / 10
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
        setTaskDistribution(taskDistData);

        // Charts: Category Distribution
        const categoryColors: Record<string, string> = {
            'core': '#10b981', // Green
            'non-core': '#3b82f6', // Blue
            'unproductive': '#64748b', // Slate
            'other': '#a8a29e' // Stone
        };

        const categoryDistData = Object.entries(categoryHours)
            .filter(([_, seconds]) => seconds > 0)
            .map(([name, seconds]) => ({
                name: name.charAt(0).toUpperCase() + name.slice(1),
                value: Math.round(seconds / 3600 * 10) / 10,
                color: categoryColors[name] || '#cbd5e1'
            }))
            .sort((a, b) => b.value - a.value);
        setCategoryDistribution(categoryDistData);

        // Charts: Location
        setLocationData([
            { name: 'WFH', value: wfhCount },
            { name: 'Office', value: officeCount }
        ]);
    };

    useEffect(() => {
        if (authToken) {
            fetchDashboardData();
        }
    }, [authToken, targetHours]);

    return {
        metrics,
        dailyActivity,
        taskDistribution,
        categoryDistribution,
        locationData,
        isLoading,
        targetHours,
        setTargetHours,
        refresh: fetchDashboardData
    };
}
