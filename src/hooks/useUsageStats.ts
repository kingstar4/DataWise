import { useCallback, useEffect, useState } from "react";
import UsageAccess, { type AppUsageStat } from "@/native/UsageAccess";

// ── Types ──────────────────────────────────────────────────────────────────

/** Formatted version of AppUsageStat for UI consumption. */
export type FormattedAppUsage = AppUsageStat & {
    /** Human-readable time string, e.g. "2h 15m" or "45m" */
    formattedTime: string;
    /** Percentage of the top app's usage (0–1), for progress bars */
    relativeUsage: number;
};

export type UsageStatsState = {
    /** Formatted app usage data, sorted by time descending */
    data: FormattedAppUsage[];
    /** True while the native query is in progress */
    isLoading: boolean;
    /** Error message if the native call failed */
    error: string | null;
    /** Manually trigger a re-fetch */
    refetch: () => void;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Convert raw minutes into a human-readable string. */
function formatMinutes(minutes: number): string {
    if (minutes < 1) return "<1m";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
}

// ── Hook ───────────────────────────────────────────────────────────────────

/**
 * Fetches today's usage stats from the native module and formats them for UI.
 *
 * @param enabled - Only fetch when true (i.e. when permission is granted).
 *                  Prevents unnecessary native calls and errors.
 */
export function useUsageStats(enabled: boolean): UsageStatsState {
    const [data, setData] = useState<FormattedAppUsage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        if (!enabled) return;

        setIsLoading(true);
        setError(null);

        try {
            const raw: AppUsageStat[] =
                await UsageAccess.getTodayUsageStats();

            // The native side already sorts by totalMinutes desc,
            // but we re-sort to be safe
            const sorted = [...raw].sort(
                (a, b) => b.totalMinutes - a.totalMinutes
            );

            // The top app's minutes = 100% for relative progress bars
            const maxMinutes = sorted[0]?.totalMinutes ?? 1;

            const formatted: FormattedAppUsage[] = sorted.map((stat) => ({
                ...stat,
                formattedTime: formatMinutes(stat.totalMinutes),
                relativeUsage:
                    maxMinutes > 0 ? stat.totalMinutes / maxMinutes : 0,
            }));

            setData(formatted);
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to fetch usage stats";
            setError(message);
            setData([]);
        } finally {
            setIsLoading(false);
        }
    }, [enabled]);

    // Fetch on mount and whenever `enabled` changes to true
    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return { data, isLoading, error, refetch: fetchStats };
}
