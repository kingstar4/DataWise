import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BorderRadius, Fonts, Spacing } from "@/constants/theme";
import { useWalletContext } from "@/context/WalletContext";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function FlutterwaveCallbackScreen() {
  const params = useLocalSearchParams<{
    reference?: string;
    status?: string;
    tx_ref?: string;
    txRef?: string;
    transaction_id?: string;
    transactionId?: string;
  }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { refetch } = useWalletContext();
  const [status, setStatus] = useState<"checking" | "success" | "pending" | "failed">(
    "checking",
  );
  const [message, setMessage] = useState("Confirming your wallet funding...");

  const reference = useMemo(() => {
    const rawReference = params.reference ?? params.tx_ref ?? params.txRef;
    return Array.isArray(rawReference) ? rawReference[0] : rawReference;
  }, [params.reference, params.tx_ref, params.txRef]);

  const transactionId = useMemo(() => {
    const rawTransactionId = params.transaction_id ?? params.transactionId;
    return Array.isArray(rawTransactionId) ? rawTransactionId[0] : rawTransactionId;
  }, [params.transaction_id, params.transactionId]);

  useEffect(() => {
    let cancelled = false;

    async function verifyPayment() {
      if (!reference) {
        setStatus("pending");
        setMessage("Payment reference was not returned. Check your wallet shortly.");
        await refetch();
        return;
      }

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const { data, error } = await supabase.functions.invoke(
          "verify-flutterwave-topup",
          {
            body: {
              reference,
              transaction_id: transactionId,
            },
          },
        );

        if (cancelled) return;

        if (error) {
          setStatus("pending");
          setMessage("Payment is still being confirmed. Check your wallet shortly.");
          await refetch();
          return;
        }

        if (data?.status === "success") {
          setStatus("success");
          setMessage("Your wallet has been funded.");
          await refetch();
          return;
        }

        if (data?.status === "failed") {
          setStatus("failed");
          setMessage("Flutterwave did not complete this payment.");
          await refetch();
          return;
        }

        await sleep(2000);
      }

      if (!cancelled) {
        setStatus("pending");
        setMessage("Payment is still being confirmed. Check your wallet shortly.");
        await refetch();
      }
    }

    verifyPayment();

    return () => {
      cancelled = true;
    };
  }, [reference, transactionId, refetch]);

  const iconName =
    status === "success"
      ? "checkmark-circle"
      : status === "failed"
        ? "close-circle"
        : "time";
  const iconColor =
    status === "success" ? "#10B981" : status === "failed" ? "#EF4444" : "#F59E0B";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + Spacing.four,
        },
      ]}
    >
      {status === "checking" ? (
        <ActivityIndicator color="#6366F1" size="large" />
      ) : (
        <Ionicons name={iconName} size={56} color={iconColor} />
      )}
      <Text style={[styles.title, { color: theme.text }]}>
        {status === "checking" ? "Confirming payment" : "Payment update"}
      </Text>
      <Text style={[styles.message, { color: theme.textMuted }]}>{message}</Text>

      <Pressable
        onPress={() => router.replace("/(tabs)/wallet" as any)}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: "#6366F1", opacity: pressed ? 0.86 : 1 },
        ]}
      >
        <Text style={styles.buttonText}>Go to wallet</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.extraBold,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    lineHeight: 20,
    textAlign: "center",
  },
  button: {
    marginTop: Spacing.two,
    minWidth: 180,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
});
