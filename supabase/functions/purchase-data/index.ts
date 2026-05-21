// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CHEAPDATAHUB_API_URL = Deno.env.get("CHEAPDATAHUB_API_URL")!; // e.g. https://cheapdatahub.com.ng
const CHEAPDATAHUB_API_KEY = Deno.env.get("CHEAPDATAHUB_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PLAN_IDS_URL = "https://www.cheapdatahub.ng/api/plan-ids/";
const MARKUP_PERCENT = Number(Deno.env.get("DATA_PLAN_MARKUP_PERCENT") ?? "10");
const MARKUP_FIXED_NGN = Number(Deno.env.get("DATA_PLAN_MARKUP_FIXED_NGN") ?? "50");
const MIN_PROFIT_NGN = Number(Deno.env.get("DATA_PLAN_MIN_PROFIT_NGN") ?? "100");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyMarkup(costNgn: number) {
  const percentMarkup = Math.ceil(costNgn * (MARKUP_PERCENT / 100));
  const profit = Math.max(percentMarkup + MARKUP_FIXED_NGN, MIN_PROFIT_NGN);
  return Math.ceil(costNgn + profit);
}

function isSchemaCacheColumnError(error: any) {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST204" ||
    (message.includes("could not find") && message.includes("schema cache"))
  );
}

