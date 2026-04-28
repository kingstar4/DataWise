import { useCallback, useEffect, useMemo, useState } from "react";
import UsageAccess, {
    type AppDataUsageStat,
    type DailyDataUsage,
    type PeakHourUsage,
} from "@/native/UsageAccess";

// ── Types ──────────────────────────────────────────────────────────────────

/** Formatted version of AppDataUsageStat for UI consumption. */
export type FormattedAppData = AppDataUsageStat & {
    /** Human-readable total, e.g. "2.4 GB" or "850 MB" */
    formattedTotal: string;
    /** Human-readable mobile usage */
    formattedMobile: string;
    /** Human-readable wifi usage */
    formattedWifi: string;
    /** Percentage of the top app's usage (0–1), for progress bars */
    relativeUsage: number;
};

export type FormattedDailyData = {
    /** Day label, e.g. "Mon" */
    label: string;
    /** Total in GB (for chart values) */
    value: number;
    /** Whether this is today (for highlighting) */
    highlighted: boolean;
};

export type FormattedPeakHour = PeakHourUsage & {
    /** Human-readable total, e.g. "2.1 GB" */
    formattedTotal: string;
    /** Whether this is the window with the most usage */
    active: boolean;
};

export type DataUsageState = {
    /** Per-app data usage, sorted by bytes descending */
    apps: FormattedAppData[];
    /** Total mobile data bytes */
    totalMobile: number;
    /** Total wifi data bytes */
    totalWifi: number;
    /** Grand total bytes */
    grandTotal: number;
    /** Total foreground bytes across all apps */
    totalForeground: number;
    /** Total background bytes across all apps */
    totalBackground: number;
    /** Formatted grand total, e.g. "12.4 GB" */
    formattedTotal: string;
    /** Formatted mobile total */
    formattedMobile: string;
    /** Formatted wifi total */
    formattedWifi: string;
    /** Formatted foreground total */
    formattedForeground: string;
    /** Formatted background total */
    formattedBackground: string;
    /** Daily data for bar chart */
    dailyData: FormattedDailyData[];
    /** Peak hours breakdown */
    peakHours: FormattedPeakHour[];
    /** True while loading */
    isLoading: boolean;
    /** Error message if something failed */
    error: string | null;
    /** Manually trigger a re-fetch */
    refetch: () => void;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

/** Convert raw bytes into a human-readable string. */
export function formatBytes(bytes: number): string {
    if (bytes <= 0) return "0 B";
    if (bytes < KB) return `${bytes} B`;
    if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
    if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
    return `${(bytes / GB).toFixed(2)} GB`;
}

/** Convert bytes to GB as a number (for chart values). */
function bytesToGB(bytes: number): number {
    return Math.round((bytes / GB) * 100) / 100;
}

/** Get the day-of-week short name for the current day. */
function getTodayLabel(): string {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return names[new Date().getDay()];
}

/** Map period index (0=Today, 1=Week, 2=Month) to API string. */
export const PERIOD_MAP = ["today", "week", "month"] as const;
export type Period = (typeof PERIOD_MAP)[number];

/** Number of chart days to query per period. */
function getChartDays(period: Period): number {
    switch (period) {
        case "today":
            return 1;
        case "week":
            return 7;
        case "month":
            return 30;
    }
}

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * Fetches per-app network data usage, daily totals, and peak hours
 * from the native module and formats everything for UI consumption.
 *
 * @param period - "today" | "week" | "month"
 * @param enabled - Only fetch when true (permission granted)
 */
export function useDataUsage(period: Period, enabled = true): DataUsageState {
    const [apps, setApps] = useState<FormattedAppData[]>([]);
    const [dailyData, setDailyData] = useState<FormattedDailyData[]>([]);
    const [peakHours, setPeakHours] = useState<FormattedPeakHour[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        if (!enabled) return;

        setIsLoading(true);
        setError(null);

        try {
            // Fetch all three datasets in parallel
            const [rawApps, rawDaily, rawPeaks] = await Promise.all([
                UsageAccess.getDataUsageStats(period),
                UsageAccess.getDailyDataUsage(getChartDays(period)),
                UsageAccess.getPeakHoursUsage(period),
            ]);

            // ── Format per-app data ──
            const maxBytes = rawApps[0]?.totalBytes ?? 1;
            const formattedApps: FormattedAppData[] = rawApps.map((app) => ({
                ...app,
                formattedTotal: formatBytes(app.totalBytes),
                formattedMobile: formatBytes(
                    app.mobileRxBytes + app.mobileTxBytes
                ),
                formattedWifi: formatBytes(app.wifiRxBytes + app.wifiTxBytes),
                relativeUsage:
                    maxBytes > 0 ? app.totalBytes / maxBytes : 0,
            }));
            setApps(formattedApps);

            // ── Format chart data ──
            const todayLabel = getTodayLabel();
            let formattedDaily: FormattedDailyData[];

            if (period === "month" && rawDaily.length > 7) {
                // Aggregate 30 days into 4 weekly buckets
                const weeksCount = 4;
                const daysPerWeek = Math.ceil(rawDaily.length / weeksCount);
                formattedDaily = [];
                for (let w = 0; w < weeksCount; w++) {
                    const start = w * daysPerWeek;
                    const end = Math.min(start + daysPerWeek, rawDaily.length);
                    const slice = rawDaily.slice(start, end);
                    const totalBytes = slice.reduce(
                        (sum, d) => sum + d.totalBytes,
                        0
                    );
                    const isCurrentWeek = w === weeksCount - 1; // last bucket = current week
                    formattedDaily.push({
                        label: `Wk ${w + 1}`,
                        value: bytesToGB(totalBytes),
                        highlighted: isCurrentWeek,
                    });
                }
            } else {
                formattedDaily = rawDaily.map((d) => ({
                    label: d.label,
                    value: bytesToGB(d.totalBytes),
                    highlighted: d.label === todayLabel,
                }));
            }
            setDailyData(formattedDaily);

            // ── Format peak hours ──
            const maxPeak = Math.max(...rawPeaks.map((p) => p.totalBytes), 1);
            const formattedPeaks: FormattedPeakHour[] = rawPeaks.map((p) => ({
                ...p,
                formattedTotal: formatBytes(p.totalBytes),
                active: p.totalBytes === maxPeak && maxPeak > 0,
            }));
            setPeakHours(formattedPeaks);
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to fetch data usage";
            setError(message);
            setApps([]);
            setDailyData([]);
            setPeakHours([]);
        } finally {
            setIsLoading(false);
        }
    }, [period, enabled]);

    // Re-fetch when period or enabled changes
    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // ── Compute totals ──
    const totals = useMemo(() => {
        let totalMobile = 0;
        let totalWifi = 0;
        let totalForeground = 0;
        let totalBackground = 0;

        for (const app of apps) {
            totalMobile += app.mobileRxBytes + app.mobileTxBytes;
            totalWifi += app.wifiRxBytes + app.wifiTxBytes;
            totalForeground += app.foregroundBytes;
            totalBackground += app.backgroundBytes;
        }

        const grandTotal = totalMobile + totalWifi;

        return {
            totalMobile,
            totalWifi,
            grandTotal,
            totalForeground,
            totalBackground,
            formattedTotal: formatBytes(grandTotal),
            formattedMobile: formatBytes(totalMobile),
            formattedWifi: formatBytes(totalWifi),
            formattedForeground: formatBytes(totalForeground),
            formattedBackground: formatBytes(totalBackground),
        };
    }, [apps]);

    return {
        apps,
        dailyData,
        peakHours,
        isLoading,
        error,
        refetch: fetchAll,
        ...totals,
    };
}
