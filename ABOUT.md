# DataWise

### Your Intelligent Mobile Data Companion

---

## 📌 Overview

**DataWise** is a premium Android mobile application that empowers smartphone users to take complete control of their mobile data consumption. Built with React Native and Expo, DataWise provides real-time, per-app data usage analytics, intelligent cost-saving recommendations, and carrier-aware bundle suggestions — all powered by native Android APIs and running entirely on-device with zero data leaving the user's phone.

The app's **core data tracking features work on any Android device worldwide** — per-app usage monitoring, Wi-Fi vs. mobile breakdown, foreground/background analysis, and peak usage detection are all universal. Additionally, DataWise includes a **smart bundle recommendation engine** that is currently tailored for the Nigerian market (MTN, Airtel, Glo, and 9mobile), where prepaid data bundles dominate and mobile data is a significant monthly expense. When a supported carrier isn't detected, the recommendation card simply doesn't appear — the rest of the app functions perfectly.

DataWise bridges the gap between vague system-level data totals and truly understanding *where* your data is going, *when* you use it most, and *how* to spend less without changing your habits.

---

## 🧩 The Problem

### Mobile Data Usage is Invisible to Most Users

Regardless of where you live, Android's built-in data management tools are buried deep in settings menus and present information in a way that's difficult to act on. Users worldwide face several critical pain points:

#### 1. No Visibility Into Per-App Data Usage
Android's built-in data tracker shows a basic total, but most users never discover it. There is no easily accessible, well-designed interface that tells a user: *"Instagram used 2.1 GB this week, and 60% of that was background data you didn't know about."*

#### 2. Background Data Drain Is Silent and Costly
Many apps — social media, messaging, and streaming platforms — consume significant data in the background through auto-playing videos, pre-fetching content, syncing media, and push notifications. Users often exhaust their data allowances without any active usage, leading to frustration and unexpected costs.

#### 3. Wi-Fi vs. Mobile Data Blindspot
Many users don't realize how much data they consume on mobile networks vs. Wi-Fi. Understanding this split is crucial for cost optimization — if 70% of your usage is already on Wi-Fi, a smaller mobile plan would suffice.

#### 4. Time-of-Day Usage Patterns Are Unknown
Peak usage windows (e.g., heavy evening streaming, overnight background syncing) go unnoticed. Users cannot make informed decisions about when to restrict data or schedule downloads for Wi-Fi.

#### 5. No Connection Between Usage Patterns and Spending *(Especially in Prepaid Markets)*
In prepaid-dominant markets like Nigeria (220M+ mobile subscribers across MTN, Airtel, Glo, and 9mobile), the problem is amplified. Carrier apps and USSD menus show remaining balance but never correlate usage patterns with optimal plan selection. Users frequently:
- **Buy bundles that are too small**, leading to early exhaustion and emergency top-ups at worse per-GB rates.
- **Buy bundles that are too large**, paying for data they never use before it expires.
- **Default to the same plan every month** without knowing a better option exists for their actual usage pattern.

There is no tool that says: *"Based on your usage this week, you're on track to use 8.2 GB this month. Here's a plan that covers that and saves you money."*

---

## 💡 The Solution

DataWise transforms raw Android system data into actionable intelligence through three core screens, a native data pipeline, and an intelligent recommendation engine.

### Architecture at a Glance

