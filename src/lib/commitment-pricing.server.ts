// Server-only: builds Stripe subscription line items from the calculator's
// saved selections. Voice usage is billed via a pre-configured tiered flat-rate
// price (NOT a metered price). The cron job on the 1st updates the
// subscription item's `quantity` to the previous month's total minutes; Stripe
// then invoices using the graduated tiers on that price automatically.

import type Stripe from "stripe";
import { ADDON_RATES } from "./pricing";
import type { StripeEnv } from "./stripe.server";
import { createStripeClient } from "./stripe.server";

export interface SelectedPackages {
  advanced: {
    phoneLines: number;
    uniqueAgents: number;
    duplicatedAgents: number;
    additionalLanguages: number;
    integrationsPreBuilt: number;
    integrationsNetNew: number;
    integrationsCustom: number;
    capacityBlocks: number;
    addedIntegrations?: Array<{ id: string; name: string; tier: "prebuilt" | "netnew" | "custom" }>;
  };
  monthlyCalls: number;
  resolvePct: number;
  values?: Record<string, number | null>;
  roles?: unknown;
}

interface SkuSpec {
  sku: string;
  productName: string;
  productDescription?: string;
  unitAmount: number; // cents
  interval: "month" | null; // null = one-time
}

const SKU_SPECS: Record<string, SkuSpec> = {
  unique_agent_monthly: {
    sku: "unique_agent_monthly",
    productName: "Additional Unique AI Voice Agent",
    unitAmount: ADDON_RATES.uniqueAgent.monthly * 100,
    interval: "month",
  },
  duplicated_agent_monthly: {
    sku: "duplicated_agent_monthly",
    productName: "Duplicated AI Voice Agent",
    unitAmount: ADDON_RATES.duplicatedAgent.monthly * 100,
    interval: "month",
  },
  phone_line_monthly: {
    sku: "phone_line_monthly",
    productName: "Additional Phone Line (AI Forwarding)",
    unitAmount: ADDON_RATES.phoneLine.monthly * 100,
    interval: "month",
  },
  additional_language_monthly: {
    sku: "additional_language_monthly",
    productName: "Additional Language",
    unitAmount: ADDON_RATES.additionalLanguage.monthly * 100,
    interval: "month",
  },
  integration_prebuilt_monthly: {
    sku: "integration_prebuilt_monthly",
    productName: "Integration — Pre-Built",
    unitAmount: ADDON_RATES.integrationPreBuilt.monthly * 100,
    interval: "month",
  },
  integration_netnew_monthly: {
    sku: "integration_netnew_monthly",
    productName: "Integration — Net-New",
    unitAmount: ADDON_RATES.integrationNetNew.monthly * 100,
    interval: "month",
  },
  integration_custom_monthly: {
    sku: "integration_custom_monthly",
    productName: "Integration — Custom",
    unitAmount: ADDON_RATES.integrationCustom.monthly * 100,
    interval: "month",
  },
  capacity_block_onetime: {
    sku: "capacity_block_onetime",
    productName: "Committed Capacity Block (5,000 min prepaid)",
    productDescription:
      "One-time prepaid usage credit — 5,000 minutes at $0.20/min. Applied to first invoice; NOT recurring.",
    unitAmount: 100000,
    interval: null,
  },

  impl_fee_onetime: {
    sku: "impl_fee_onetime",
    productName: "Implementation Setup (One-Time)",
    unitAmount: 100, // $1/unit; qty = dollar total
    interval: null,
  },
};

async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function ensureStripePrice(
  stripe: Stripe,
  env: StripeEnv,
  spec: SkuSpec,
): Promise<string> {
  const admin = await getSupabaseAdmin();
  const { data: cached } = await admin
    .from("stripe_prices")
    .select("stripe_price_id")
    .eq("sku", spec.sku)
    .eq("environment", env)
    .maybeSingle();
  if (cached?.stripe_price_id) return cached.stripe_price_id as string;

  const product = await stripe.products.create({
    name: spec.productName,
    ...(spec.productDescription && { description: spec.productDescription }),
    metadata: { sku: spec.sku, lovable_external_id: spec.sku },
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    lookup_key: `${spec.sku}_${env}`,
    metadata: { sku: spec.sku, lovable_external_id: spec.sku },
    unit_amount: spec.unitAmount,
    ...(spec.interval && { recurring: { interval: spec.interval } }),
  });

  await admin.from("stripe_prices").insert({
    sku: spec.sku,
    environment: env,
    stripe_product_id: product.id,
    stripe_price_id: price.id,
    unit_amount: spec.unitAmount,
    currency: "usd",
    recurring_interval: spec.interval,
    usage_type: "licensed",
    metadata: {},
  });

  return price.id;
}

export interface BuiltLineItems {
  line_items: Array<{ price: string; quantity: number }>;
  voice_usage_price_id: string;
}

// Graduated tiered flat-rate price for voice minutes. Auto-created & cached
// per-env in the stripe_prices table under sku=voice_usage_tiered_monthly.
// Env-var override (STRIPE_VOICE_USAGE_PRICE_ID_{SANDBOX,LIVE}) is checked
// first, but validated against Stripe — a stale/wrong ID is discarded and we
// fall through to auto-provision.
const VOICE_USAGE_SKU = "voice_usage_tiered_monthly";

