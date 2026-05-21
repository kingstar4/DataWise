// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Verify Paystack webhook signature using HMAC SHA-512.
 */
async function verifyPaystackSignature(
  body: string,
  signature: string,
): Promise<boolean> {
  const key = new TextEncoder().encode(PAYSTACK_SECRET_KEY);
  const data = new TextEncoder().encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
  const computedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computedHex === signature;
}

serve(async (req) => {
  // Paystack webhooks are always POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature") || "";

    // ── Verify webhook signature ──
    const isValid = await verifyPaystackSignature(rawBody, signature);
    if (!isValid) {
      console.error("Invalid Paystack webhook signature");
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(rawBody);

    // ── Only process charge.success events ──
    if (event.event !== "charge.success") {
      // Acknowledge but ignore other events
      return new Response("OK", { status: 200 });
    }

    const paymentData = event.data;
    const reference = paymentData.reference;
    const amountKobo = paymentData.amount;
    const metadata = paymentData.metadata || {};
    const userId = metadata.user_id;
    const transactionId = metadata.transaction_id;

    if (!userId || !transactionId) {
      console.error("Missing user_id or transaction_id in webhook metadata", {
        reference,
      });
      return new Response("OK", { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Check if transaction already processed (idempotency) ──
    const { data: existingTx } = await supabase
      .from("transactions")
      .select("id, status, type")
      .eq("id", transactionId)
      .single();

    if (existingTx?.status === "success") {
      // Already processed — skip
      console.log("Transaction already processed:", transactionId);
      return new Response("OK", { status: 200 });
    }

    if (!existingTx || existingTx.type !== "wallet_topup") {
      console.error("Top-up transaction not found for webhook:", transactionId);
      return new Response("OK", { status: 200 });
    }

    const { data: claimedTx, error: claimErr } = await supabase
      .from("transactions")
      .update({ status: "success" })
      .eq("id", transactionId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claimErr) {
      console.error("Failed to claim top-up transaction:", claimErr);
      return new Response("Retry", { status: 500 });
    }

    if (!claimedTx) {
      console.log("Transaction already claimed:", transactionId);
      return new Response("OK", { status: 200 });
    }

    // ── Credit user's wallet ──
    const { data: wallet, error: walletErr } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();

    if (walletErr || !wallet) {
      console.error("Wallet not found for user:", userId);
      await supabase
        .from("transactions")
        .update({ status: "pending" })
        .eq("id", transactionId);
      return new Response("OK", { status: 200 });
    }

    const newBalance = wallet.balance + amountKobo;

    const { error: updateErr } = await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("user_id", userId);

    if (updateErr) {
      console.error("Failed to credit wallet:", updateErr);
      await supabase
        .from("transactions")
        .update({ status: "pending" })
        .eq("id", transactionId);
      return new Response("Retry", { status: 500 });
    }

    // ── Mark transaction as successful ──
    const { error: txUpdateErr } = await supabase
      .from("transactions")
      .update({
        status: "success",
        metadata: {
          paystack_reference: reference,
          paystack_amount: amountKobo,
          credited_at: new Date().toISOString(),
        },
      })
      .eq("id", transactionId);

    if (txUpdateErr) {
      console.error(
        "Failed to update top-up metadata, retrying status-only update:",
        txUpdateErr,
      );
      const { error: statusOnlyErr } = await supabase
        .from("transactions")
        .update({ status: "success" })
        .eq("id", transactionId);

      if (statusOnlyErr) {
        console.error(
          "Failed to mark top-up transaction successful:",
          statusOnlyErr,
        );
        return new Response("Retry", { status: 500 });
      }
    }

    console.log("Wallet funded successfully:", {
      userId,
      transactionId,
      amountKobo,
      newBalance,
    });

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error(
      "Webhook processing error:",
      err instanceof Error ? err.message : String(err),
    );
    return new Response("Internal error", { status: 500 });
  }
});
