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

function getFlutterwaveStatus(data: any) {
  return String(data?.data?.status ?? data?.status ?? "").toLowerCase();
}

function getFlutterwaveTxRef(data: any) {
  return data?.data?.tx_ref ?? data?.data?.txRef ?? data?.tx_ref;
}

function isSuccessfulFlutterwaveStatus(status: string) {
  return ["successful", "success", "succeeded", "completed"].includes(status);
}

async function creditWalletOnce(
  supabase: ReturnType<typeof createClient>,
  tx: any,
  userId: string,
  providerMetadata: Record<string, unknown>,
) {
  const { data: wallet, error: walletErr } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (walletErr || !wallet) {
    return {
      status: "error",
      responseStatus: 400,
      body: { status: "error", error: "Wallet not found" },
    };
  }

  const newBalance = wallet.balance + tx.amount;

  const { data: claimedTx, error: claimErr } = await supabase
    .from("transactions")
    .update({ status: "success" })
    .eq("id", tx.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (claimErr) {
    return {
      status: "error",
      responseStatus: 500,
      body: {
        status: "error",
        error: "Failed to claim top-up transaction",
        details: claimErr.message,
      },
    };
  }

  if (!claimedTx) {
    return {
      status: "success",
      responseStatus: 200,
      body: { status: "success", transaction_id: tx.id },
    };
  }

  const { error: walletUpdateErr } = await supabase
    .from("wallets")
    .update({ balance: newBalance })
    .eq("user_id", userId);

  if (walletUpdateErr) {
    await supabase
      .from("transactions")
      .update({ status: "pending" })
      .eq("id", tx.id);

    return {
      status: "error",
      responseStatus: 500,
      body: {
        status: "error",
        error: "Failed to credit wallet",
        details: walletUpdateErr.message,
      },
    };
  }

  const { error: txUpdateErr } = await supabase
    .from("transactions")
    .update({
      status: "success",
      wallet_before: wallet.balance,
      wallet_after: newBalance,
      metadata: {
        provider: "flutterwave",
        ...providerMetadata,
        verified_at: new Date().toISOString(),
      },
    })
    .eq("id", tx.id);

  if (txUpdateErr) {
    await supabase
      .from("transactions")
      .update({ status: "success" })
      .eq("id", tx.id);
  }

  return {
    status: "success",
    responseStatus: 200,
    body: {
      status: "success",
      transaction_id: tx.id,
      balance: newBalance,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ status: "error", error: "Missing authorization header" }),
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
      return new Response(JSON.stringify({ status: "error", error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reference, tx_ref, transaction_id } = await req.json();
    const txRef = reference ?? tx_ref;

    if (!txRef) {
      return new Response(
        JSON.stringify({ status: "error", error: "Missing payment reference" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, user_id, amount, status, type")
      .eq("id", txRef)
      .eq("user_id", user.id)
      .eq("type", "wallet_topup")
      .single();

    if (txErr || !tx) {
      return new Response(
        JSON.stringify({ status: "error", error: "Top-up transaction not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (tx.status === "success") {
      return new Response(
        JSON.stringify({ status: "success", transaction_id: tx.id }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const verifyUrl = transaction_id
      ? `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transaction_id)}/verify`
      : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`;

    const flutterwaveRes = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
      },
    });

    const flutterwaveData = await flutterwaveRes.json();
    const paymentStatus = getFlutterwaveStatus(flutterwaveData);
    const verifiedTxRef = getFlutterwaveTxRef(flutterwaveData);
    const paidAmountNgn = Number(flutterwaveData?.data?.amount ?? 0);
    const chargedAmountNgn = Number(flutterwaveData?.data?.charged_amount ?? paidAmountNgn);
    const paidAmountKobo = Math.round(paidAmountNgn * 100);
    const chargedAmountKobo = Math.round(chargedAmountNgn * 100);
    const currency = flutterwaveData?.data?.currency;

    if (flutterwaveData.status !== "success") {
      return new Response(
        JSON.stringify({
          status: "pending",
          payment_status: paymentStatus || "unknown",
          reference: txRef,
          error: flutterwaveData.message || "Payment verification unavailable",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!isSuccessfulFlutterwaveStatus(paymentStatus)) {
      if (["failed", "cancelled"].includes(paymentStatus)) {
        await supabase
          .from("transactions")
          .update({ status: "failed" })
          .eq("id", tx.id);

        return new Response(
          JSON.stringify({
            status: "failed",
            payment_status: paymentStatus,
            transaction_id: tx.id,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          status: "pending",
          payment_status: paymentStatus || "pending",
          transaction_id: tx.id,
          reference: txRef,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (verifiedTxRef !== tx.id) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Verified payment reference does not match transaction",
          verified_reference: verifiedTxRef,
          expected_reference: tx.id,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (currency !== "NGN" || paidAmountKobo !== tx.amount || chargedAmountKobo < tx.amount) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Verified payment amount does not match transaction amount",
          currency,
          paid_amount: paidAmountKobo,
          charged_amount: chargedAmountKobo,
          expected_amount: tx.amount,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await creditWalletOnce(supabase, tx, user.id, {
      flutterwave_reference: txRef,
      flutterwave_transaction_id: transaction_id ?? flutterwaveData?.data?.id,
      flutterwave_amount: paidAmountKobo,
      flutterwave_charged_amount: chargedAmountKobo,
    });

    return new Response(JSON.stringify(result.body), {
      status: result.responseStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ status: "error", error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
