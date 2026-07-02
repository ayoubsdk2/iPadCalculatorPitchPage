import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Grants admin role to the currently signed-in user if there are no admins yet.
 * Safe-bootstrap pattern: the first signed-in caller becomes admin; later calls
 * either no-op (caller already admin) or are rejected (an admin already exists).
 */
export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    // Is caller already admin?
    const { data: mine } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (mine) return { ok: true, message: "Already admin." };

    // Are there any admins at all?
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countErr) return { ok: false, message: countErr.message };

    if ((count ?? 0) > 0) {
      return { ok: false, message: "An admin already exists. Ask them to grant you access." };
    }

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (insErr) return { ok: false, message: insErr.message };

    return { ok: true, message: "Admin role granted." };
  });
