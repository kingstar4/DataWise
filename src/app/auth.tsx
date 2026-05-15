import GoogleSignInButton from "@/components/googleSiginBtn";
import { Text, View } from "react-native";

export default function AuthScreen() {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: "#0B1020",
                padding: 24,
                justifyContent: "center",
            }}
        >
            {/* App Title */}
            <Text
                style={{
                    color: "#FFFFFF",
                    fontSize: 32,
                    fontWeight: "800",
                    marginBottom: 12,
                }}
            >
                DataWise
            </Text>

            {/* Subtitle */}
            <Text
                style={{
                    color: "#94A3B8",
                    fontSize: 16,
                    marginBottom: 40,
                }}
            >
                Track your data. Save smarter.
            </Text>

            {/* Google Button */}
            <GoogleSignInButton />
        </View>
    );
}