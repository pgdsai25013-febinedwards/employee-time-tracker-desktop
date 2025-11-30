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
    total: number;
    core: number;
    non_core: number;
    unproductive: number;
}

export interface TaskDistribution {
    name: string;
    value: number;
    [key: string]: any;
}

export interface WorkLocationData {
    name: string;
    value: number;
    [key: string]: any;
}

export interface CategoryDistribution {
    name: string;
    value: number;
    color: string;
    [key: string]: any;
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
    const [isLoading, setIsLoading] = useState(true);
    const [targetHours, setTargetHours] = useState(7.25);
    const [dateRange, setDateRange] = useState({
        from: new Date(new Date().setDate(new Date().getDate() - 7)),
        to: new Date()
    });

    const fetchDashboardData = async () => {
        if (!authToken) return;

        setIsLoading(true);
        try {
            // Fetch from API or offline cache
            const isOnline = navigator.onLine;
            let logs: any[] = [];

            if (isOnline) {
                // Format dates for API
                const fromDate = dateRange.from.toISOString().split('T')[0];
                const toDate = dateRange.to.toISOString().split('T')[0];

                // Try filter endpoint first
                let response = await fetch(`${API_BASE}/api/time-logs/filter?from=${fromDate}&to=${toDate}`, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });

                // If filter endpoint doesn't exist (404), fall back to recent endpoint
                if (response.status === 404) {
                    console.log('Filter endpoint not found, falling back to recent endpoint');
                    // Calculate days to fetch
                    const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
                    const daysToFetch = Math.max(daysDiff + 1, 30);

                    response = await fetch(`${API_BASE}/api/time-logs/recent?days=${daysToFetch}`, {
                        headers: {
                            'Authorization': `Bearer ${authToken}`
                        }
                    });
                }

                if (response.ok) {
                    logs = await response.json();
                    // Filter logs to date range (in case we used the recent endpoint)
                    logs = logs.filter((log: any) => {
                        const logDate = log.work_date ? log.work_date.split('T')[0] : '';
                        return logDate >= fromDate && logDate <= toDate;
                    });
                }
            } else {
                // Fallback to offline data
                logs = await db.getCachedLogs();
            }

            processLogs(logs);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            // Fallback to offline cache
            const logs = await db.getCachedLogs();
            processLogs(logs);
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

        // Structure for daily breakdown
        interface DailyBreakdown {
            total: number;
            core: number;
            non_core: number;
            unproductive: number;
        }
        const dailyMap: Record<string, DailyBreakdown> = {};

        // Initialize daily map for the entire range to ensure no gaps in chart
        const currentDate = new Date(dateRange.from);
        const endDate = new Date(dateRange.to);
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            dailyMap[dateStr] = { total: 0, core: 0, non_core: 0, unproductive: 0 };
            currentDate.setDate(currentDate.getDate() + 1);
        }

        logs.forEach(log => {
            const duration = log.duration_seconds || 0;
            const idle = log.idle_seconds || 0;
            const taskName = log.task_templates?.name || log.task_name || 'Unknown';
            let categoryName = (log.task_templates?.category_name || 'non-core').toLowerCase();
            const location = log.work_location;
            const date = log.work_date ? log.work_date.split('T')[0] : '';

            // Normalize category: if not core or unproductive, it's non-core
            if (categoryName !== 'core' && categoryName !== 'unproductive') {
                categoryName = 'non-core';
            }

            // Only process logs within the selected range
            const fromStr = dateRange.from.toISOString().split('T')[0];
            const toStr = dateRange.to.toISOString().split('T')[0];
            if (date < fromStr || date > toStr) return;

            totalSeconds += duration;
            idleSeconds += idle;

            // Task Distribution
            if (!taskHours[taskName]) taskHours[taskName] = 0;
            taskHours[taskName] += duration;

            // Category Distribution
            if (categoryHours[categoryName] !== undefined) {
                categoryHours[categoryName] += duration;
            }

            // Location
            if (location === 'wfh') wfhCount++;
            else if (location === 'office') officeCount++;

            // Daily Trend
            if (date && dailyMap[date]) {
                dailyMap[date].total += duration;

                if (categoryName === 'core') dailyMap[date].core += duration;
                else if (categoryName === 'unproductive') dailyMap[date].unproductive += duration;
                else dailyMap[date].non_core += duration;
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
            utilization: 0
        });

        // Calculate Utilization based on working days in range
        let workingDays = 0;
        const d = new Date(dateRange.from);
        const end = new Date(dateRange.to);
        while (d <= end) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) workingDays++; // Exclude Sun (0) and Sat (6)
            d.setDate(d.getDate() + 1);
        }
        workingDays = Math.max(1, workingDays);

        const utilization = Math.round((productiveHours / (workingDays * targetHours)) * 100);
        setMetrics(prev => ({ ...prev, utilization }));

        // Charts: Daily Activity
        const activityData = Object.entries(dailyMap)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, data]) => ({
                date: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                total: Math.round(data.total / 3600 * 10) / 10,
                core: Math.round(data.core / 3600 * 10) / 10,
                non_core: Math.round(data.non_core / 3600 * 10) / 10,
                unproductive: Math.round(data.unproductive / 3600 * 10) / 10
            }));
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
            'unproductive': '#64748b' // Slate
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
    }, [authToken, targetHours, dateRange]);

    return {
        metrics,
        dailyActivity,
        taskDistribution,
        categoryDistribution,
        locationData,
        isLoading,
        targetHours,
        setTargetHours,
        dateRange,
        setDateRange,
        refresh: fetchDashboardData
    };
}
