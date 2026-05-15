import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { supabase } from "./supabase";

export async function signInWithGoogle() {
    await GoogleSignin.hasPlayServices();

    const userInfo = await GoogleSignin.signIn();

    const idToken = userInfo.data?.idToken;

    if (!idToken) {
        throw new Error("No Google ID token returned");
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
    });

    if (error) {
        throw error;
    }

    return data;
}