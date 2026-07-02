import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { setupInitialAdmin } from "@/lib/setup-admin.functions";

/**
 * Token-protected bootstrap endpoint. Requires the caller to present the
 * BOOTSTRAP_ADMIN_SECRET via `Authorization: Bearer <secret>` or an
 * `x-bootstrap-secret` header. GET is not allowed — bootstrap is a
 * state-changing operation.
 */
function checkSecret(request: Request): boolean {
  const expected = process.env.BOOTSTRAP_ADMIN_SECRET;
  if (!expected) return false;
  const header =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    request.headers.get("x-bootstrap-secret") ||
    "";
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/setup-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!checkSecret(request)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const res = await setupInitialAdmin();
        return Response.json(res);
      },
    },
  },
});
