// Server functions for the commitment → payment handoff.
// createPendingOnboarding → createCheckoutSession → getOnboardingStatus.

import { createServerFn } from "@tanstack/react-start";

type StripeEnv = "sandbox" | "live";

interface CompanyData {
  company_name?: string;
  industry?: string;
  main_contact?: string;
  title?: string;
  address?: string;
  city_state?: string;
  email_address?: string;
  website?: string;
  best_contact_number?: string;
  phone_lines?: string[];
}

interface SelectedPackagesInput {
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

export const createPendingOnboarding = createServerFn({ method: "POST" })
  .inputValidator((data: {
    company_data: CompanyData;
    selected_packages: SelectedPackagesInput;
    environment: StripeEnv;
  }) => {
    if (!data.company_data || typeof data.company_data !== "object") throw new Error("company_data required");
    if (!data.selected_packages || typeof data.selected_packages !== "object") throw new Error("selected_packages required");
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("environment invalid");
    return data;
  })
  .handler(async ({ data }): Promise<{ onboardingId: string } | { error: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("pending_onboardings")
        .insert({
          status: "pending_payment",
          company_data: data.company_data as any,
          selected_packages: data.selected_packages as any,
          environment: data.environment,
        })
        .select("id")
        .single();
      if (error || !row) throw new Error(error?.message ?? "Failed to save onboarding");
      const id = (row as { id: string }).id;
      console.log(`[checkout] pending_onboarding created id=${id} env=${data.environment}`);
      return { onboardingId: id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { error: message };
    }
  });

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: { onboardingId: string; environment: StripeEnv; returnUrl: string }) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.onboardingId)) {
      throw new Error("Invalid onboardingId");
    }
    if (data.environment !== "sandbox" && data.environment !== "live") throw new Error("Invalid environment");
    if (!data.returnUrl || !/^https?:\/\//.test(data.returnUrl)) throw new Error("Invalid returnUrl");
    return data;
  })
  .handler(async ({ data }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
      const {
        buildStripeLineItems,
        computeImplFeeCents,
        firstOfNextMonthUnix,
      } = await import("@/lib/commitment-pricing.server");

      const { data: row, error: loadErr } = await supabaseAdmin
        .from("pending_onboardings")
        .select("id, status, company_data, selected_packages, environment, stripe_customer_id")
        .eq("id", data.onboardingId)
        .maybeSingle();
      if (loadErr || !row) throw new Error(loadErr?.message ?? "Onboarding not found");
      const onboarding = row as unknown as {
        id: string; status: string; environment: StripeEnv;
        company_data: CompanyData; selected_packages: SelectedPackagesInput;
        stripe_customer_id: string | null;
      };
      if (onboarding.status !== "pending_payment") {
        throw new Error(`Onboarding is not awaiting payment (status: ${onboarding.status})`);
      }
      if (onboarding.environment !== data.environment) {
        throw new Error("Environment mismatch");
      }

      const stripe = createStripeClient(data.environment);

      let customerId = onboarding.stripe_customer_id ?? null;
      const email = onboarding.company_data.email_address?.trim();
      if (!customerId && email) {
        const existing = await stripe.customers.list({ email, limit: 1 });
        if (existing.data.length) customerId = existing.data[0].id;
      }
      if (!customerId) {
        const created = await stripe.customers.create({
          ...(email && { email }),
          ...(onboarding.company_data.company_name && { name: onboarding.company_data.company_name }),
          metadata: {
            pending_onboarding_id: onboarding.id,
            industry: onboarding.company_data.industry ?? "",
          },
        });
        customerId = created.id;
      }

      const implFeeCents = computeImplFeeCents(onboarding.selected_packages);
      const { line_items, voice_usage_price_id } = await buildStripeLineItems(
        data.environment,
        onboarding.selected_packages,
        implFeeCents,
      );

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ui_mode: "embedded_page",
        return_url: `${data.returnUrl}?onboarding=${onboarding.id}&session_id={CHECKOUT_SESSION_ID}`,
        customer: customerId,
        line_items,
        // ACH-first, card as fallback. Order matters.
        payment_method_types: ["us_bank_account", "card"],
        payment_method_options: {
          us_bank_account: {
            financial_connections: { permissions: ["payment_method"] },
            verification_method: "automatic",
          },
        },
        subscription_data: {
          billing_cycle_anchor: firstOfNextMonthUnix(),
          proration_behavior: "create_prorations",
          metadata: {
            pending_onboarding_id: onboarding.id,
            industry: onboarding.company_data.industry ?? "",
          },
        },
        metadata: {
          pending_onboarding_id: onboarding.id,
          industry: onboarding.company_data.industry ?? "",
          voice_usage_price_id,
        },
      } as unknown as Parameters<typeof stripe.checkout.sessions.create>[0]);

      await supabaseAdmin
        .from("pending_onboardings")
        .update({
          stripe_customer_id: customerId,
          stripe_session_id: session.id,
          // Reused column: stores the voice-usage PRICE id (tiered flat-rate),
          // NOT a metered item id. Cron looks up the subscription item by this price id.
          stripe_metered_item_id: voice_usage_price_id,
        })
        .eq("id", onboarding.id);

      console.log(`[checkout] session created id=${session.id} onboarding=${onboarding.id} env=${data.environment}`);
      return { clientSecret: session.client_secret ?? "" };
    } catch (err) {
      try {
        const { getStripeErrorMessage } = await import("@/lib/stripe.server");
        const message = getStripeErrorMessage(err);
        console.error(`[checkout] session error: ${message}`);
        return { error: message };
      } catch {
        const message = err instanceof Error ? err.message : "Failed to create checkout session";
        console.error(`[checkout] session error: ${message}`);
        return { error: message };
      }
    }
  });

export const getOnboardingStatus = createServerFn({ method: "POST" })
  .inputValidator((data: { onboardingId: string }) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.onboardingId)) {
      throw new Error("Invalid onboardingId");
    }
    return data;
  })
  .handler(async ({ data }): Promise<{
    status: string;
    retell_agent_id: string | null;
    telnyx_number: string | null;
    provisioning_error: string | null;
  } | { error: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("pending_onboardings")
        .select("status, retell_agent_id, telnyx_number, provisioning_error")
        .eq("id", data.onboardingId)
        .maybeSingle();
      if (error || !row) throw new Error(error?.message ?? "Not found");
      return row as {
        status: string;
        retell_agent_id: string | null;
        telnyx_number: string | null;
        provisioning_error: string | null;
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load status";
      return { error: message };
    }
  });
