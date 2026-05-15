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
    } = body;

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

    // ── Get user's phone number from profile ──
    const { data: profile, error: profileErr } = await supabaseUser
      .from("profiles")
      .select("phone_number")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile?.phone_number) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Phone number not set. Please update your profile.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Check & deduct wallet balance atomically ──
    const amountKobo = Math.round(retailPlan.retailNgn * 100);

    const { data: wallet, error: walletErr } = await supabaseUser
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    if (walletErr || !wallet) {
      return new Response(
        JSON.stringify({ status: "error", error: "Wallet not found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (wallet.balance < amountKobo) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Insufficient wallet balance",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Deduct wallet
    const { error: deductErr } = await supabaseUser
      .from("wallets")
      .update({ balance: wallet.balance - amountKobo })
      .eq("user_id", user.id);

    if (deductErr) {
      return new Response(
        JSON.stringify({ status: "error", error: "Failed to deduct wallet" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Create pending transaction ──
    const { data: tx, error: txErr } = await supabaseUser
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "data",
        status: "pending",
        amount: amountKobo,
        plan_name: plan_name || retailPlan.planName || `Data ${network}`,
        idempotency_key: idempotency_key || null,
        wallet_before: wallet.balance,
        wallet_after: wallet.balance - amountKobo,
        metadata: {
          cheap_datahub_id,
          network,
          phone_number: profile.phone_number,
          plan_id,
          wholesale_price_ngn: retailPlan.costNgn,
          retail_price_ngn: retailPlan.retailNgn,
        },
      })
      .select("id")
      .single();

    if (txErr || !tx) {
      // Refund wallet on transaction creation failure
      await supabaseUser
        .from("wallets")
        .update({ balance: wallet.balance })
        .eq("user_id", user.id);

      return new Response(
        JSON.stringify({
          status: "error",
          error: "Failed to create transaction",
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
            phone_number: profile.phone_number,
          }),
        },
      );

      cdhResponse = await cdhRes.json();
    } catch (fetchErr) {
      // Network error calling CheapDataHub — refund
      await supabaseUser
        .from("wallets")
        .update({ balance: wallet.balance })
        .eq("user_id", user.id);

      await supabaseUser
        .from("transactions")
        .update({
          status: "failed",
          refunded: true,
          metadata: {
            error: "Network error calling data provider",
            cheap_datahub_id,
            network,
          },
        })
        .eq("id", tx.id);

      return new Response(
        JSON.stringify({
          status: "error",
          error:
            "Could not reach data provider. Your wallet has been refunded.",
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
      await supabaseUser
        .from("transactions")
        .update({
          status: "success",
          metadata: {
            cheap_datahub_id,
            network,
            phone_number: profile.phone_number,
            plan_id,
            cdh_reference: cdhResponse.reference || null,
          },
        })
        .eq("id", tx.id);

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
      await supabaseUser
        .from("wallets")
        .update({ balance: wallet.balance })
        .eq("user_id", user.id);

      await supabaseUser
        .from("transactions")
        .update({
          status: "failed",
          refunded: true,
          metadata: {
            error: cdhResponse.message || "Data provider rejected the request",
            cheap_datahub_id,
            network,
            cdh_response: cdhResponse,
          },
        })
        .eq("id", tx.id);

      return new Response(
        JSON.stringify({
          status: "error",
          error:
            cdhResponse.message ||
            "Data purchase failed. Your wallet has been refunded.",
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
