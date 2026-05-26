// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FLUTTERWAVE_SECRET_KEY = Deno.env.get("FLUTTERWAVE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function isSchemaCacheColumnError(error: any) {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    error?.code === "PGRST204" ||
    (message.includes("could not find") && message.includes("schema cache"))
  );
}

async function insertTopupTransaction(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  amountKobo: number,
  amountNgn: number,
  walletBefore: number,
) {
  const walletAfter = walletBefore + amountKobo;
  const baseRecord = {
    user_id: userId,
    type: "wallet_topup",
    status: "pending",
    amount: amountKobo,
    plan_name: `Wallet Top-up NGN ${amountNgn.toLocaleString()}`,
    wallet_before: walletBefore,
    wallet_after: walletAfter,
  };

  const insertAttempts = [
    {
      ...baseRecord,
      plan_id: "wallet_topup",
      metadata: { type: "wallet_topup", provider: "flutterwave" },
    },
    {
      ...baseRecord,
      plan_id: "wallet_topup",
    },
    baseRecord,
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { amount_ngn, callback_url } = await req.json();

    if (!amount_ngn || amount_ngn < 100) {
      return new Response(
        JSON.stringify({ error: "Minimum top-up amount is NGN 100" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const email = user.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "User email not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountNgn = Math.round(Number(amount_ngn));
    const amountKobo = Math.round(amountNgn * 100);

    const { error: walletErr } = await supabase
      .from("wallets")
      .upsert(
        { user_id: user.id, balance: 0 },
        { onConflict: "user_id", ignoreDuplicates: true },
      );

    if (walletErr) {
      return new Response(
        JSON.stringify({
          error: "Failed to prepare wallet for payment",
          details: walletErr.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: wallet, error: walletReadErr } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    if (walletReadErr || !wallet) {
      return new Response(
        JSON.stringify({
          error: "Failed to prepare wallet for payment",
          details: walletReadErr?.message ?? "Wallet not found after creation",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: tx, error: txErr } = await insertTopupTransaction(
      supabase,
      user.id,
      amountKobo,
      amountNgn,
      wallet.balance as number,
    );

    if (txErr || !tx) {
      return new Response(
        JSON.stringify({
          error: "Failed to create transaction record",
          details: txErr?.message,
          code: txErr?.code,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const redirectUrl = callback_url
      ? `${callback_url}${callback_url.includes("?") ? "&" : "?"}reference=${encodeURIComponent(tx.id)}`
      : undefined;

    const flutterwaveRes = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
      },
      body: JSON.stringify({
        tx_ref: tx.id,
        amount: amountNgn,
        currency: "NGN",
        redirect_url: redirectUrl,
        customer: {
          email,
          name: user.user_metadata?.full_name ?? email,
        },
        customizations: {
          title: "DataWise Wallet Top-up",
          description: `Wallet funding for NGN ${amountNgn.toLocaleString()}`,
        },
        meta: {
          user_id: user.id,
          transaction_id: tx.id,
          type: "wallet_topup",
        },
      }),
    });

    const flutterwaveData = await flutterwaveRes.json();

    if (
      flutterwaveData.status !== "success" ||
      !flutterwaveData.data?.link
    ) {
      await supabase
        .from("transactions")
        .update({ status: "failed" })
        .eq("id", tx.id);

      return new Response(
        JSON.stringify({
          error: flutterwaveData.message || "Could not initialize payment",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        authorization_url: flutterwaveData.data.link,
        payment_link: flutterwaveData.data.link,
        reference: tx.id,
        transaction_id: tx.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