```
┌──────────────────────────────────────────────────────┐
│                     DataWise App                     │
├──────────────────────────────────────────────────────┤
│  React Native UI Layer (Expo SDK 55)                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │  Home      │  │  Usage     │  │  Breakdown     │  │
│  │  Dashboard │  │  Analytics │  │  (Per-App)     │  │
│  └─────┬──────┘  └─────┬──────┘  └───────┬────────┘  │
│        │               │                 │           │
│  ┌─────┴───────────────┴─────────────────┴────────┐  │
│  │          Custom React Hooks Layer              │  │
│  │  useDataUsage · useBundleRecommendation        │  │
│  │  useUsagePermission · useTheme                 │  │
│  └────────────────────┬───────────────────────────┘  │
│                       │                              │
│  ┌────────────────────┴───────────────────────────┐  │
│  │     Native Expo Module (Kotlin)                │  │
│  │     UsageAccessModule                          │  │
│  │     ├── NetworkStatsManager (data bytes)       │  │
│  │     ├── UsageStatsManager (screen time)        │  │
│  │     ├── TelephonyManager (carrier detection)   │  │
│  │     └── PackageManager (app names + icons)     │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │     Local Data Catalog                         │  │
│  │     Nigerian Carrier Bundle Database           │  │
│  │     MTN · Airtel · Glo · 9mobile               │  │
│  │     Daily / Weekly / Monthly Plans with USSD   │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

## 🖥️ Core Screens

### 1. Home Dashboard (`index.tsx`)

The home screen is the command center — it gives users an instant, at-a-glance understanding of their data situation.

**Key Features:**
- **Hero Data Display** — A large, prominent display showing total data consumed (e.g., *"3.47 GB"*) for the selected time period, with the number and unit styled separately for visual hierarchy.
- **Dynamic Greeting** — Time-aware greeting (Good Morning / Afternoon / Evening / Night) for a personal touch.
- **Period Selector** — A segmented control (Today / Week / Month) that dynamically re-fetches all data when switched.
- **Carrier Detection** — Automatically detects the user's mobile carrier (MTN, Airtel, Glo, 9mobile) via Android's TelephonyManager and displays it as a badge.
- **Quick Insight Card** — An AI-style insight that analyzes the user's data and generates a human-readable summary, such as:
  > *"Background usage accounts for 42% of your total data. Instagram is your top data consumer at 1.2 GB."*
- **Top Drainers List** — A ranked list of the top 4 data-consuming apps (expandable to all), each showing:
  - Actual app icon (extracted as base64 PNG from the device)
  - App name
  - Data consumed with smart formatting (B → KB → MB → GB)
  - Relative usage progress bar
- **Recommended Bundle Card** — A dynamically generated recommendation showing:
  - The best-value monthly data plan from the user's carrier
  - Projected monthly usage based on current consumption
  - Potential savings compared to alternative plans
  - A one-tap "Buy Bundle" button that opens the phone dialer with the correct USSD code pre-filled
- **Pull-to-Refresh** — Swipe down to re-fetch all data from the native module.
- **Theme Toggle** — Switch between light and dark mode with a single tap.

---

### 2. Usage Analytics (`usage.tsx`)

The usage screen provides deep analytical insights into *how* data is being consumed.

**Key Features:**
- **Total Consumption Hero** — Large data display with the selected period's total.
- **Interactive Bar Chart** — Visual daily data usage over the selected period:
  - Today: single bar
  - Week: 7 bars (Mon–Sun) with today highlighted
  - Month: 4 weekly aggregate bars (Wk 1–Wk 4)
- **Connectivity Breakdown** — A Mobile vs. Wi-Fi split showing:
  - Individual totals for each connection type
  - A stacked ratio bar with percentage labels
  - Insight into how much data is consumed on cellular vs. Wi-Fi networks
- **App Activity Analysis** — A Foreground vs. Background split showing:
  - How much data apps use while you're actively using them
  - How much data apps consume silently in the background
  - Individual progress bars and percentages for each category
- **Peak Usage Windows** — A 4-quadrant grid showing data consumption by time of day:
  - **Morning** (6 AM – 12 PM)
  - **Afternoon** (12 PM – 6 PM)
  - **Evening** (6 PM – 12 AM)
  - **Night** (12 AM – 6 AM)
  - The peak window is highlighted with a badge
- **Optimizer Insight** — Context-aware recommendation:
  > *"Mobile data accounts for 73% of your usage. Switching to Wi-Fi when available could save significant data."*

---

### 3. App Breakdown (`breakdown.tsx`)

The breakdown screen provides granular, per-app analysis with search and filtering.

**Key Features:**
- **Network Statistics Header** — Shows total apps tracked and total data used with average daily consumption.
- **Search** — Real-time text search to find any app by name.
- **Category Filters** — Filter apps by category:
  - **All** — Every app
  - **Social** — Instagram, WhatsApp, Twitter/X, TikTok, Telegram, Discord, etc.
  - **Streaming** — YouTube, Netflix, Spotify, Audiomack, etc.
  - **Browser** — Chrome, Firefox, Opera, Samsung Browser, etc.
  - **System** — Android system services, Google Play Services, etc.
- **Detailed App List** — Every app with data usage, showing:
  - Real app icon
  - App name
  - Auto-generated subtitle (e.g., *"Social • High Background"*, *"Streaming • Foreground"*)
  - Data consumed and relative progress bar
  - Sorted by usage (heaviest first)
- **Usage Insight** — Category-level analysis:
  > *"Social apps account for 45% of your data usage. Consider restricting background data for less-used apps."*

---

## 🔧 Technical Architecture

### Native Module: `UsageAccessModule` (Kotlin)

The heart of DataWise is a custom Expo native module written in Kotlin that interfaces with three core Android system managers:

| API | Purpose |
|-----|---------|
| `NetworkStatsManager` | Per-app network byte counters (mobile rx/tx, wifi rx/tx, foreground/background) |
| `UsageStatsManager` | Per-app foreground screen time |
| `TelephonyManager` | Carrier/operator name detection |
| `PackageManager` | App name resolution and icon extraction |
| `AppOpsManager` | Usage access permission verification |

**Exposed Functions:**

| Function | Type | Description |
|----------|------|-------------|
| `hasUsageAccess()` | Sync | Checks if Usage Access permission is granted |
| `openUsageAccessSettings()` | Sync | Opens Android's Usage Access settings page |
| `getCarrierName()` | Sync | Returns the mobile network operator name |
| `getTodayUsageStats()` | Async | Per-app screen time for today |
| `getDataUsageStats(period)` | Async | Per-app network data with full byte breakdown |
| `getDailyDataUsage(days)` | Async | Daily totals for bar chart visualization |
| `getPeakHoursUsage(period)` | Async | Time-of-day window breakdown |

### Permission Flow

DataWise requires Android's **Usage Access** permission (`PACKAGE_USAGE_STATS`), which must be manually granted by the user through system settings. The app implements a robust permission flow:

1. **Initial Check** — On launch, the native module synchronously checks `AppOpsManager` for the current permission state (the single source of truth).
2. **Onboarding Screen** — If permission is not granted, a branded, educational permission screen is shown explaining:
   - What the app does
   - Why the permission is needed
   - What features it unlocks
   - A clear privacy assurance that data stays on-device
3. **Settings Redirect** — The "Grant Access" button opens Android's Usage Access settings page directly.
4. **AppState Listener** — When the user returns from settings, the app immediately re-checks the native permission state using an `AppState` change listener.
5. **Revocation Handling** — If permission is later revoked from Android settings, the app detects this on the next foreground event and gracefully returns to the permission screen with adjusted copy (*"Permission Required"* instead of *"Enable Usage Access"*).
6. **AsyncStorage for Onboarding** — The onboarding completion state is stored in `AsyncStorage` purely for UI copy differentiation (first-time vs. revoked), never as a permission check.

### Bundle Recommendation Engine

The recommendation system is a multi-step pipeline:

1. **Carrier Detection** — The native module reads the carrier name from `TelephonyManager`, which is then normalized to one of four supported carriers: `MTN`, `Airtel`, `Glo`, or `9mobile`. The normalization handles variations like "MTN NG", "M.T.N", MCC-MNC codes, legacy names ("Econet" → Airtel, "Etisalat" → 9mobile), etc.

2. **Usage Projection** — Current period usage is projected to a monthly estimate:
   - Today's usage × 30
   - This week's usage × 4.3 (~30/7)
   - This month's usage is used directly

3. **Buffer Application** — A 20% buffer is added to the projection to avoid recommending a plan the user would likely overshoot.

4. **Plan Matching** — The system searches the local bundle catalog for the cheapest monthly plan that covers the buffered usage. If no plan covers the usage, the largest available plan is recommended.

5. **Savings Calculation** — The recommended plan's price is compared against the next more expensive alternative to show potential savings.

6. **One-Tap Purchase** — The "Buy Bundle" button triggers the `dialUSSD` utility, which encodes the plan's USSD code into a `tel:` URI scheme and opens the phone dialer. The user simply taps the call button — no `CALL_PHONE` permission required.

### Local Bundle Database

The app includes a comprehensive, locally-maintained catalog of Nigerian carrier data bundles:

| Carrier | Plans Included | Categories |
|---------|---------------|------------|
| **MTN** | 11 plans | Daily, Weekly, Monthly |
| **Airtel** | 10 plans | Daily, Weekly, Monthly |
| **Glo** | 10 plans | Daily, Weekly, Monthly |
| **9mobile** | 9 plans | Daily, Weekly, Monthly |

Each plan includes:
- Data allocation (GB)
- Price (₦ NGN)
- Validity period (days)
- USSD purchase code
- Pre-computed cost per GB for comparison

---

## 🎨 Design System

### Typography
- **Body Text**: Plus Jakarta Sans (Regular, Medium, SemiBold, Bold, ExtraBold)
- **Numeric/Metrics**: Space Grotesk (Regular, Medium, SemiBold, Bold)

### Color Palette
- **Primary**: Indigo `#6366F1`
- **Background (Dark)**: Deep Navy `#0B1020`
- **Background (Light)**: Soft Slate `#F8FAFC`
- **Success**: Emerald `#10B981`
- **Warning**: Amber `#F59E0B`
- **Danger**: Rose `#EC4899`

