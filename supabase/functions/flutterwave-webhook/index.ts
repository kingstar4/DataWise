// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FLUTTERWAVE_SECRET_HASH = Deno.env.get("FLUTTERWAVE_SECRET_HASH")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getHmacSha256Base64(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function isValidFlutterwaveWebhook(req: Request, rawBody: string) {
  if (!FLUTTERWAVE_SECRET_HASH) return false;

  const hmacSignature = req.headers.get("flutterwave-signature");
  if (hmacSignature) {
    const computed = await getHmacSha256Base64(rawBody, FLUTTERWAVE_SECRET_HASH);
    return computed === hmacSignature;
  }

  const legacySignature = req.headers.get("verif-hash");
  return legacySignature === FLUTTERWAVE_SECRET_HASH;
}

function getEventData(event: any) {
  return event?.data ?? event;
}

function isSuccessfulFlutterwaveStatus(status: string) {
  return ["successful", "success", "succeeded", "completed"].includes(status);
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const rawBody = await req.text();

    if (!(await isValidFlutterwaveWebhook(req, rawBody))) {
      console.error("Invalid Flutterwave webhook signature");
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = String(event?.event ?? event?.type ?? "").toLowerCase();

    if (eventType && !eventType.includes("charge.completed")) {
      return new Response("OK", { status: 200 });
    }

    const paymentData = getEventData(event);
    const status = String(paymentData?.status ?? "").toLowerCase();

    if (!isSuccessfulFlutterwaveStatus(status)) {
      return new Response("OK", { status: 200 });
    }

    const txRef = paymentData?.tx_ref;
    const amountNgn = Number(paymentData?.amount ?? 0);
    const chargedAmountNgn = Number(paymentData?.charged_amount ?? amountNgn);
    const amountKobo = Math.round(amountNgn * 100);
    const chargedAmountKobo = Math.round(chargedAmountNgn * 100);
    const currency = paymentData?.currency;
    const flutterwaveTransactionId = paymentData?.id;

    if (!txRef) {
      console.error("Missing tx_ref in Flutterwave webhook");
      return new Response("OK", { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .select("id, user_id, amount, status, type")
      .eq("id", txRef)
      .single();

    if (txErr || !tx || tx.type !== "wallet_topup") {
      console.error("Top-up transaction not found for Flutterwave webhook:", txRef);
      return new Response("OK", { status: 200 });
    }

    if (tx.status === "success") {
      return new Response("OK", { status: 200 });
    }

    if (currency !== "NGN" || amountKobo !== tx.amount || chargedAmountKobo < tx.amount) {
      console.error("Flutterwave webhook amount mismatch:", {
        txRef,
        currency,
        amountKobo,
        chargedAmountKobo,
        expected: tx.amount,
      });
      return new Response("OK", { status: 200 });
    }

    const { data: claimedTx, error: claimErr } = await supabase
      .from("transactions")
      .update({ status: "success" })
      .eq("id", tx.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claimErr) {
      console.error("Failed to claim Flutterwave top-up transaction:", claimErr);
      return new Response("Retry", { status: 500 });
    }

    if (!claimedTx) {
      return new Response("OK", { status: 200 });
    }

    const { data: wallet, error: walletErr } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", tx.user_id)
      .single();

    if (walletErr || !wallet) {
      await supabase
        .from("transactions")
        .update({ status: "pending" })
        .eq("id", tx.id);
      return new Response("OK", { status: 200 });
    }

    const newBalance = wallet.balance + tx.amount;
    const { error: updateErr } = await supabase
      .from("wallets")
      .update({ balance: newBalance })
      .eq("user_id", tx.user_id);

    if (updateErr) {
      await supabase
        .from("transactions")
        .update({ status: "pending" })
        .eq("id", tx.id);
      return new Response("Retry", { status: 500 });
    }

    const { error: txUpdateErr } = await supabase
      .from("transactions")
      .update({
        status: "success",
        wallet_before: wallet.balance,
        wallet_after: newBalance,
        metadata: {
          provider: "flutterwave",
          flutterwave_reference: txRef,
          flutterwave_transaction_id: flutterwaveTransactionId,
          flutterwave_amount: amountKobo,
          flutterwave_charged_amount: chargedAmountKobo,
          credited_at: new Date().toISOString(),
        },
      })
      .eq("id", tx.id);

    if (txUpdateErr) {
      await supabase
        .from("transactions")
        .update({ status: "success" })
        .eq("id", tx.id);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error(
      "Flutterwave webhook processing error:",
      err instanceof Error ? err.message : String(err),
    );
    return new Response("Internal error", { status: 500 });
  }
});
