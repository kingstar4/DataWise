import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, HeroHeader, SensitiveValue, ThemeToggle } from "@/components/ui";
import {
  BorderRadius,
  BottomTabInset,
  Fonts,
  Spacing,
} from "@/constants/theme";
import { useThemeMode } from "@/context/ThemeContext";
import { useTheme } from "@/hooks/use-theme";
import { usePremiumInsights } from "@/hooks/usePremiumInsights";
import { platformCapabilities } from "@/lib/platform-capabilities";

function formatCurrency(value: number) {
  return `₦${Math.round(value).toLocaleString()}`;
}

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getPriorityColor(priority: "high" | "medium" | "low") {
  if (priority === "high") return "#EF4444";
  if (priority === "medium") return "#F59E0B";
  return "#6366F1";
}

export default function PremiumScreen() {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const {
    budget,
    monthlySpend,
    monthlyGb,
    averagePricePerGb,
    purchaseCount,
    activeBundles,
    phoneNumbers,
    recommendations,
    loading,
    error,
    refetch,
    saveBudget,
    savePhoneNumber,
    saveManualCheckin,
  } = usePremiumInsights();

  const [refreshing, setRefreshing] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [networkInput, setNetworkInput] = useState("");
  const [checkinInput, setCheckinInput] = useState("");
  const [checkinUnit, setCheckinUnit] = useState<"GB" | "MB">("GB");
  const [saving, setSaving] = useState(false);

  const budgetAmount = budget?.amount ?? 5000;
  const budgetUsedPercent = Math.min(
    100,
    Math.round((monthlySpend / budgetAmount) * 100),
  );
  const insightSource = platformCapabilities.automaticUsageTracking
    ? "Automatic usage + purchase history"
    : "Purchase history + manual check-ins";

  const activeBundle = activeBundles[0] ?? null;

  const summaryCopy = useMemo(() => {
    if (purchaseCount === 0) {
      return "Start buying data with DataWise to unlock budget and bundle recommendations.";
    }

    if (averagePricePerGb) {
      return `${monthlyGb.toFixed(1)} GB bought this month at about ${formatCurrency(averagePricePerGb)}/GB.`;
    }

    return `${purchaseCount} successful data purchase${purchaseCount === 1 ? "" : "s"} this month.`;
  }, [averagePricePerGb, monthlyGb, purchaseCount]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleSaveBudget = useCallback(async () => {
    const amount = Number(budgetInput.replace(/[^\d]/g, ""));
    if (!amount || amount < 500) {
      Alert.alert(
        "Invalid budget",
        "Enter a monthly data budget of at least ₦500.",
      );
      return;
    }

    setSaving(true);
    try {
      await saveBudget(amount);
      setBudgetInput("");
      Alert.alert(
        "Budget saved",
        `Monthly data budget set to ${formatCurrency(amount)}.`,
      );
    } catch (err: any) {
      Alert.alert("Could not save budget", err.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }, [budgetInput, saveBudget]);

  const handleSaveNumber = useCallback(async () => {
    const digits = phoneInput.replace(/\D/g, "");
    if (digits.length < 10) {
      Alert.alert("Invalid number", "Enter a Nigerian phone number.");
      return;
    }

    if (!networkInput.trim()) {
      Alert.alert("Network required", "Enter MTN, Airtel, Glo, or 9mobile.");
      return;
    }

    setSaving(true);
    try {
      await savePhoneNumber({
        label: phoneNumbers.length === 0 ? "Primary" : "Saved number",
        phoneNumber: digits,
        network: networkInput,
        isDefault: phoneNumbers.length === 0,
      });
      setPhoneInput("");
      setNetworkInput("");
      Alert.alert(
        "Number saved",
        "DataWise can now track spend for this number.",
      );
    } catch (err: any) {
      Alert.alert("Could not save number", err.message ?? "Please try again.");
    } finally {
      setSaving(false);
    }
  }, [networkInput, phoneInput, phoneNumbers.length, savePhoneNumber]);

  const handleSaveCheckin = useCallback(async () => {
    const remainingValue = Number(checkinInput);
    const remainingGb =
      checkinUnit === "MB" ? remainingValue / 1024 : remainingValue;

    if (!Number.isFinite(remainingGb) || remainingGb < 0) {
      Alert.alert(
        "Invalid check-in",
        "Enter remaining data, for example 1.5 GB or 750 MB.",
      );
      return;
    }

    setSaving(true);
    try {
      await saveManualCheckin({
        bundlePurchaseId: activeBundle?.id ?? null,
        remainingGb,
      });
      setCheckinInput("");
      Alert.alert(
        "Check-in saved",
        `Your next recommendation will use this ${checkinUnit.toLowerCase()} balance.`,
      );
    } catch (err: any) {
      Alert.alert(
        "Could not save check-in",
        err.message ?? "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }, [activeBundle?.id, checkinInput, checkinUnit, saveManualCheckin]);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#6366F1"
          colors={["#6366F1"]}
          progressBackgroundColor={theme.card}
        />
      }
    >
      <HeroHeader style={{ paddingTop: insets.top + Spacing.four }}>
        <View style={styles.heroTitleRow}>
          <View style={styles.heroText}>
            <Text style={styles.heroLabel}>PREMIUM INTELLIGENCE</Text>
            <Text style={styles.heroTitle}>Plan smarter</Text>
            <Text style={styles.heroSub}>{summaryCopy}</Text>
          </View>
          <ThemeToggle variant="hero" size={20} />
        </View>

        <View style={styles.sourcePill}>
          <Ionicons name="analytics" size={14} color="#C7D2FE" />
          <Text style={styles.sourceText}>{insightSource}</Text>
        </View>
      </HeroHeader>

      <View style={[styles.content, { marginTop: -Spacing.three }]}>
        {loading && (
          <Card style={styles.loadingCard}>
            <ActivityIndicator color="#6366F1" />
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>
              Preparing your insights...
            </Text>
          </Card>
        )}

        {!!error && (
          <Card style={[styles.noticeCard, { borderColor: "#F59E0B" }]}>
            <Ionicons name="warning" size={18} color="#F59E0B" />
            <Text style={[styles.noticeText, { color: theme.textMuted }]}>
              {error}
            </Text>
          </Card>
        )}

        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
              Spent this month
            </Text>
            <SensitiveValue>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {formatCurrency(monthlySpend)}
              </Text>
            </SensitiveValue>
            <Text style={[styles.metricSub, { color: theme.textMuted }]}>
              {budgetUsedPercent}% of {formatCurrency(budgetAmount)}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <Text style={[styles.metricLabel, { color: theme.textMuted }]}>
              Data bought
            </Text>
            <Text style={[styles.metricValue, { color: "#10B981" }]}>
              {monthlyGb.toFixed(1)} GB
            </Text>
            <Text style={[styles.metricSub, { color: theme.textMuted }]}>
              {purchaseCount} purchase{purchaseCount === 1 ? "" : "s"}
            </Text>
          </Card>
        </View>

        <Card style={styles.budgetCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Monthly budget
              </Text>
              <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
                Track spend before it gets expensive.
              </Text>
            </View>
            <View
              style={[
                styles.iconChip,
                { backgroundColor: isDark ? "#1a1040" : "#eef2ff" },
              ]}
            >
              <Ionicons name="wallet" size={16} color="#6366F1" />
            </View>
          </View>
          <View
            style={[
              styles.progressTrack,
              { backgroundColor: isDark ? "#25304F" : "#E2E8F0" },
            ]}
          >
            <View
              style={[styles.progressFill, { width: `${budgetUsedPercent}%` }]}
            />
          </View>
          <View style={styles.inputRow}>
            <TextInput
              value={budgetInput}
              onChangeText={setBudgetInput}
              keyboardType="numeric"
              placeholder={`Current: ${formatCurrency(budgetAmount)}`}
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
            <Pressable
              onPress={handleSaveBudget}
              disabled={saving}
              style={({ pressed }) => [
                styles.smallButton,
                (pressed || saving) && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.smallButtonText}>Save</Text>
            </Pressable>
          </View>
        </Card>

        <View style={styles.sectionHeaderOutside}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Recommendations
          </Text>
          <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
            Based on purchases and saved plans
          </Text>
        </View>

        {recommendations.map((item) => (
          <Card key={item.id} style={styles.recommendationCard}>
            <View
              style={[
                styles.priorityDot,
                { backgroundColor: getPriorityColor(item.priority) },
              ]}
            />
            <View style={styles.recommendationBody}>
              <Text style={[styles.recommendationTitle, { color: theme.text }]}>
                {item.title}
              </Text>
              <Text
                style={[styles.recommendationText, { color: theme.textMuted }]}
              >
                {item.message}
              </Text>
            </View>
          </Card>
        ))}

        <Card style={styles.budgetCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Saved numbers
              </Text>
              <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
                Track family or business data separately.
              </Text>
            </View>
            <View
              style={[
                styles.iconChip,
                { backgroundColor: isDark ? "#0a1f18" : "#ecfdf5" },
              ]}
            >
              <Ionicons name="people" size={16} color="#10B981" />
            </View>
          </View>

          {phoneNumbers.map((phone) => (
            <View
              key={phone.id}
              style={[styles.savedRow, { borderTopColor: theme.border }]}
            >
              <View>
                <Text style={[styles.savedTitle, { color: theme.text }]}>
                  {phone.label}
                </Text>
                <Text style={[styles.savedSub, { color: theme.textMuted }]}>
                  {phone.phoneNumber}{" "}
                  {phone.network ? `· ${phone.network}` : ""}
                </Text>
              </View>
              {phone.isDefault && (
                <Text style={styles.defaultBadge}>Default</Text>
              )}
            </View>
          ))}

          <View style={styles.doubleInputRow}>
            <TextInput
              value={phoneInput}
              onChangeText={setPhoneInput}
              keyboardType="phone-pad"
              placeholder="08012345678"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                styles.flexInput,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
            <TextInput
              value={networkInput}
              onChangeText={setNetworkInput}
              placeholder="MTN"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                styles.networkInput,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
          </View>
          <Pressable
            onPress={handleSaveNumber}
            disabled={saving}
            style={({ pressed }) => [
              styles.fullButton,
              (pressed || saving) && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.fullButtonText}>Save number</Text>
          </Pressable>
        </Card>

        <Card style={styles.budgetCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Active bundle
              </Text>
              <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
                Manual check-ins improve iOS recommendations.
              </Text>
            </View>
          </View>

          {activeBundle ? (
            <View
              style={[
                styles.bundleBox,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.bundleTitle, { color: theme.text }]}>
                {activeBundle.planName}
              </Text>
              <Text style={[styles.bundleSub, { color: theme.textMuted }]}>
                {activeBundle.dataGb.toFixed(1)} GB · expires{" "}
                {formatDate(activeBundle.expiresAt)}
              </Text>
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No active DataWise bundle found for this month.
            </Text>
          )}

          <View style={styles.inputRow}>
            <TextInput
              value={checkinInput}
              onChangeText={setCheckinInput}
              keyboardType="decimal-pad"
              placeholder="Remaining data"
              placeholderTextColor={theme.textMuted}
              style={[
                styles.input,
                styles.checkinInput,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
            <View style={[styles.unitToggle, { backgroundColor: theme.background, borderColor: theme.border }]}>
              {(["GB", "MB"] as const).map((unit) => {
                const selected = checkinUnit === unit;
                return (
                  <Pressable
                    key={unit}
                    onPress={() => setCheckinUnit(unit)}
                    style={[
                      styles.unitButton,
                      selected && { backgroundColor: "#6366F1" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.unitButtonText,
                        { color: selected ? "#FFFFFF" : theme.textMuted },
                      ]}
                    >
                      {unit}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={handleSaveCheckin}
              disabled={saving}
              style={({ pressed }) => [
                styles.smallButton,
                (pressed || saving) && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.smallButtonText}>Check in</Text>
            </Pressable>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  heroTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.three,
  },
  heroText: { flex: 1, paddingRight: Spacing.three },
  heroLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: "rgba(255,255,255,0.45)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 34,
    fontFamily: Fonts.extraBold,
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  heroSub: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 20,
    marginTop: 6,
  },
  sourcePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  sourceText: {
    color: "#C7D2FE",
    fontFamily: Fonts.semiBold,
    fontSize: 11,
  },
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  loadingText: { fontSize: 13, fontFamily: Fonts.medium },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
    borderWidth: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.medium,
    lineHeight: 18,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  metricCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.three,
  },
  metricLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 22,
    fontFamily: Fonts.numberBold,
    letterSpacing: -0.7,
  },
  metricSub: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    marginTop: 4,
  },
  budgetCard: {
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.three,
  },
  sectionHeaderOutside: {
    gap: 2,
    paddingHorizontal: Spacing.one,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
  iconChip: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: 8,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: BorderRadius.full,
    backgroundColor: "#6366F1",
  },
  inputRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  doubleInputRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: Fonts.numberRegular,
  },
  flexInput: { flex: 1 },
  networkInput: { width: 94, flex: 0 },
  checkinInput: {
    minWidth: 0,
  },
  unitToggle: {
    minHeight: 46,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    padding: 3,
    flexDirection: "row",
  },
  unitButton: {
    minWidth: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  unitButtonText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
  },
  smallButton: {
    minWidth: 92,
    minHeight: 46,
    borderRadius: BorderRadius.md,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  smallButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  fullButton: {
    minHeight: 46,
    borderRadius: BorderRadius.md,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
  },
  fullButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  recommendationCard: {
    flexDirection: "row",
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: BorderRadius.lg,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  recommendationBody: { flex: 1 },
  recommendationTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    lineHeight: 18,
  },
  savedRow: {
    borderTopWidth: 1,
    paddingTop: Spacing.two,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  savedTitle: {
    fontSize: 13,
    fontFamily: Fonts.bold,
  },
  savedSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
  defaultBadge: {
    color: "#10B981",
    fontSize: 11,
    fontFamily: Fonts.bold,
  },
  bundleBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: 12,
  },
  bundleTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  bundleSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    lineHeight: 18,
  },
});
