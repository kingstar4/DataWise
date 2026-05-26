// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const PLAN_IDS_URL = "https://www.cheapdatahub.ng/api/plan-ids/";

const MARKUP_MODE = Deno.env.get("DATA_PLAN_MARKUP_MODE") ?? "competitive";
const MARKUP_PERCENT = Number(Deno.env.get("DATA_PLAN_MARKUP_PERCENT") ?? "10");
const MARKUP_FIXED_NGN = Number(Deno.env.get("DATA_PLAN_MARKUP_FIXED_NGN") ?? "50");
const MIN_PROFIT_NGN = Number(Deno.env.get("DATA_PLAN_MIN_PROFIT_NGN") ?? "100");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CarrierId = "MTN" | "Airtel" | "Glo" | "9mobile";

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

function normalizeNetwork(network: string): CarrierId | null {
  const upper = network.toUpperCase();
  if (upper === "MTN") return "MTN";
  if (upper === "AIRTEL") return "Airtel";
  if (upper === "GLO") return "Glo";
  if (upper === "9MOBILE") return "9mobile";
  return null;
}

function parseDataGB(planName: string) {
  const gb = planName.match(/(\d+(?:\.\d+)?)\s*GB/i);
  if (gb) return Number(gb[1]);

  const mb = planName.match(/(\d+(?:\.\d+)?)\s*MB/i);
  if (mb) return Math.round((Number(mb[1]) / 1024) * 100) / 100;

  return 0;
}

function parseValidityDays(planName: string) {
  const match = planName.match(/\((\d+)\s*Days?\)|\((\d+)\s*Day\)/i);
  const days = Number(match?.[1] ?? match?.[2] ?? 30);
  return Number.isFinite(days) && days > 0 ? days : 30;
}

function getCategory(validityDays: number) {
  if (validityDays <= 2) return "daily";
  if (validityDays <= 14) return "weekly";
  return "monthly";
}

function applyMarkup(costNgn: number) {
  if (MARKUP_MODE !== "legacy") {
    if (costNgn < 150) return Math.ceil(costNgn / 10) * 10;
    if (costNgn < 300) return costNgn + 20;
    if (costNgn < 1000) return costNgn + 50;
    if (costNgn < 3000) return costNgn + 150;
    if (costNgn < 5000) return costNgn + 300;
    return costNgn + 400;
  }

  const percentMarkup = Math.ceil(costNgn * (MARKUP_PERCENT / 100));
  const profit = Math.max(percentMarkup + MARKUP_FIXED_NGN, MIN_PROFIT_NGN);
  return Math.ceil(costNgn + profit);
}

function getMarkupDescription() {
  if (MARKUP_MODE === "legacy") {
    return {
      mode: "legacy",
      percent: MARKUP_PERCENT,
      fixed_ngn: MARKUP_FIXED_NGN,
      min_profit_ngn: MIN_PROFIT_NGN,
    };
  }

  return {
    mode: "competitive",
    tiers: [
      { max_cost_ngn: 149, pricing: "round_up_to_next_10_ngn" },
      { max_cost_ngn: 299, profit_ngn: 20 },
      { max_cost_ngn: 999, profit_ngn: 50 },
      { max_cost_ngn: 2999, profit_ngn: 150 },
      { max_cost_ngn: 4999, profit_ngn: 300 },
      { min_cost_ngn: 5000, profit_ngn: 400 },
    ],
  };
}

function parsePlans(html: string) {
  const plans: any[] = [];
  const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)];

  for (const row of rows) {
    const cells = [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => decodeHtml(cell[1]));

    if (cells.length < 5) continue;

    const [networkRaw, serviceType, planName, planIdRaw, priceRaw] = cells;
    if (serviceType.toLowerCase() !== "data") continue;

    const network = normalizeNetwork(networkRaw);
    const cheapDataHubId = Number(planIdRaw.replace(/\D/g, ""));
    const costNgn = Number(priceRaw.replace(/,/g, ""));
    const gb = parseDataGB(planName);
    const validity = parseValidityDays(planName);

    if (!network || !cheapDataHubId || !costNgn || !gb) continue;

    const price = applyMarkup(costNgn);

    plans.push({
      id: `${network}-${cheapDataHubId}`.toLowerCase(),
      name: `${network} ${planName}`,
      gb,
      price,
      validity,
      ussdCode: "",
      pricePerGb: gb > 0 ? Math.round(price / gb) : 0,
      network,
      cheapDataHubId,
      category: getCategory(validity),
    });
  }

  return plans;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const requestedNetwork = body.network ? normalizeNetwork(String(body.network)) : null;
    const requestedCategory = body.category ? String(body.category).toLowerCase() : null;

    const response = await fetch(PLAN_IDS_URL);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ status: "error", error: "Could not fetch CheapDataHub plan list" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = await response.text();
    let plans = parsePlans(html);

    if (requestedNetwork) {
      plans = plans.filter((plan) => plan.network === requestedNetwork);
    }

    if (requestedCategory) {
      plans = plans.filter((plan) => plan.category === requestedCategory);
    }

    plans.sort((a, b) => a.price - b.price);

    return new Response(
      JSON.stringify({
        status: "success",
        markup: getMarkupDescription(),
        plans,
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