### Theme System
- Full light and dark mode support
- Follows system preference by default
- Manual toggle available on every screen
- Glassmorphism-inspired cards with subtle transparency
- Gradient hero headers on all screens

### UI Component Library

DataWise includes a complete, purpose-built component library:

| Component | Purpose |
|-----------|---------|
| `HeroHeader` | Gradient header with curved bottom edge |
| `Card` | Glassmorphism-inspired content container |
| `Badge` | Status/label indicators (primary, secondary, success, warning) |
| `SegmentedControl` | Period selector with animated indicator |
| `AppUsageRow` | Per-app data display with icon, name, usage, and progress |
| `ProgressBar` | Linear gradient progress indicator |
| `BarChart` | Interactive daily usage bar chart |
| `InsightCard` | AI-style insight/recommendation display |
| `SearchInput` | Styled search field with icon |
| `FilterChip` | Category filter toggle buttons |
| `StatBox` | Metric display pill |
| `SkeletonHeroValue` | Branded skeleton loader for hero section |
| `SkeletonAppList` | Branded skeleton loader for app lists |
| `AnimatedSplashOverlay` | Animated splash/loading screen |

---

## 🔒 Privacy

DataWise is designed with a **privacy-first** architecture:

- **100% on-device processing** — All data collection, analysis, and recommendations happen locally on the user's phone.
- **No network requests** — The app does not make any API calls, does not phone home, and does not upload usage data to any server.
- **No analytics or tracking** — No third-party analytics SDKs are included.
- **No account required** — The app works immediately with no sign-up, login, or cloud sync.
- **Transparent permission model** — The only permission required (Usage Access) is clearly explained with its exact purpose before being requested.

