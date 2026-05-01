import React from "react";
import {
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ── Brand Colors ───────────────────────────────────────────────────────────

const NAVY = "#1C2765";
const BLUE = "#4F599E";
const WHITE = "#FFFFFF";

// ── Types ──────────────────────────────────────────────────────────────────

type Props = {
    /**
     * Whether the user has previously completed the permission flow.
     * - false → first-time onboarding (educational, welcoming tone)
     * - true  → permission was revoked (calm, factual tone)
     */
    onboardingCompleted: boolean;
    /** Callback to open Android Usage Access settings */
    onOpenSettings: () => void;
};

// ── Feature Bullets ────────────────────────────────────────────────────────

const FEATURES = [
    {
        icon: "📊",
        title: "Track App Usage",
        description: "See exactly which apps are consuming your data",
    },
    {
        icon: "💡",
        title: "Smart Insights",
        description: "Get personalized tips to reduce data waste",
    },
    {
        icon: "💰",
        title: "Save Money",
        description: "Find the best data bundles for your usage pattern",
    },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function UsagePermissionScreen({
    onboardingCompleted,
    onOpenSettings,
}: Props) {
    const insets = useSafeAreaInsets();

    // Adjust copy based on whether this is first-time or revoked
    const title = onboardingCompleted
        ? "Permission Required"
        : "Enable Usage Access";

    const subtitle = onboardingCompleted
        ? "Usage access was revoked. DataWise needs this permission to show your app usage data and provide insights."
        : "DataWise needs access to your app usage data to track data consumption and provide smart savings recommendations.";

    const buttonLabel = onboardingCompleted
        ? "Re-enable Access"
        : "Grant Access";

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="light-content" backgroundColor={NAVY} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: insets.bottom + 24 },
                ]}
                showsVerticalScrollIndicator={false}
                bounces={false}>
                {/* ──── Top Section ──── */}
                <View style={styles.topSection}>
                    {/* Shield Icon */}
                    <View style={styles.iconContainer}>
                        <View style={styles.iconCircle}>
                            <Text style={styles.iconEmoji}>🛡️</Text>
                        </View>
                        {/* Subtle glow ring */}
                        <View style={styles.glowRing} />
                    </View>

                    {/* Title & Subtitle */}
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>
                </View>

                {/* ──── Feature Cards ──── */}
                <View style={styles.featuresSection}>
                    {FEATURES.map((feature) => (
                        <View key={feature.title} style={styles.featureCard}>
                            <View style={styles.featureIconWrapper}>
                                <Text style={styles.featureIcon}>{feature.icon}</Text>
                            </View>
                            <View style={styles.featureTextWrapper}>
                                <Text style={styles.featureTitle}>
                                    {feature.title}
                                </Text>
                                <Text style={styles.featureDescription}>
                                    {feature.description}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* ──── Bottom Section ──── */}
                <View style={styles.bottomSection}>
                    {/* CTA Button */}
                    <Pressable
                        onPress={onOpenSettings}
                        style={({ pressed }) => [
                            styles.ctaButton,
                            pressed && styles.ctaButtonPressed,
                        ]}
                    >
                        <Text style={styles.ctaButtonText}>{buttonLabel}</Text>
                    </Pressable>

                    {/* How-to hint */}
                    <View style={styles.hintCard}>
                        <Text style={styles.hintTitle}>How to grant access:</Text>
                        <Text style={styles.hintStep}>
                            1. Tap the button above to open Settings
                        </Text>
                        <Text style={styles.hintStep}>
                            2. Find and tap "DataWise" in the list
                        </Text>
                        <Text style={styles.hintStep}>
                            3. Toggle "Allow usage tracking" on
                        </Text>
                        <Text style={styles.hintStep}>
                            4. Come back to this app — it will refresh automatically
                        </Text>
                    </View>

                    {/* Privacy Note */}
                    <Text style={styles.privacyNote}>
                        🔒 Your data stays on your device. We never upload usage information.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: NAVY,
    },

    // ── Scroll wrapper ──
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },

    // ── Top ──
    topSection: {
        alignItems: "center",
        paddingHorizontal: 32,
        paddingTop: 48,
        paddingBottom: 32,
    },
    iconContainer: {
        width: 96,
        height: 96,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 28,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "rgba(79, 89, 158, 0.35)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
    },
    iconEmoji: {
        fontSize: 36,
    },
    glowRing: {
        position: "absolute",
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 1.5,
        borderColor: "rgba(79, 89, 158, 0.3)",
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: WHITE,
        textAlign: "center",
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        fontWeight: "400",
        color: "rgba(255, 255, 255, 0.65)",
        textAlign: "center",
        lineHeight: 22,
    },

    // ── Features ──
    featuresSection: {
        paddingHorizontal: 24,
        gap: 12,
        marginBottom: 24,
    },
    featureCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(79, 89, 158, 0.2)",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "rgba(79, 89, 158, 0.25)",
    },
    featureIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: "rgba(79, 89, 158, 0.3)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    featureIcon: {
        fontSize: 20,
    },
    featureTextWrapper: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 15,
        fontWeight: "700",
        color: WHITE,
        marginBottom: 3,
    },
    featureDescription: {
        fontSize: 13,
        fontWeight: "400",
        color: "rgba(255, 255, 255, 0.55)",
        lineHeight: 18,
    },

    // ── Bottom ──
    bottomSection: {
        paddingHorizontal: 24,
        gap: 16,
        marginTop: "auto",
    },
    ctaButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: WHITE,
        paddingVertical: 16,
        borderRadius: 14,
        gap: 8,
    },
    ctaButtonPressed: {
        opacity: 0.85,
        transform: [{ scale: 0.98 }],
    },
    ctaButtonText: {
        fontSize: 16,
        fontWeight: "700",
        color: NAVY,
    },
    hintCard: {
        backgroundColor: "rgba(79, 89, 158, 0.2)",
        borderWidth: 1,
        borderColor: "rgba(79, 89, 158, 0.25)",
        borderRadius: 12,
        padding: 14,
        gap: 4,
    },
    hintTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "rgba(255, 255, 255, 0.7)",
        marginBottom: 4,
    },
    hintStep: {
        fontSize: 12,
        fontWeight: "400",
        color: "rgba(255, 255, 255, 0.5)",
        lineHeight: 18,
    },
    privacyNote: {
        fontSize: 12,
        fontWeight: "400",
        color: "rgba(255, 255, 255, 0.4)",
        textAlign: "center",
        lineHeight: 18,
    },
});