async function hashPin(userId: string, pin: string) {
  const bytes = new TextEncoder().encode(`${userId}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeNigerianPhone(raw: string) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) return digits;
  if (digits.startsWith("234") && digits.length === 13) return `0${digits.slice(3)}`;
  return null;
}

function getProviderFailureMessage(providerMessage: string, refundMessage: string) {
  const normalized = providerMessage.toLowerCase();

  if (normalized.includes("phone") || normalized.includes("number")) {
    return `The data provider rejected that phone number. Check it and try again. ${refundMessage}`;
  }

  return `Data service is temporarily unavailable. ${refundMessage}`;
}

function getPurchaseMetadata(params: {
  cheapDataHubId: number;
  network?: string;
  phoneNumber: string;
  planId?: string;
  retailPriceNgn: number;
  wholesalePriceNgn: number;
  extra?: Record<string, unknown>;
}) {
  const {
    cheapDataHubId,
    network,
    phoneNumber,
    planId,
    retailPriceNgn,
    wholesalePriceNgn,
    extra,
  } = params;

  return {
    cheap_datahub_id: cheapDataHubId,
    network,
    phone_number: phoneNumber,
    plan_id: planId,
    retail_price_ngn: retailPriceNgn,
    wholesale_price_ngn: wholesalePriceNgn,
    ...extra,
  };
}

async function adjustWalletBalance(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  amountKobo: number,
) {
  let lastError = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: wallet, error: walletErr } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (walletErr || !wallet) {
      return {
        adjustment: null,
        error: walletErr,
        reason: "missing" as const,
      };
    }

    const walletBefore = wallet.balance as number;
    const walletAfter = walletBefore + amountKobo;

    if (walletAfter < 0) {
      return {
        adjustment: null,
        error: null,
        reason: "insufficient" as const,
      };
    }

    const { data: adjustedWallet, error: adjustErr } = await supabase
      .from("wallets")
      .update({ balance: walletAfter })
      .eq("user_id", userId)
      .eq("balance", walletBefore)
      .select("balance")
      .maybeSingle();

    if (adjustErr) {
      lastError = adjustErr;
      break;
    }

    if (adjustedWallet) {
      return {
        adjustment: { walletBefore, walletAfter },
        error: null,
        reason: null,
      };
    }
  }

  return {
    adjustment: null,
    error: lastError,
    reason: "conflict" as const,
  };
}

async function refundWallet(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  amountKobo: number,
) {
  const result = await adjustWalletBalance(supabase, userId, amountKobo);

  if (!result.adjustment) {
    console.error("Failed to refund purchase wallet:", {
      userId,
      amountKobo,
      reason: result.reason,
      error: result.error,
    });
  }

  return !!result.adjustment;
}

function getRefundMessage(refunded: boolean) {
  return refunded
    ? "Your wallet has been refunded."
    : "Your wallet refund is pending review.";
}

async function insertPurchaseTransaction(
  supabase: ReturnType<typeof createClient>,
  params: {
    amountKobo: number;
    cheapDataHubId: number;
    formattedPhone: string;
    idempotencyKey?: string;
    network?: string;
    planId?: string;
    planName: string;
    retailPlan: {
      costNgn: number;
      retailNgn: number;
    };
    userId: string;
    walletBefore: number;
  },
) {
  const {
    amountKobo,
    cheapDataHubId,
    formattedPhone,
    idempotencyKey,
    network,
    planId,
    planName,
    retailPlan,
    userId,
    walletBefore,
  } = params;
  const walletAfter = walletBefore - amountKobo;
  const legacyRecord = {
    user_id: userId,
    type: "data_purchase",
    status: "pending",
    amount: amountKobo,
    plan_id: planId || null,
    plan_name: planName,
  };
  const walletRecord = {
    ...legacyRecord,
    wallet_before: walletBefore,
    wallet_after: walletAfter,
  };
  const metadata = getPurchaseMetadata({
    cheapDataHubId,
    network,
    phoneNumber: formattedPhone,
    planId,
    retailPriceNgn: retailPlan.retailNgn,
    wholesalePriceNgn: retailPlan.costNgn,
  });
  const insertAttempts = [
    {
      ...walletRecord,
      idempotency_key: idempotencyKey || null,
      metadata,
    },
    {
      ...walletRecord,
      metadata,
    },
    walletRecord,
    legacyRecord,
  ];

  let lastError = null;

  for (const record of insertAttempts) {
    const { data, error } = await supabase
      .from("transactions")
      .insert(record)
      .select("id")
      .single();

    if (!error && data) {
      return { data, error: null };
    }

    lastError = error;
    if (!isSchemaCacheColumnError(error)) {
      break;
    }
  }

  return { data: null, error: lastError };
}

async function updatePurchaseTransaction(
  supabase: ReturnType<typeof createClient>,
  transactionId: string,
  update: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("transactions")
    .update(update)
    .eq("id", transactionId);

  if (!error || !("metadata" in update) || !isSchemaCacheColumnError(error)) {
    return error;
  }

  const { metadata: _metadata, ...legacyUpdate } = update;
  const { error: legacyError } = await supabase
    .from("transactions")
    .update(legacyUpdate)
    .eq("id", transactionId);

  return legacyError;
}

async function getRetailPlan(cheapDataHubId: number) {
  const response = await fetch(PLAN_IDS_URL);
  if (!response.ok) return null;

  const html = await response.text();
  const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)];

  for (const row of rows) {
    const cells = [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => decodeHtml(cell[1]));

    if (cells.length < 5) continue;

    const [, serviceType, planName, planIdRaw, priceRaw] = cells;
    const planId = Number(planIdRaw.replace(/\D/g, ""));
    if (serviceType.toLowerCase() !== "data" || planId !== cheapDataHubId) continue;

    const costNgn = Number(priceRaw.replace(/,/g, ""));
    if (!costNgn) return null;

    return {
      planName,
      costNgn,
      retailNgn: applyMarkup(costNgn),
    };
  }

  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth: get user from JWT ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Missing authorization header",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ status: "error", error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Parse request body ──
    const body = await req.json();
    const {
      plan_id,
      plan_name,
      network,
      price_ngn,
      idempotency_key,
      cheap_datahub_id,
      phone_number,
      pin,
    } = body;

    const formattedPhone = normalizeNigerianPhone(phone_number);
    if (!formattedPhone) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Enter a valid Nigerian phone number.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!/^\d{4}$/.test(String(pin ?? ""))) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Enter your 4-digit purchase PIN.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!cheap_datahub_id) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Missing required field: cheap_datahub_id",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const retailPlan = await getRetailPlan(Number(cheap_datahub_id));
    if (!retailPlan) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Could not verify live plan price. Please try again.",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const requestedRetailNgn = Number(price_ngn);
    if (
      !Number.isFinite(requestedRetailNgn) ||
      Math.round(requestedRetailNgn) !== retailPlan.retailNgn
    ) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Plan price changed. Refresh plans and try again.",
          current_price_ngn: retailPlan.retailNgn,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Verify user's purchase PIN ──
    const { data: profile, error: profileErr } = await supabaseUser
      .from("profiles")
      .select("purchase_pin_hash")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile?.purchase_pin_hash) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Purchase PIN not set. Please complete onboarding again.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const submittedPinHash = await hashPin(user.id, String(pin));
    if (submittedPinHash !== profile.purchase_pin_hash) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Incorrect purchase PIN.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await supabaseUser
      .from("profiles")
      .update({ phone_number: formattedPhone })
      .eq("user_id", user.id);

    // ── Check & deduct wallet balance ──
    const amountKobo = Math.round(retailPlan.retailNgn * 100);

    const walletDebit = await adjustWalletBalance(
      supabaseUser,
      user.id,
      -amountKobo,
    );

    if (!walletDebit.adjustment) {
      const error =
        walletDebit.reason === "insufficient"
          ? "Insufficient wallet balance"
          : walletDebit.reason === "conflict"
            ? "Wallet balance changed. Please try again."
            : "Wallet not found";

      return new Response(
        JSON.stringify({
          status: "error",
          error: walletDebit.error
            ? "Failed to deduct wallet"
            : error,
        }),
        {
          status: walletDebit.error
            ? 500
            : walletDebit.reason === "conflict"
              ? 409
              : 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Create pending transaction ──
    const { data: tx, error: txErr } = await insertPurchaseTransaction(
      supabaseUser,
      {
        amountKobo,
        cheapDataHubId: Number(cheap_datahub_id),
        formattedPhone,
        idempotencyKey: idempotency_key,
        network,
        planId: plan_id,
        planName: plan_name || retailPlan.planName || `Data ${network}`,
        retailPlan,
        userId: user.id,
        walletBefore: walletDebit.adjustment.walletBefore,
      },
    );

    if (txErr || !tx) {
      // Refund wallet on transaction creation failure
      const refunded = await refundWallet(supabaseUser, user.id, amountKobo);

      return new Response(
        JSON.stringify({
          status: "error",
          error: refunded
            ? "Failed to create transaction. Your wallet has been refunded."
            : "Failed to create transaction. Your wallet refund is pending review.",
          details: txErr?.message,
          code: txErr?.code,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Call CheapDataHub API ──
    let cdhResponse: any;
    try {
      const cdhRes = await fetch(
        `${CHEAPDATAHUB_API_URL}/api/v1/resellers/data/purchase/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${CHEAPDATAHUB_API_KEY}`,
          },
          body: JSON.stringify({
            bundle_id: cheap_datahub_id,
            phone_number: formattedPhone,
          }),
        },
      );

      cdhResponse = await cdhRes.json();
    } catch (fetchErr) {
      // Network error calling CheapDataHub — refund
      const refunded = await refundWallet(supabaseUser, user.id, amountKobo);

      await updatePurchaseTransaction(supabaseUser, tx.id, {
          status: "failed",
          refunded,
          metadata: getPurchaseMetadata({
            cheapDataHubId: Number(cheap_datahub_id),
            network,
            phoneNumber: formattedPhone,
            planId: plan_id,
            retailPriceNgn: retailPlan.retailNgn,
            wholesalePriceNgn: retailPlan.costNgn,
            extra: { error: "Network error calling data provider" },
          }),
        });

      return new Response(
        JSON.stringify({
          status: "error",
          error: `Could not reach data provider. ${getRefundMessage(refunded)}`,
          transaction_id: tx.id,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Handle CheapDataHub response ──
    if (cdhResponse.status === "true" || cdhResponse.status === true) {
      // Success — mark transaction as successful
      await updatePurchaseTransaction(supabaseUser, tx.id, {
          status: "success",
          metadata: getPurchaseMetadata({
            cheapDataHubId: Number(cheap_datahub_id),
            network,
            phoneNumber: formattedPhone,
            planId: plan_id,
            retailPriceNgn: retailPlan.retailNgn,
            wholesalePriceNgn: retailPlan.costNgn,
            extra: { cdh_reference: cdhResponse.reference || null },
          }),
        });

      return new Response(
        JSON.stringify({
          status: "success",
          message: cdhResponse.message || "Data purchase successful",
          transaction_id: tx.id,
          reference: cdhResponse.reference || null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } else {
      // Failed — refund wallet and mark transaction as failed
      const refunded = await refundWallet(supabaseUser, user.id, amountKobo);

      await updatePurchaseTransaction(supabaseUser, tx.id, {
          status: "failed",
          refunded,
          metadata: getPurchaseMetadata({
            cheapDataHubId: Number(cheap_datahub_id),
            network,
            phoneNumber: formattedPhone,
            planId: plan_id,
            retailPriceNgn: retailPlan.retailNgn,
            wholesalePriceNgn: retailPlan.costNgn,
            extra: {
              error: cdhResponse.message || "Data provider rejected the request",
              cdh_response: cdhResponse,
            },
          }),
        });

      const providerMessage =
        typeof cdhResponse.message === "string" ? cdhResponse.message : "";

      return new Response(
        JSON.stringify({
          status: "error",
          error: getProviderFailureMessage(
            providerMessage,
            getRefundMessage(refunded),
          ),
          transaction_id: tx.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ status: "error", error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