async function getOrCreateVoiceUsagePriceId(stripe: Stripe, env: StripeEnv): Promise<string> {
  const admin = await getSupabaseAdmin();

  // 1. Cached in stripe_prices?
  const { data: cached } = await admin
    .from("stripe_prices")
    .select("stripe_price_id")
    .eq("sku", VOICE_USAGE_SKU)
    .eq("environment", env)
    .maybeSingle();
  if (cached?.stripe_price_id) {
    try {
      await stripe.prices.retrieve(cached.stripe_price_id as string);
      return cached.stripe_price_id as string;
    } catch {
      await admin.from("stripe_prices").delete().eq("sku", VOICE_USAGE_SKU).eq("environment", env);
    }
  }

  // 2. Env override, if it actually exists in this Stripe env.
  const override =
    env === "live"
      ? process.env.STRIPE_VOICE_USAGE_PRICE_ID_LIVE
      : process.env.STRIPE_VOICE_USAGE_PRICE_ID_SANDBOX;
  if (override) {
    try {
      await stripe.prices.retrieve(override);
      await admin.from("stripe_prices").insert({
        sku: VOICE_USAGE_SKU,
        environment: env,
        stripe_product_id: "unknown",
        stripe_price_id: override,
        unit_amount: 0,
        currency: "usd",
        recurring_interval: "month",
        usage_type: "licensed",
        metadata: { source: "env_override" },
      });
      return override;
    } catch {
      console.warn(`[pricing] override price ${override} missing in ${env}; auto-provisioning`);
    }
  }

  // 3. Auto-provision a graduated tiered price mirroring TIERS in pricing.ts.
  const product = await stripe.products.create({
    name: "Phaos AI Voice — Metered Minutes",
    metadata: { sku: VOICE_USAGE_SKU, lovable_external_id: VOICE_USAGE_SKU },
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    lookup_key: `${VOICE_USAGE_SKU}_${env}`,
    metadata: { sku: VOICE_USAGE_SKU, lovable_external_id: VOICE_USAGE_SKU },
    billing_scheme: "tiered",
    tiers_mode: "graduated",
    tiers: [
      { up_to: 1000, unit_amount: 29 },
      { up_to: 2000, unit_amount: 27 },
      { up_to: 3000, unit_amount: 25 },
      { up_to: 4000, unit_amount: 23 },
      { up_to: 5000, unit_amount: 21 },
      { up_to: "inf", unit_amount: 20 },
    ],
    recurring: { interval: "month", usage_type: "licensed" },
  });

  await admin.from("stripe_prices").insert({
    sku: VOICE_USAGE_SKU,
    environment: env,
    stripe_product_id: product.id,
    stripe_price_id: price.id,
    unit_amount: 0,
    currency: "usd",
    recurring_interval: "month",
    usage_type: "licensed",
    metadata: { auto_provisioned: true },
  });

  console.log(`[pricing] auto-provisioned voice usage price env=${env} id=${price.id}`);
  return price.id;
}

export async function buildStripeLineItems(
  env: StripeEnv,
  selected: SelectedPackages,
  implFeeCents: number,
): Promise<BuiltLineItems> {
  const stripe = createStripeClient(env);
  const line_items: BuiltLineItems["line_items"] = [];

  const push = async (skuKey: keyof typeof SKU_SPECS, qty: number) => {
    if (qty <= 0) return;
    const priceId = await ensureStripePrice(stripe, env, SKU_SPECS[skuKey]);
    line_items.push({ price: priceId, quantity: qty });
  };

  const a = selected.advanced;

  // Voice usage — graduated tiered flat-rate price (auto-provisioned per env).
  // Quantity=1 anchors the subscription; cron updates quantity monthly to minutes used.
  const voiceUsagePriceId = await getOrCreateVoiceUsagePriceId(stripe, env);
  line_items.push({ price: voiceUsagePriceId, quantity: 1 });

  await push("unique_agent_monthly", a.uniqueAgents);
  await push("duplicated_agent_monthly", a.duplicatedAgents);
  await push("phone_line_monthly", a.phoneLines);
  await push("additional_language_monthly", a.additionalLanguages);
  await push("integration_prebuilt_monthly", a.integrationsPreBuilt);
  await push("integration_netnew_monthly", a.integrationsNetNew);
  await push("integration_custom_monthly", a.integrationsCustom);
  await push("capacity_block_onetime", a.capacityBlocks);

  const implDollars = Math.max(0, Math.round(implFeeCents / 100));
  if (implDollars > 0) {
    await push("impl_fee_onetime", implDollars);
  }

  return { line_items, voice_usage_price_id: voiceUsagePriceId };
}

// One-time implementation total in cents: $299 core + qty × ADDON_RATES.*.oneTime
export function computeImplFeeCents(selected: SelectedPackages): number {
  const a = selected.advanced;
  const oneTime =
    a.phoneLines * ADDON_RATES.phoneLine.oneTime +
    a.uniqueAgents * ADDON_RATES.uniqueAgent.oneTime +
    a.duplicatedAgents * ADDON_RATES.duplicatedAgent.oneTime +
    a.additionalLanguages * ADDON_RATES.additionalLanguage.oneTime +
    a.integrationsPreBuilt * ADDON_RATES.integrationPreBuilt.oneTime +
    a.integrationsNetNew * ADDON_RATES.integrationNetNew.oneTime +
    a.integrationsCustom * ADDON_RATES.integrationCustom.oneTime;
  return (299 + oneTime) * 100;
}

// Unix timestamp for first second of the 1st of next month, UTC.
export function firstOfNextMonthUnix(now = new Date()): number {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  return Math.floor(d.getTime() / 1000);
}
