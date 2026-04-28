import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import UsageAccess from "@/native/UsageAccess";

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * AsyncStorage key for onboarding state.
 * This only records whether the user has *ever* seen the permission prompt,
 * so we can adjust the copy (educational vs. "permission revoked").
 * It is NOT used to decide whether to show/hide the permission screen.
 */
const ONBOARDING_KEY = "@datawise/onboarding_completed";

// ── Types ──────────────────────────────────────────────────────────────────

export type UsagePermissionState = {
    /** True if Android Usage Access is currently granted (source of truth). */
    hasPermission: boolean;
    /** True while we're doing the initial permission + AsyncStorage check. */
    isLoading: boolean;
    /**
     * True if the user has been through the permission flow at least once.
     * Used to show different copy on the permission screen:
     * - false → first-time onboarding (educational)
     * - true  → permission was revoked (calmer tone)
     */
    onboardingCompleted: boolean;
    /** Open the Android Usage Access settings page. */
    openSettings: () => void;
};

// ── Hook ───────────────────────────────────────────────────────────────────

export function useUsagePermission(): UsagePermissionState {
    const [hasPermission, setHasPermission] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [onboardingCompleted, setOnboardingCompleted] = useState(false);

    // Track previous permission state to detect false → true transitions
    const prevPermission = useRef(false);

    /**
     * Check the actual native permission.
     * This is synchronous on the native side (AppOpsManager check),
     * so there's no async delay.
     */
    const checkNativePermission = useCallback(() => {
        try {
            const granted = UsageAccess.hasUsageAccess();
            setHasPermission(granted);

            // When permission transitions from denied → granted,
            // mark onboarding as completed in AsyncStorage
            if (granted && !prevPermission.current) {
                AsyncStorage.setItem(ONBOARDING_KEY, "true").catch(() => {
                    // Non-critical — if this fails, the only effect is that
                    // the permission screen will show "first-time" copy next time
                });
                setOnboardingCompleted(true);
            }

            prevPermission.current = granted;
        } catch {
            // If the native module throws (e.g. on web), default to false
            setHasPermission(false);
        }
    }, []);

    /**
     * Load the onboarding flag from AsyncStorage.
     * This only runs once on mount.
     */
    const loadOnboardingFlag = useCallback(async () => {
        try {
            const value = await AsyncStorage.getItem(ONBOARDING_KEY);
            setOnboardingCompleted(value === "true");
        } catch {
            // If AsyncStorage fails, default to false (show onboarding copy)
            setOnboardingCompleted(false);
        }
    }, []);

    // ── Initial load: check permission + read onboarding flag ──
    useEffect(() => {
        const init = async () => {
            checkNativePermission();
            await loadOnboardingFlag();
            setIsLoading(false);
        };
        init();
    }, [checkNativePermission, loadOnboardingFlag]);

    // ── Re-check permission whenever the app returns to foreground ──
    // This catches two scenarios:
    //   1. User granted permission in settings and came back
    //   2. User revoked permission from settings while the app was in background
    useEffect(() => {
        const handleAppStateChange = (nextState: AppStateStatus) => {
            if (nextState === "active") {
                checkNativePermission();
            }
        };

        const subscription = AppState.addEventListener(
            "change",
            handleAppStateChange
        );

        return () => subscription.remove();
    }, [checkNativePermission]);

    // ── Open Android settings ──
    const openSettings = useCallback(() => {
        UsageAccess.openUsageAccessSettings();
    }, []);

    return {
        hasPermission,
        isLoading,
        onboardingCompleted,
        openSettings,
    };
}
