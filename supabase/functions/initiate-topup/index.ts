// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
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
    plan_name: `Wallet Top-up ₦${amountNgn.toLocaleString()}`,
    wallet_before: walletBefore,
    wallet_after: walletAfter,
  };

  const insertAttempts = [
    {
      ...baseRecord,
      plan_id: "wallet_topup",
      metadata: { type: "wallet_topup" },
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth: get user from JWT ──
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

    // ── Parse request body ──
    const body = await req.json();
    const { amount_ngn, callback_url } = body;

    if (!amount_ngn || amount_ngn < 100) {
      return new Response(
        JSON.stringify({ error: "Minimum top-up amount is ₦100" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const amountKobo = Math.round(amount_ngn * 100);

    // ── Get user email ──
    const email = user.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "User email not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure the user has a wallet before taking payment, otherwise the
    // Paystack webhook would not have a row to credit after a successful charge.
    const { error: walletErr } = await supabase
      .from("wallets")
      .upsert(
        { user_id: user.id, balance: 0 },
        { onConflict: "user_id", ignoreDuplicates: true },
      );

    if (walletErr) {
      console.error("Failed to prepare wallet for top-up:", walletErr);
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
      console.error("Failed to read wallet before top-up:", walletReadErr);
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

    const walletBefore = wallet.balance as number;

    // ── Create pending wallet_topup transaction ──
    const { data: tx, error: txErr } = await insertTopupTransaction(
      supabase,
      user.id,
      amountKobo,
      amount_ngn,
      walletBefore,
    );

    if (txErr || !tx) {
      console.error("Failed to create wallet top-up transaction:", txErr);
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

    // ── Call Paystack to initialize transaction ──
    const paystackRes = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
        body: JSON.stringify({
          email,
          amount: amountKobo,
          reference: tx.id, // use our transaction ID as the Paystack reference
          callback_url: callback_url || undefined,
          metadata: {
            user_id: user.id,
            transaction_id: tx.id,
            type: "wallet_topup",
          },
        }),
      },
    );

    const paystackData = await paystackRes.json();

    if (!paystackData.status || !paystackData.data?.authorization_url) {
      // Clean up the pending transaction
      await supabase
        .from("transactions")
        .update({ status: "failed" })
        .eq("id", tx.id);

      return new Response(
        JSON.stringify({
          error: paystackData.message || "Could not initialize payment",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Return payment URL to client ──
    return new Response(
      JSON.stringify({
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
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
