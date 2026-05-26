import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, SensitiveValue, ThemeToggle } from "@/components/ui";
import {
  BorderRadius,
  BottomTabInset,
  Fonts,
  Spacing,
} from "@/constants/theme";
import { useThemeMode } from "@/context/ThemeContext";
import { useWalletContext } from "@/context/WalletContext";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";
import type { BundlePlan } from "@/types/payments";

// ── Quick amounts ──────────────────────────────────────────────────────────

const QUICK_AMOUNTS = [1000, 2000, 3000, 5000] as const;

WebBrowser.maybeCompleteAuthSession();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const PAYSTACK_CALLBACK_PATH = "/paystack-callback";
const FLUTTERWAVE_CALLBACK_PATH = "/flutterwave-callback";
type PayMethod = "paystack" | "flutterwave";

function formatPlanSize(gb: number, name: string) {
  if (gb >= 1) return `${gb.toLocaleString()} GB`;

  const namedSize = name.match(/(\d+(?:\.\d+)?)\s*MB/i);
  if (namedSize) return `${namedSize[1]} MB`;

  return `${Math.round(gb * 1024).toLocaleString()} MB`;
}

function getVerificationMessage(verification: any, provider = "Gateway") {
  const parts = [
    verification?.payment_status
      ? `${provider} status: ${verification.payment_status}`
      : null,
    verification?.gateway_response
      ? `Gateway: ${verification.gateway_response}`
      : null,
    verification?.error ? `Message: ${verification.error}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? `\n\n${parts.join("\n")}` : "";
}

async function fetchCurrentWalletBalance() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return Math.round((data.balance as number) / 100);
}

export default function WalletFundScreen() {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ── Real wallet balance ──
  const {
    balance: walletBalance,
    loading: walletLoading,
    refetch,
  } = useWalletContext();

  // ── Paystack loading state ──
  const [initiating, setInitiating] = useState(false);
  const [waitingForCredit, setWaitingForCredit] = useState(false);

  // ── Route params ──
  const params = useLocalSearchParams<{
    planId: string;
    planName: string;
    planGb: string;
    planPrice: string;
    planValidity: string;
    planUssd: string;
    planPricePerGb: string;
    carrierName: string;
    projectedGB: string;
  }>();

  const plan: BundlePlan = useMemo(
    () => ({
      id: params.planId ?? "",
      name: params.planName ?? "",
      gb: Number(params.planGb) || 0,
      price: Number(params.planPrice) || 0,
      validity: Number(params.planValidity) || 30,
      ussdCode: params.planUssd ?? "",
      pricePerGb: Number(params.planPricePerGb) || 0,
    }),
    [params],
  );
  const planSize = formatPlanSize(plan.gb, plan.name);

  // ── Amount selection ──
  const smartDefault = useMemo(() => {
    const gap = plan.price - walletBalance;
    if (gap <= 0) return QUICK_AMOUNTS[0];
    return (
      QUICK_AMOUNTS.find((a) => a >= gap) ??
      QUICK_AMOUNTS[QUICK_AMOUNTS.length - 1]
    );
  }, [plan.price, walletBalance]);

  const [selectedAmount, setSelectedAmount] = useState<number>(smartDefault);
  const [customAmount, setCustomAmount] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  // Update smart default when real balance loads
  useEffect(() => {
    if (!walletLoading) {
      const gap = plan.price - walletBalance;
      if (gap <= 0) {
        setSelectedAmount(QUICK_AMOUNTS[0]);
      } else {
        setSelectedAmount(
          QUICK_AMOUNTS.find((a) => a >= gap) ??
            QUICK_AMOUNTS[QUICK_AMOUNTS.length - 1],
        );
      }
    }
  }, [walletLoading, walletBalance, plan.price]);

  const effectiveAmount = isCustom
    ? parseInt(customAmount, 10) || 0
    : selectedAmount;
  const newBalance = walletBalance + effectiveAmount;
  const canAfford = newBalance >= plan.price;
  const gap = plan.price - newBalance;

  // ── Pay method ──
  const [payMethod, setPayMethod] = useState<PayMethod>("paystack");

  // ── Subtitle text ──
  const subtitleText = useMemo(() => {
    if (walletLoading) return "Loading balance...";
    if (effectiveAmount <= 0)
      return `Need ₦${(plan.price - walletBalance).toLocaleString()} more for ${plan.name}`;
    if (canAfford)
      return `Balance after top-up: ₦${newBalance.toLocaleString()} — ready to buy`;
    return `Balance after top-up: ₦${newBalance.toLocaleString()} — need ₦${Math.abs(gap).toLocaleString()} more`;
  }, [
    effectiveAmount,
    canAfford,
    newBalance,
    gap,
    plan,
    walletBalance,
    walletLoading,
  ]);

  // ── Quick amount press ──
  const handleQuickAmount = useCallback((amount: number) => {
    setSelectedAmount(amount);
    setIsCustom(false);
    setCustomAmount("");
  }, []);

  // ── Custom amount input ──
  const handleCustomInput = useCallback((value: string) => {
    setCustomAmount(value);
    setIsCustom(true);
  }, []);

  const navigateToWallet = useCallback(() => {
    router.replace("/(tabs)/wallet" as any);
  }, [router]);

  // ── Confirm — calls initiate-topup edge function and opens Paystack ──
  const handleConfirm = useCallback(async () => {
    if (effectiveAmount < 100) {
      Alert.alert("Invalid amount", "Minimum top-up is ₦100");
      return;
    }

    setInitiating(true);

    try {
      const startingBalance = walletBalance;
      const isFlutterwave = payMethod === "flutterwave";
      const providerName = isFlutterwave ? "Flutterwave" : "Paystack";
      const baseCallbackUrl = Linking.createURL(
        isFlutterwave ? FLUTTERWAVE_CALLBACK_PATH : PAYSTACK_CALLBACK_PATH,
      );

      const { data, error } = await supabase.functions.invoke(
        isFlutterwave ? "initiate-flutterwave-topup" : "initiate-topup",
        {
          body: {
            amount_ngn: effectiveAmount,
            callback_url: baseCallbackUrl,
          },
        },
      );

      if (error) throw error;
      if (!data?.authorization_url) throw new Error("No payment URL returned");

      const callbackUrl =
        isFlutterwave && data.reference
          ? `${baseCallbackUrl}${baseCallbackUrl.includes("?") ? "&" : "?"}reference=${encodeURIComponent(data.reference)}`
          : baseCallbackUrl;

      const browserResult = await WebBrowser.openAuthSessionAsync(
        data.authorization_url,
        callbackUrl,
        {
          showTitle: true,
          enableBarCollapsing: true,
        },
      );

      let flutterwaveTransactionId: string | undefined;
      if (isFlutterwave && browserResult.type === "success" && browserResult.url) {
        const parsed = Linking.parse(browserResult.url);
        const rawTransactionId = parsed.queryParams?.transaction_id;
        flutterwaveTransactionId = Array.isArray(rawTransactionId)
          ? rawTransactionId[0]
          : rawTransactionId
            ? String(rawTransactionId)
            : undefined;
      }

      setWaitingForCredit(true);
      let lastVerification: any = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const { data: verification, error: verifyError } =
          await supabase.functions.invoke(
            isFlutterwave ? "verify-flutterwave-topup" : "verify-topup",
            {
              body: {
                reference: data.reference ?? data.transaction_id,
                transaction_id: flutterwaveTransactionId,
              },
            },
          );

        if (verifyError) throw verifyError;
        lastVerification = verification;

        if (verification?.status === "success") {
          await refetch();
          Alert.alert(
            "Wallet funded",
            `₦${effectiveAmount.toLocaleString()} has been added to your wallet.`,
            [{ text: "OK", onPress: navigateToWallet }],
          );
          return;
        }

        if (verification?.status === "failed") {
          await refetch();
          Alert.alert(
            "Payment failed",
            `${providerName} did not complete this payment. Your wallet was not credited.`,
            [{ text: "OK", onPress: navigateToWallet }],
          );
          return;
        }

        await refetch();
        const latestBalance = await fetchCurrentWalletBalance();

        if (
          latestBalance !== null &&
          latestBalance >= startingBalance + effectiveAmount
        ) {
          Alert.alert(
            "Wallet funded",
            `₦${effectiveAmount.toLocaleString()} has been added to your wallet.`,
            [{ text: "OK", onPress: navigateToWallet }],
          );
          return;
        }

        await sleep(2000);
      }

      Alert.alert(
        "Payment pending",
        `If your ${providerName} payment was successful, your wallet will update once confirmation is received.${getVerificationMessage(lastVerification, providerName)}`,
        [{ text: "OK", onPress: navigateToWallet }],
      );
    } catch (e: any) {
      let errorMessage =
        e.message ?? "Could not initiate payment. Please try again.";

      // Extract the real error message if it's an HTTP error from the Edge Function
      if (e.name === "FunctionsHttpError" && e.context) {
        try {
          const body = await e.context.json();
          if (body?.error) {
            errorMessage = body.details
              ? `${body.error}: ${body.details}`
              : body.error;
            errorMessage += getVerificationMessage(
              body,
              payMethod === "flutterwave" ? "Flutterwave" : "Paystack",
            );
          }
        } catch {
          // Fallback if parsing fails
        }
      }

      Alert.alert("Payment failed", errorMessage, [
        { text: "OK", onPress: navigateToWallet },
      ]);
    } finally {
      setInitiating(false);
      setWaitingForCredit(false);
    }
  }, [effectiveAmount, navigateToWallet, payMethod, refetch, walletBalance]);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentContainerStyle={{
        paddingBottom: BottomTabInset + Spacing.four,
        paddingTop: insets.top,
      }}
    >
      {/* ──── Back nav + toggle ──── */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Ionicons name="chevron-back" size={20} color={theme.textMuted} />
          <Text style={[styles.backText, { color: theme.textMuted }]}>
            Back
          </Text>
        </Pressable>
        <ThemeToggle variant="surface" />
      </View>

      <Text style={[styles.pageTitle, { color: theme.text }]}>Fund wallet</Text>

      {/* ──── Wallet balance card ──── */}
      <View style={styles.section}>
        <Card style={styles.walletCard}>
          <Text style={[styles.walletLabel, { color: theme.textMuted }]}>
            CURRENT BALANCE
          </Text>
          {walletLoading ? (
            <ActivityIndicator color="#10B981" style={{ marginVertical: 8 }} />
          ) : (
            <SensitiveValue>
              <Text style={styles.walletBalance}>
                ₦{walletBalance.toLocaleString()}
              </Text>
            </SensitiveValue>
          )}
          <SensitiveValue style={styles.walletSubtitleToggle}>
            <Text style={[styles.walletSub, { color: theme.textMuted }]}>
              {subtitleText}
            </Text>
          </SensitiveValue>
        </Card>
      </View>

      {/* ──── Top up amount ──── */}
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
        TOP UP AMOUNT
      </Text>

      <View style={styles.amountGrid}>
        {QUICK_AMOUNTS.map((amount) => {
          const isActive = !isCustom && selectedAmount === amount;
          const amountNewBal = walletBalance + amount;
          const chipSub =
            plan.price > 0 && amountNewBal >= plan.price
              ? `covers ${planSize}`
              : "quick add";

          return (
            <Pressable
              key={amount}
              onPress={() => handleQuickAmount(amount)}
              style={[
                styles.amountChip,
                { backgroundColor: theme.card, borderColor: theme.border },
                isActive && {
                  borderColor: "#6366F1",
                  backgroundColor: isDark ? "rgba(22,30,56,1)" : "#eef2ff",
                },
              ]}
            >
              <Text style={[styles.amountValue, { color: theme.text }]}>
                ₦{amount.toLocaleString()}
              </Text>
              <Text style={[styles.amountSub, { color: theme.textMuted }]}>
                {chipSub}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Custom input */}
      <View style={styles.customInputWrap}>
        <TextInput
          value={customAmount}
          onChangeText={handleCustomInput}
          placeholder="Or enter custom amount (₦)"
          placeholderTextColor={theme.textMuted}
          keyboardType="numeric"
          style={[
            styles.customInput,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              color: theme.text,
            },
            isCustom && customAmount.length > 0 && { borderColor: "#6366F1" },
          ]}
        />
      </View>

      {/* ──── Pay via ──── */}
      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
        PAY VIA
      </Text>

      <View
        style={[
          styles.payMethodCard,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        {/* Paystack */}
        <Pressable
          onPress={() => setPayMethod("paystack")}
          style={[
            styles.payRow,
            styles.payRowDivider,
            { borderBottomColor: theme.border },
            payMethod === "paystack" && {
              backgroundColor: isDark ? "#0d1626" : theme.surfaceAlt,
            },
          ]}
        >
          <View
            style={[
              styles.payIcon,
              { backgroundColor: isDark ? "#1a1040" : "#eef2ff" },
            ]}
          >
            <Ionicons name="card" size={16} color="#6366F1" />
          </View>
          <View style={styles.payLabel}>
            <Text style={[styles.payLabelTitle, { color: theme.text }]}>
              Paystack
            </Text>
            <Text style={[styles.payLabelSub, { color: theme.textMuted }]}>
              Card or bank transfer
            </Text>
          </View>
          <View style={[styles.radio, payMethod === "paystack" && styles.radioSelected]}>
            {payMethod === "paystack" && <View style={styles.radioDot} />}
          </View>
        </Pressable>

        {/* Flutterwave */}
        <Pressable
          onPress={() => setPayMethod("flutterwave")}
          style={[
            styles.payRow,
            payMethod === "flutterwave" && {
              backgroundColor: isDark ? "#0d1626" : theme.surfaceAlt,
            },
          ]}
        >
          <View
            style={[
              styles.payIcon,
              { backgroundColor: isDark ? "#301708" : "#fff7ed" },
            ]}
          >
            <Ionicons name="flash" size={16} color="#F97316" />
          </View>
          <View style={styles.payLabel}>
            <Text style={[styles.payLabelTitle, { color: theme.text }]}>
              Flutterwave
            </Text>
            <Text style={[styles.payLabelSub, { color: theme.textMuted }]}>
              Card, bank, transfer or USSD
            </Text>
          </View>
          <View style={[styles.radio, payMethod === "flutterwave" && styles.radioSelected]}>
            {payMethod === "flutterwave" && <View style={styles.radioDot} />}
          </View>
        </Pressable>

        {/* Bank transfer */}
        {/*<Pressable
          onPress={() => setPayMethod(2)}
          style={[
            styles.payRow,
            { borderBottomColor: theme.border },
            payMethod === 2 && { backgroundColor: isDark ? '#0d1626' : theme.surfaceAlt },
          ]}>
          <View style={[styles.payIcon, { backgroundColor: isDark ? '#0a1f18' : '#ecfdf5' }]}>
            <Ionicons name="business" size={16} color="#10B981" />
          </View>
          <View style={styles.payLabel}>
            <Text style={[styles.payLabelTitle, { color: theme.text }]}>Bank transfer</Text>
            <Text style={[styles.payLabelSub, { color: theme.textMuted }]}>Direct to DataWise account</Text>
          </View>
          <View style={[styles.radio, payMethod === 2 && styles.radioSelected]}>
            {payMethod === 2 && <View style={styles.radioDot} />}
          </View>
        </Pressable>*/}
      </View>

      {/* ──── CTA ──── */}
      <View style={styles.ctaSection}>
        <Pressable
          onPress={handleConfirm}
          disabled={
            initiating ||
            waitingForCredit ||
            walletLoading ||
            effectiveAmount < 100
          }
          style={({ pressed }) => [
            styles.ctaButton,
            (pressed || initiating || waitingForCredit) && { opacity: 0.85 },
            effectiveAmount < 100 && { opacity: 0.5 },
          ]}
        >
          {initiating || waitingForCredit ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Confirm</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.ghostButton,
            { borderColor: theme.border },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={[styles.ghostText, { color: theme.textMuted }]}>
            Cancel
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  backRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  backText: { fontSize: 14, fontFamily: Fonts.medium },
  pageTitle: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  section: { paddingHorizontal: Spacing.three, marginBottom: Spacing.three },
  walletCard: { paddingVertical: Spacing.four },
  walletLabel: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  walletBalance: {
    fontSize: 32,
    fontFamily: Fonts.numberBold,
    color: "#10B981",
    letterSpacing: -1,
  },
  walletSub: { fontSize: 12, fontFamily: Fonts.regular, marginTop: 4 },
  walletSubtitleToggle: { maxWidth: "100%" },
  sectionLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
  amountGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  amountChip: {
    flex: 1,
    minWidth: "45%",
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  amountValue: { fontSize: 16, fontFamily: Fonts.numberBold },
  amountSub: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 3 },
  customInputWrap: {
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.four,
  },
  customInput: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    padding: 14,
    fontSize: 15,
    fontFamily: Fonts.numberRegular,
  },
  payMethodCard: {
    marginHorizontal: Spacing.three,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginBottom: Spacing.four,
  },
  payRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  payRowDivider: {
    borderBottomWidth: 1,
  },
  payIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  payLabel: { flex: 1 },
  payLabelTitle: { fontSize: 14, fontFamily: Fonts.semiBold },
  payLabelSub: { fontSize: 11, fontFamily: Fonts.regular },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#2a3a5c",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: "#6366F1", backgroundColor: "#6366F1" },
  radioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  ctaSection: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  ctaButton: {
    backgroundColor: "#6366F1",
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: 15, fontFamily: Fonts.bold, color: "#FFFFFF" },
  ghostButton: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  ghostText: { fontSize: 14, fontFamily: Fonts.semiBold },
});
