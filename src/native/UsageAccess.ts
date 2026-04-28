import { requireNativeModule } from "expo-modules-core";

// ── Types ──────────────────────────────────────────────────────────────────

/** A single app's screen-time stats for today. */
export type AppUsageStat = {
    /** Android package name, e.g. "com.instagram.android" */
    packageName: string;
    /** Human-readable app name resolved from PackageManager */
    appName: string;
    /** Total foreground time today in whole minutes */
    totalMinutes: number;
};

/** A single app's network data usage for a given period. */
export type AppDataUsageStat = {
    packageName: string;
    appName: string;
    /** Mobile data received (bytes) */
    mobileRxBytes: number;
    /** Mobile data sent (bytes) */
    mobileTxBytes: number;
    /** Wi-Fi data received (bytes) */
    wifiRxBytes: number;
    /** Wi-Fi data sent (bytes) */
    wifiTxBytes: number;
    /** Data used while app was in foreground (bytes) */
    foregroundBytes: number;
    /** Data used while app was in background (bytes) */
    backgroundBytes: number;
    /** Grand total bytes (mobile + wifi, rx + tx) */
    totalBytes: number;
    /** Base64-encoded PNG of the app's icon (48x48) */
    iconBase64: string;
};

/** Daily data usage totals for the bar chart. */
export type DailyDataUsage = {
    /** Day label, e.g. "Mon", "Tue" */
    label: string;
    /** Total bytes for the day */
    totalBytes: number;
    /** Mobile bytes for the day */
    mobileBytes: number;
    /** Wi-Fi bytes for the day */
    wifiBytes: number;
};

/** Peak-hours usage for a time window. */
export type PeakHourUsage = {
    /** Window name: "Morning", "Afternoon", "Evening", "Night" */
    period: string;
    /** Human-readable time range, e.g. "6 AM – 12 PM" */
    time: string;
    /** Total bytes used during this window */
    totalBytes: number;
};

type UsageAccessModuleType = {
    /**
     * Synchronously check whether the app has Android Usage Access permission.
     * This is the **source of truth** — never rely on AsyncStorage for this.
     */
    hasUsageAccess: () => boolean;

    /**
     * Open the Android Usage Access settings page so the user can grant permission.
     * The app will go to background; use AppState to detect when the user returns.
     */
    openUsageAccessSettings: () => void;

    /**
     * Get the mobile network carrier/operator name (e.g. "MTN", "Airtel").
     * Returns empty string if unavailable (e.g. no SIM, Wi-Fi only).
     */
    getCarrierName: () => string;

    /**
     * Fetch today's per-app screen-time stats (foreground time).
     * Returns an empty array if permission is not granted.
     * Results are sorted by totalMinutes descending.
     */
    getTodayUsageStats: () => Promise<AppUsageStat[]>;

    /**
     * Fetch per-app network data usage for a given period.
     * @param period - "today" | "week" | "month"
     * Returns per-app bytes with mobile/wifi and foreground/background breakdown.
     */
    getDataUsageStats: (period: string) => Promise<AppDataUsageStat[]>;

    /**
     * Fetch daily data usage totals for the last N days.
     * @param days - Number of days to query (e.g. 7 for a week)
     * Returns an array of daily totals for the bar chart.
     */
    getDailyDataUsage: (days: number) => Promise<DailyDataUsage[]>;

    /**
     * Fetch data usage broken down by time-of-day windows.
     * @param period - "today" | "week" | "month"
     * Returns 4 windows: Morning, Afternoon, Evening, Night.
     */
    getPeakHoursUsage: (period: string) => Promise<PeakHourUsage[]>;
};

const UsageAccess =
    requireNativeModule<UsageAccessModuleType>("UsageAccess");

export default UsageAccess;