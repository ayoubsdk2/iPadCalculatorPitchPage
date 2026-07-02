// Post-payment landing. Polls pending_onboardings + subscribes to realtime.
// Precise UI per status; navigates to onboarding scheduler on completion.
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/commitment/success")({
  validateSearch: (raw: Record<string, unknown>) => ({
    onboarding: typeof raw.onboarding === "string" ? raw.onboarding : "",
    session_id: typeof raw.session_id === "string" ? raw.session_id : "",
  }),
  component: SuccessPage,
});

type OnboardingRow = {
  status: string;
  provisioning_error: string | null;
};

const COPY: Record<string, { title: string; body: string }> = {
  pending_payment: {
    title: "Processing payment…",
    body: "Confirming your payment with Stripe.",
  },
  paid: {
    title: "Payment received.",
    body: "Provisioning your Phaos AI Voice Agent…",
  },
  provisioning_started: {
    title: "Provisioning in progress…",
    body: "Setting up your agent, phone number, and knowledge base.",
  },
  provisioning_complete: {
    title: "Welcome to Phaos AI!",
    body: "Redirecting to your onboarding scheduler…",
  },
  live: {
    title: "Welcome to Phaos AI!",
    body: "Redirecting to your onboarding scheduler…",
  },
};

function SuccessPage() {
  const { onboarding } = useSearch({ from: "/commitment/success" });
  const [status, setStatus] = useState<string>("pending_payment");
  const [error, setError] = useState<string | null>(null);
  const redirected = useRef(false);

  useEffect(() => {
    if (!onboarding) {
      setError("Missing onboarding reference in return URL.");
      return;
    }

    let cancelled = false;

    const readOnce = async () => {
      const { data, error: qErr } = await supabase
        .from("pending_onboardings")
        .select("status, provisioning_error")
        .eq("id", onboarding)
        .maybeSingle();
      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        return;
      }
      if (data) applyRow(data as OnboardingRow);
    };

    const applyRow = (row: OnboardingRow) => {
      setStatus(row.status);
      if (row.provisioning_error) setError(row.provisioning_error);
      if ((row.status === "provisioning_complete" || row.status === "live") && !redirected.current) {
        redirected.current = true;
        setTimeout(() => {
          window.location.href = `/onboarding/schedule?id=${encodeURIComponent(onboarding)}`;
        }, 1500);
      }
    };

    void readOnce();

    // Realtime subscription
    const channel = supabase
      .channel(`onboarding:${onboarding}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pending_onboardings",
          filter: `id=eq.${onboarding}`,
        },
        (payload) => {
          const row = payload.new as OnboardingRow | undefined;
          if (row) applyRow(row);
        },
      )
      .subscribe();

    // Fallback poll every 3s in case realtime is delayed.
    const poll = setInterval(() => void readOnce(), 3000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [onboarding]);

  const isFailure = status === "failed" || status === "canceled";
  const isDone = status === "provisioning_complete" || status === "live";
  const copy = COPY[status] ?? { title: "Confirming your payment…", body: "" };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-card border rounded-2xl shadow-xl p-8 text-center">
        {isFailure ? (
          <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
        ) : isDone ? (
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
        ) : (
          <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
        )}
        <h1 className="text-2xl font-extrabold mb-2">
          {isFailure ? "Something went wrong" : copy.title}
        </h1>
        <p className="text-muted-foreground">
          {isFailure
            ? error ?? "Please contact support so we can get you back on track."
            : copy.body}
        </p>
        {error && !isFailure && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}
        <p className="mt-6 text-xs text-muted-foreground/70">
          Status: <span className="font-mono">{status}</span>
        </p>
      </div>
    </div>
  );
}
