// Cron endpoint — invoked by Supabase pg_cron on the 1st of each month at 00:05 UTC.
// Requires `x-cron-secret` header matching INTERNAL_CRON_SECRET.
import { createFileRoute } from "@tanstack/react-router";
import { reportMonthlyUsage } from "@/lib/usage-reporting.functions";

export const Route = createFileRoute("/api/public/cron/monthly-usage")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret") ?? "";
        try {
          const res = await reportMonthlyUsage({ data: { secret } });
          return Response.json(res);
        } catch (err) {
          const message = err instanceof Error ? err.message : "error";
          return Response.json({ error: message }, { status: 401 });
        }
      },
    },
  },
});
