import { signInWithGoogle } from "@/lib/auth";
import { Pressable, Text } from "react-native";

export default function GoogleSignInButton() {
    async function handleSignIn() {
        try {
            await signInWithGoogle();
            // No navigation needed — your RootLayout listens to session changes
        } catch (error) {
            console.log("Google Sign-In Error:", error);
        }
    }

    return (
        <Pressable
            onPress={handleSignIn}
            style={{
                backgroundColor: "#FFFFFF",
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 10,
            }}
        >
            <Text style={{ color: "#1C2765", fontWeight: "700", fontSize: 16 }}>
                Continue with Google
            </Text>
        </Pressable>
    );
}