---

## 🚀 Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React Native | 0.83.6 | Cross-platform UI framework |
| Expo | SDK 55 | Development toolchain and native module system |
| Expo Router | 55.x | File-based routing and navigation |
| TypeScript | 5.9.x | Type-safe development |
| Kotlin | — | Custom native Android module |
| React Navigation | 7.x | Bottom tab navigation |
| Expo Linear Gradient | 55.x | Gradient effects throughout the UI |
| Expo Glass Effect | 55.x | Glassmorphism card backgrounds |
| React Native Reanimated | 4.x | Smooth animations and transitions |
| AsyncStorage | 2.2 | Local state persistence (onboarding only) |

---

## 🎯 Target Audience

| Segment | Need |
|---------|------|
| **Budget-conscious mobile users** | Know exactly where data goes, avoid waste |
| **Prepaid mobile users** (especially in Africa, Asia, Latin America) | Choose the right bundle size every month |
| **Parents** | Monitor family device data consumption |
| **Students** | Maximize limited data budgets |
| **Remote workers** | Understand mobile vs. Wi-Fi split for expense tracking |
| **Power users** | Deep analytics on background drain, peak hours, per-app trends |
| **Travelers** | Track roaming data usage to avoid bill shock |

---

## 📈 Impact & Value Proposition

