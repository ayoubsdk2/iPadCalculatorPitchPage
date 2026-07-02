// Stripe webhook: verifies signature via Stripe SDK's constructEventAsync,
// idempotently transitions onboarding to `paid` → `provisioning_started`,
// and dispatches provisioning work to voice.phaosai.com via QStash.
//
// Route path: /api/public/payments/webhook   (published stable URL for Stripe)

import { createFileRoute } from "@tanstack/react-router";

const QSTASH_URL_BASE = "https://qstash.upstash.io/v2/publish";

interface ProvisioningPayload {
  onboarding_id: string;
  company_name: string;
  industry: string;
  forwarding_lines: string[];
  selected_capacity_blocks: unknown;
  status: "provisioning_started";
}

function sanitizePhoneLines(lines: unknown): string[] {
  if (!Array.isArray(lines)) return [];
  const out: string[] = [];
  for (const raw of lines) {
    if (typeof raw !== "string") continue;
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 10) out.push(digits);
  }
  return out;
}

async function enqueueProvisioning(payload: ProvisioningPayload): Promise<void> {
  const token = process.env.QSTASH_TOKEN;
  const destination =
    process.env.PHAOS_PROVISIONING_URL ??
    "https://voice.phaosai.com/api/provisioning/start";
  const provisioningToken = process.env.PHAOS_PROVISIONING_TOKEN;

  if (!token) {
    console.warn(`[webhook] QSTASH_TOKEN not set — provisioning NOT queued for ${payload.onboarding_id}`);
    return;
  }
  const res = await fetch(`${QSTASH_URL_BASE}/${destination}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Upstash-Retries": "3",
      ...(provisioningToken && {
        "Upstash-Forward-x-phaos-provisioning-token": provisioningToken,
      }),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`[webhook] QStash enqueue FAILED status=${res.status} body=${errText}`);
    throw new Error(`QStash enqueue failed: ${res.status}`);
  }
  console.log(`[webhook] qstash dispatched id=${payload.onboarding_id}`);
}

async function verifyWithSdk(
  rawBody: string,
  signature: string,
  env: "sandbox" | "live",
): Promise<{ type: string; data: { object: any } } | null> {
  try {
    const { createStripeClient } = await import("@/lib/stripe.server");
    const stripe = createStripeClient(env);
    const secret =
      env === "sandbox"
        ? process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET
        : process.env.PAYMENTS_LIVE_WEBHOOK_SECRET;
    if (!secret) return null;
    const event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
    return event as unknown as { type: string; data: { object: any } };
  } catch (err) {
    console.warn(`[webhook] signature check failed for env=${env}: ${err instanceof Error ? err.message : "unknown"}`);
    return null;
  }
}

async function handleEvent(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature", { status: 400 });

  // Try sandbox secret first, then live.
  let event = await verifyWithSdk(rawBody, signature, "sandbox");
  let env: "sandbox" | "live" = "sandbox";
  if (!event) {
    event = await verifyWithSdk(rawBody, signature, "live");
    env = "live";
  }
  if (!event) return new Response("Invalid signature", { status: 400 });

  console.log(`[webhook] signature verified type=${event.type} env=${env}`);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          id: string;
          metadata?: Record<string, string>;
          customer?: string;
          subscription?: string;
          payment_method_types?: string[];
        };
        const onboardingId = session.metadata?.pending_onboarding_id;
        if (!onboardingId) {
          console.warn("[webhook] session missing pending_onboarding_id");
          break;
        }

        // Idempotency: load current row and abort if already advanced.
        const { data: current } = await supabaseAdmin
          .from("pending_onboardings")
          .select("id, status, company_data, selected_packages, stripe_metered_item_id")
          .eq("id", onboardingId)
          .maybeSingle();
        if (!current) {
          console.warn(`[webhook] onboarding not found id=${onboardingId}`);
          break;
        }
        const row = current as unknown as {
          id: string;
          status: string;
          company_data: any;
          selected_packages: any;
          stripe_metered_item_id: string | null;
        };
        if (row.status === "paid" || row.status === "provisioning_started" || row.status === "provisioning_complete" || row.status === "live") {
          console.log(`[webhook] idempotent skip id=${onboardingId} status=${row.status}`);
          break;
        }

        const paymentPref =
          session.payment_method_types?.[0] === "us_bank_account" ? "ach" : "card";

        // Resolve the subscription item id for the voice-usage price so cron can update quantity.
        let voiceItemId: string | null = null;
        if (session.subscription && row.stripe_metered_item_id) {
          try {
            const { createStripeClient } = await import("@/lib/stripe.server");
            const stripe = createStripeClient(env);
            const sub = await stripe.subscriptions.retrieve(session.subscription as string);
            const item = sub.items.data.find((i) => i.price?.id === row.stripe_metered_item_id);
            voiceItemId = item?.id ?? null;
          } catch (err) {
            console.error(`[webhook] failed to resolve subscription item: ${err instanceof Error ? err.message : "unknown"}`);
          }
        }

        await supabaseAdmin
          .from("pending_onboardings")
          .update({
            status: "paid",
            stripe_subscription_id: (session.subscription as string) ?? null,
            stripe_customer_id: (session.customer as string) ?? null,
            payment_method_preference: paymentPref,
            voice_usage_subscription_item_id: voiceItemId,
          } as any)
          .eq("id", onboardingId);

        console.log(`[webhook] status→paid id=${onboardingId}`);

        // Build sanitized provisioning payload.
        const payload: ProvisioningPayload = {
          onboarding_id: onboardingId,
          company_name: String(row.company_data?.company_name ?? ""),
          industry: String(row.company_data?.industry ?? ""),
          forwarding_lines: sanitizePhoneLines(row.company_data?.phone_lines),
          selected_capacity_blocks: row.selected_packages?.advanced?.capacityBlocks ?? null,
          status: "provisioning_started",
        };

        try {
          await enqueueProvisioning(payload);
          await supabaseAdmin
            .from("pending_onboardings")
            .update({ status: "provisioning_started" } as any)
            .eq("id", onboardingId);
        } catch (err) {
          console.error(`[webhook] enqueue failed, leaving status=paid for retry: ${err instanceof Error ? err.message : "unknown"}`);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as { id: string; metadata?: Record<string, string> };
        const onboardingId = sub.metadata?.pending_onboarding_id;
        if (onboardingId) {
          await supabaseAdmin
            .from("pending_onboardings")
            .update({ stripe_subscription_id: sub.id } as any)
            .eq("id", onboardingId);
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as { subscription?: string };
        if (inv.subscription) {
          await supabaseAdmin
            .from("pending_onboardings")
            .update({ status: "failed", provisioning_error: "invoice.payment_failed" } as any)
            .eq("stripe_subscription_id", inv.subscription);
        }
        break;
      }
      default:
        break;
    }
    return Response.json({ received: true });
  } catch (err) {
    console.error(`[webhook] handler error: ${err instanceof Error ? err.message : "unknown"}`);
    // Return 200 to avoid Stripe retry storm for internal errors; signature failures already returned 400 above.
    return Response.json({ received: true, error: "handler_error" });
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handleEvent(request),
    },
  },
});
