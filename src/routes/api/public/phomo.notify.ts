// Anon-callable email trigger for the public Phomo scheduler.
// Authorization: the caller must provide the booking's manage_token; the
// server verifies the booking exists and only emails the invitee on file.
import * as React from "react";
import { render } from "react-email";
import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SENDER_DOMAIN = "notify.www.phaosai.com";
const FROM_DOMAIN = "notify.www.phaosai.com";
const SITE_NAME = "Phaos AI";

const EVENT_TO_TEMPLATE: Record<string, string> = {
  confirmation: "phomo-booking-confirmation",
  canceled: "phomo-booking-canceled",
};

export const Route = createFileRoute("/api/public/phomo/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) return Response.json({ error: "server_misconfig" }, { status: 500 });

        let body: any;
        try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
        const manageToken = String(body?.manageToken ?? "");
        const event = String(body?.event ?? "confirmation");
        const templateKey = EVENT_TO_TEMPLATE[event];
        if (!manageToken || !templateKey) return Response.json({ error: "bad_request" }, { status: 400 });

        const admin = createClient(url, key);
        const { data: b, error } = await admin
          .from("bookings")
          .select("id, invitee_name, invitee_email, invitee_timezone, start_at, end_at, event_types(name), team_profiles(display_name)")
          .eq("manage_token", manageToken)
          .maybeSingle();
        if (error || !b) return Response.json({ error: "booking_not_found" }, { status: 404 });

        const startDate = new Date(b.start_at);
        const whenLabel = new Intl.DateTimeFormat("en-US", {
          weekday: "short", month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit", timeZone: b.invitee_timezone,
        }).format(startDate);

        const origin = new URL(request.url).origin;
        const manageUrl = `${origin}/onboarding/manage?t=${manageToken}`;
        const templateData: Record<string, any> = {
          inviteeName: b.invitee_name,
          eventName: (b as any).event_types?.name ?? "Phaos AI Onboarding",
          hostName: (b as any).team_profiles?.display_name ?? "the Phaos AI team",
          whenLabel,
          timezone: b.invitee_timezone,
          manageUrl,
          rebookUrl: `${origin}/onboarding/schedule`,
        };

        const tpl = TEMPLATES[templateKey];
        if (!tpl) return Response.json({ error: "template_missing" }, { status: 500 });

        const html = await render(React.createElement(tpl.component, templateData));
        const text = await render(React.createElement(tpl.component, templateData), { plainText: true });
        const subject = typeof tpl.subject === "function" ? tpl.subject(templateData) : tpl.subject;
        const messageId = crypto.randomUUID();

        await admin.from("email_send_log").insert({
          message_id: messageId, template_name: templateKey,
          recipient_email: b.invitee_email, status: "pending",
        });

        const { error: enqError } = await admin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            message_id: messageId,
            to: b.invitee_email,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject, html, text,
            purpose: "transactional",
            label: templateKey,
            idempotency_key: `${templateKey}:${manageToken}`,
            queued_at: new Date().toISOString(),
          },
        });
        if (enqError) {
          await admin.from("email_send_log").insert({
            message_id: messageId, template_name: templateKey,
            recipient_email: b.invitee_email, status: "failed",
            error_message: enqError.message,
          });
          return Response.json({ error: "enqueue_failed" }, { status: 500 });
        }
        await admin.from("workflow_runs").insert({
          booking_id: b.id, template_key: templateKey, channel: "email",
          status: "queued", scheduled_at: new Date().toISOString(),
        });
        return Response.json({ ok: true });
      },
    },
  },
});
