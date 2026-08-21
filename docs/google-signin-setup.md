# Google Sign-In Setup Guide

Reference notes for wiring up Google Sign-In correctly the first time, on both Android (native) and web.

## Android (React Native / Expo)

### 1. Google Cloud Console setup (do this before writing code)

- Create/select a project at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
- Configure the OAuth consent screen (app name, scopes, test users if unpublished)
- Create a **Web application** OAuth client — its Client ID is what you pass as `webClientId` in code (needed to get a server-verifiable ID token, e.g. for Supabase/Firebase auth)
- Create an **Android** OAuth client for *every signing key* you'll use:
  - Package name (must match `android.package` in your app config)
  - SHA-1 fingerprint of that specific keystore

### 2. Enumerate every keystore you'll sign with — register all of them up front

Each keystore has a distinct SHA-1, and each needs its own Android OAuth client entry (or an additional fingerprint added to the same one):

| Keystore | Where it comes from | How to get the SHA-1 |
|---|---|---|
| Local debug builds | `~/.android/debug.keystore` (auto-generated) | `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android` |
| EAS/CI managed release keystore | EAS-managed credentials | `eas credentials` → Android → select keystore, or check the Expo dashboard's Credentials page |
| Play Store signing key | Only if Play App Signing is enabled — Google re-signs your AAB with a key you don't control | Play Console → Setup → App signing (available *after* first upload) |

Forgetting any one of these is the most common cause of Google Sign-In silently failing on a build that isn't the one you tested locally.

### 3. Wire up the library

```bash
npx expo install @react-native-google-signin/google-signin
```

```ts
import { GoogleSignin } from "@react-native-google-signin/google-signin";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID, // the WEB client ID, not Android
});
```

```ts
export async function signInWithGoogle() {
  await GoogleSignin.hasPlayServices();

  const userInfo = await GoogleSignin.signIn();
  const idToken = userInfo.data?.idToken;

  if (!idToken) throw new Error("No Google ID token returned");

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });

  if (error) throw error;
  return data;
}
```

The Android OAuth client is never referenced directly in code — it just needs to *exist* (package name + SHA-1 match) so Google recognizes the calling app as legitimate.

### 4. Surface errors instead of swallowing them

```ts
try {
  await signInWithGoogle();
} catch (error: any) {
  console.log("Google Sign-In Error:", error);
  Alert.alert("Sign-in failed", `${error.code ?? ""} ${error.message ?? "Unknown error"}`);
}
```

`DEVELOPER_ERROR` (code 10) specifically means "fingerprint/package not registered for this OAuth client" — surfacing the code turns a silent hang into a diagnosable error in seconds.

### 5. Test the exact artifact you'll ship

Sideload the actual signed APK/AAB before shipping and test sign-in on it — "worked in dev" does not guarantee it works on a differently-signed build.

### 6. Re-check whenever the signing key changes

Rotating keystores, switching CI/build providers, or enabling Play App Signing for the first time all introduce a new SHA-1 that needs registering. Treat this as a checklist item whenever build signing changes.

---

## Web

### 1. Google Cloud Console setup

- Same project as above (or a new one)
- Create a **Web application** OAuth client:
  - **Authorized JavaScript origins**: every origin your app is served from (e.g. `http://localhost:3000`, `https://yourapp.com`) — no path, no trailing slash
  - **Authorized redirect URIs**: only needed for the redirect-based OAuth flow (see below), not for One Tap/token-based sign-in

There is no SHA-1 fingerprint concept on web — origin-based restrictions replace it.

### 2. Choose a flow

**Option A — Google Identity Services (GIS) token flow (recommended for most SPAs)**

Renders Google's Sign In button or One Tap prompt, returns an ID token client-side, which you then verify server-side.

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

```ts
window.google.accounts.id.initialize({
  client_id: WEB_CLIENT_ID,
  callback: handleCredentialResponse,
});

window.google.accounts.id.renderButton(
  document.getElementById("google-signin-btn"),
  { theme: "outline", size: "large" }
);

function handleCredentialResponse(response: { credential: string }) {
  const idToken = response.credential;
  // Send idToken to your backend / Supabase / Firebase for verification
}
```

```ts
// e.g. with Supabase
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: "google",
  token: idToken,
});
```

**Option B — OAuth 2.0 redirect flow (when you need server-side access to Google APIs, not just identity)**

Use when you need offline access, refresh tokens, or scopes beyond basic profile/email (e.g. Google Drive, Calendar). This requires the **redirect URI** to be registered in the OAuth client and typically goes through your backend or an auth provider's hosted flow (Supabase `supabase.auth.signInWithOAuth({ provider: "google" })`, Firebase `signInWithRedirect`, NextAuth, etc.) rather than being hand-rolled.

```ts
// Supabase example
const { error } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: "https://yourapp.com/auth/callback" },
});
```

### 3. Common pitfalls on web

- **Origin mismatch**: `http://localhost:3000` and `http://127.0.0.1:3000` are treated as different origins — register whichever you actually browse to during dev.
- **Missing origin in production**: forgetting to add the production domain after testing only on localhost.
- **Mixing up client types**: using an Android/iOS client ID in web code (or vice versa) — the Web client ID is the only one valid for browser-based flows.
- **Third-party cookie blocking**: One Tap and some redirect flows can be affected by browser third-party-cookie restrictions (Safari ITP, Chrome's phase-out) — test in the actual target browsers, not just Chrome with defaults.

---

## Quick comparison

| | Android (native) | Web |
|---|---|---|
| Client type used | Web client ID (for token) + Android client (for app verification) | Web client ID only |
| App identity verified by | Package name + SHA-1 fingerprint | Authorized JS origin / redirect URI |
| Common failure | `DEVELOPER_ERROR` — SHA-1 not registered for the signing key in use | Origin not in "Authorized JavaScript origins" |
| Gotcha to remember | Every keystore (debug, release, Play App Signing) needs its own registered SHA-1 | Every origin you actually serve from (including each `localhost` port) needs to be registered |
