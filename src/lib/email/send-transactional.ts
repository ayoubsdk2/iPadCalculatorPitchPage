// Client helper — POSTs to the transactional send route with the current
// Supabase JWT. Returns { ok } on success or throws with a readable message.
import { supabase } from "@/integrations/supabase/client";

export interface SendTransactionalInput {
  templateName: string;
  recipientEmail: string;
  idempotencyKey?: string;
  templateData?: Record<string, unknown>;
}

export async function sendTransactionalEmail(input: SendTransactionalInput): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("You must be signed in to send email.");
  }
  const res = await fetch("/lovable/email/transactional/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(json?.error ?? `Send failed (${res.status})`);
  }
  if (json?.success === false && json?.reason === "email_suppressed") {
    throw new Error("This recipient has unsubscribed or bounced previously.");
  }
}
