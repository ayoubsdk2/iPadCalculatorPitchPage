// Monthly usage reporter — invoked by pg_cron on the 1st at 00:05 UTC via
// POST /api/public/cron/monthly-usage (x-cron-secret header).
//
// The voice-usage price in Stripe is a graduated tiered FLAT-RATE price (not
// a metered price). To bill, we update the subscription item's `quantity`
// to the previous month's total minutes; Stripe invoices automatically at
// the billing cycle anchor (the 1st).

import { createServerFn } from "@tanstack/react-start";

interface UsageReportResult {
  processed: number;
  reported: Array<{ onboardingId: string; minutes: number; itemId?: string; error?: string }>;
}

async function fetchRetellMinutes(_agentId: string, _start: Date, _end: Date): Promise<number> {
  const token = process.env.RETELL_API_KEY;
  if (!token) return 0;
  // TODO: real Retell aggregation once production agent IDs are provided.
  return 0;
}

async function fetchTelnyxMinutes(_number: string, _start: Date, _end: Date): Promise<number> {
  const token = process.env.TELNYX_API_KEY;
  if (!token) return 0;
  // TODO: real Telnyx CDR aggregation.
  return 0;
}

export const reportMonthlyUsage = createServerFn({ method: "POST" })
  .inputValidator((data: { secret: string }) => {
    const expected = process.env.INTERNAL_CRON_SECRET;
    if (!expected || data.secret !== expected) throw new Error("Unauthorized");
    return data;
  })
  .handler(async (): Promise<UsageReportResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createStripeClient } = await import("@/lib/stripe.server");

    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const { data: rows, error } = await supabaseAdmin
      .from("pending_onboardings")
      .select("id, environment, stripe_subscription_id, voice_usage_subscription_item_id, retell_agent_id, telnyx_number")
      .in("status", ["live", "paid", "provisioning_started", "provisioning_complete"]);
    if (error) throw error;

    const reported: UsageReportResult["reported"] = [];
    for (const row of rows ?? []) {
      const r = row as {
        id: string;
        environment: "sandbox" | "live";
        stripe_subscription_id: string | null;
        voice_usage_subscription_item_id: string | null;
        retell_agent_id: string | null;
        telnyx_number: string | null;
      };
      if (!r.stripe_subscription_id || !r.voice_usage_subscription_item_id) {
        reported.push({ onboardingId: r.id, minutes: 0, error: "missing subscription or item id" });
        continue;
      }
      try {
        const [retellMin, telnyxMin] = await Promise.all([
          fetchRetellMinutes(r.retell_agent_id ?? r.id, start, end),
          fetchTelnyxMinutes(r.telnyx_number ?? r.id, start, end),
        ]);
        // Reconciliation: max to avoid undercharging if one lags.
        const minutes = Math.max(retellMin, telnyxMin);
        console.log(`[cron] usage id=${r.id} retell=${retellMin} telnyx=${telnyxMin} → ${minutes}min`);

        const stripe = createStripeClient(r.environment);
        // Direct quantity update — triggers graduated-tier calc on the next invoice.
        // Quantity must be >= 1 (Stripe rejects 0 for tiered pricing under some configs);
        // send max(1, minutes) so the base line remains attached, then let tiers do the work.
        const qty = Math.max(1, minutes);
        await stripe.subscriptionItems.update(r.voice_usage_subscription_item_id, {
          quantity: qty,
          proration_behavior: "none",
        });
        reported.push({ onboardingId: r.id, minutes, itemId: r.voice_usage_subscription_item_id });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[cron] failed id=${r.id}: ${msg}`);
        reported.push({ onboardingId: r.id, minutes: 0, error: msg });
      }
    }

    return { processed: rows?.length ?? 0, reported };
  });
