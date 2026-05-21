import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  isChecking: boolean;
  onRetry: () => void;
};

export default function NetworkErrorScreen({ isChecking, onRetry }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0B1020" />

      <View style={styles.content}>
        <View style={styles.iconFrame}>
          <MaterialCommunityIcons name="wifi-off" size={42} color="#FFFFFF" />
        </View>

        <Text style={styles.eyebrow}>Network error</Text>
        <Text style={styles.title}>No network</Text>
        <Text style={styles.description}>
          Not connected to internet. Check your network and try again.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isChecking}
        onPress={onRetry}
        style={({ pressed }) => [
          styles.retryButton,
          pressed && !isChecking && styles.retryButtonPressed,
          isChecking && styles.retryButtonDisabled,
        ]}
      >
        {isChecking ? (
          <ActivityIndicator color="#0B1020" />
        ) : (
          <Text style={styles.retryButtonText}>Try again</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1020",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  iconFrame: {
    alignItems: "center",
    backgroundColor: "rgba(236, 72, 153, 0.16)",
    borderColor: "rgba(236, 72, 153, 0.28)",
    borderRadius: 28,
    borderWidth: 1,
    height: 88,
    justifyContent: "center",
    marginBottom: 28,
    width: 88,
  },
  eyebrow: {
    color: "#F472B6",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 12,
  },
  description: {
    color: "#CBD5E1",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 360,
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    height: 56,
    justifyContent: "center",
  },
  retryButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  retryButtonDisabled: {
    opacity: 0.72,
  },
  retryButtonText: {
    color: "#0B1020",
    fontSize: 16,
    fontWeight: "700",
  },
});