| Metric | Impact |
|--------|--------|
| **Data Awareness** | Users immediately see which apps drain data and how much |
| **Cost Savings** | Smart bundle recommendations help users in supported markets save money monthly |
| **Background Control** | Identifying background drainers lets users restrict wasteful apps |
| **Wi-Fi Optimization** | Understanding the mobile/Wi-Fi split encourages shifting to Wi-Fi |
| **Time Awareness** | Peak usage windows help users schedule large downloads for Wi-Fi |
| **Bundle Accuracy** | Usage projections prevent buying too much or too little data |

---

## 🛣️ Future Roadmap

- **Data budget alerts** — Set a monthly data budget and get notified when approaching the limit
- **Historical trends** — Track usage trends over weeks and months
- **Per-app background restriction guidance** — Step-by-step instructions to restrict background data for specific apps
- **International carrier support** — Expand the bundle recommendation engine to carriers in Ghana, Kenya, South Africa, India, and more
- **Bundle price comparison** — Compare plans across carriers to find the absolute best deal
- **Widget support** — Home screen widget showing current data usage at a glance
- **Family sharing** — Compare and manage data usage across multiple family devices
- **iOS support** — Extend data tracking capabilities to iOS (within Apple's API limitations)

---

## 📦 Project Structure

```
DataWise/
├── src/
│   ├── app/                    # Expo Router screens
│   │   ├── _layout.tsx         # Root layout with permission flow
│   │   ├── index.tsx           # Home Dashboard
│   │   ├── usage.tsx           # Usage Analytics
│   │   └── breakdown.tsx       # App Breakdown
│   ├── components/
│   │   ├── ui/                 # Reusable UI component library
│   │   ├── permission-screen.tsx
│   │   ├── app-tabs.tsx        # Bottom tab navigator
│   │   └── animated-icon.tsx   # Animated splash overlay
│   ├── hooks/
│   │   ├── useDataUsage.ts     # Data fetching & formatting
│   │   ├── useBundleRecommendation.ts  # Recommendation engine
│   │   ├── useUsagePermission.ts       # Permission management
│   │   └── use-theme.ts        # Theme accessor
│   ├── native/
│   │   └── UsageAccess.ts      # Native module TypeScript interface
│   ├── data/
│   │   └── bundles.ts          # Nigerian carrier bundle catalog
│   ├── context/
│   │   └── ThemeContext.tsx     # Light/dark theme provider
│   ├── constants/
│   │   └── theme.ts            # Design tokens
│   ├── theme/
│   │   ├── colors.ts           # Color definitions
│   │   └── themes.ts           # Theme configurations
│   └── utils/
│       └── dial-ussd.ts        # USSD dialer utility
├── modules/
│   └── usage-access/           # Custom Expo native module
│       └── android/src/main/java/expo/modules/usageaccess/
│           └── UsageAccessModule.kt    # Kotlin native implementation
├── assets/
│   └── images/                 # App icons and splash screen
├── app.json                    # Expo configuration
└── package.json                # Dependencies
```

---

<p align="center">
  <strong>DataWise</strong> — Stop guessing. Start knowing.
  <br>
  <em>Built for everyone. Smart recommendations starting with Nigeria. Designed with privacy.</em>
</p>
