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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ status: "error", error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const { reference } = await req.json();
    if (!reference) {
      return new Response(JSON.stringify({ status: "error", error: "Missing payment reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, user_id, amount, status, type")
      .eq("id", reference)
      .eq("user_id", user.id)
      .eq("type", "wallet_topup")
      .single();

    if (txErr || !tx) {
      return new Response(JSON.stringify({ status: "error", error: "Top-up transaction not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tx.status === "success") {
      return new Response(JSON.stringify({ status: "success", transaction_id: tx.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      },
    );

    const paystackData = await paystackRes.json();
    const paymentStatus = paystackData?.data?.status;
    const paidAmount = paystackData?.data?.amount;
    const gatewayResponse = paystackData?.data?.gateway_response;

    console.log("Paystack top-up verification result:", {
      reference,
      transaction_id: tx.id,
      paystack_ok: paystackData.status,
      payment_status: paymentStatus,
      gateway_response: gatewayResponse,
      paid_amount: paidAmount,
      expected_amount: tx.amount,
      message: paystackData.message,
    });

    if (!paystackData.status) {
      return new Response(
        JSON.stringify({
          status: "pending",
          payment_status: paymentStatus ?? "unknown",
          gateway_response: gatewayResponse ?? null,
          reference,
          error: paystackData.message || "Payment verification unavailable",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (paymentStatus !== "success") {
      if (paymentStatus === "failed") {
        await supabase
          .from("transactions")
          .update({ status: "failed" })
          .eq("id", tx.id);

        return new Response(
          JSON.stringify({
            status: "failed",
            payment_status: paymentStatus,
            gateway_response: gatewayResponse ?? null,
            transaction_id: tx.id,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          status: "pending",
          payment_status: paymentStatus ?? "pending",
          gateway_response: gatewayResponse ?? null,
          transaction_id: tx.id,
          reference,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (paidAmount !== tx.amount) {
      return new Response(
        JSON.stringify({
          status: "error",
          error: "Verified payment amount does not match transaction amount",
          payment_status: paymentStatus,
          gateway_response: gatewayResponse ?? null,
          paid_amount: paidAmount,
          expected_amount: tx.amount,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: wallet, error: walletErr } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .single();

    if (walletErr || !wallet) {
      return new Response(JSON.stringify({ status: "error", error: "Wallet not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(
        JSON.stringify({ status: "error", error: "Failed to claim top-up transaction", details: claimErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!claimedTx) {
      return new Response(JSON.stringify({ status: "success", transaction_id: tx.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: walletUpdateErr } = await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("user_id", user.id);

    if (walletUpdateErr) {
      await supabase
        .from("transactions")
        .update({ status: "pending" })
        .eq("id", tx.id);

      return new Response(
        JSON.stringify({ status: "error", error: "Failed to credit wallet", details: walletUpdateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: txUpdateErr } = await supabase
      .from("transactions")
      .update({
        status: "success",
        wallet_before: wallet.balance,
        wallet_after: newBalance,
        metadata: {
          paystack_reference: reference,
          paystack_amount: paidAmount,
          verified_at: new Date().toISOString(),
        },
      })
      .eq("id", tx.id);

    if (txUpdateErr) {
      console.error("Failed to update verified top-up metadata:", txUpdateErr);
      await supabase
        .from("transactions")
        .update({ status: "success" })
        .eq("id", tx.id);
    }

    return new Response(
      JSON.stringify({
        status: "success",
        transaction_id: tx.id,
        balance: newBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ status: "error", error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
