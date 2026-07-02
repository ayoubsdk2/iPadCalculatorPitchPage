import { createServerFn } from "@tanstack/react-start";

/**
 * One-time bootstrap: if no admin exists yet, create the initial admin user
 * from BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD env vars. No-ops
 * once any admin exists. Credentials are never hardcoded in source.
 */
export const setupInitialAdmin = createServerFn({ method: "POST" })
  .handler(async () => {
    const BOOTSTRAP_EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const BOOTSTRAP_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_ADMIN_SECRET;

    if (!BOOTSTRAP_EMAIL || !BOOTSTRAP_PASSWORD || !BOOTSTRAP_SECRET) {
      return { ok: false, message: "Bootstrap is disabled (server not configured)." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) {
      return { ok: true, message: "Admin already exists; bootstrap is closed.", created: false };
    }

    let userId: string | null = null;
    const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) return { ok: false, message: `list: ${listErr.message}` };
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === BOOTSTRAP_EMAIL.toLowerCase());

    if (existing) {
      userId = existing.id;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: BOOTSTRAP_PASSWORD,
        email_confirm: true,
      });
      if (error) return { ok: false, message: `update: ${error.message}` };
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: BOOTSTRAP_EMAIL,
        password: BOOTSTRAP_PASSWORD,
        email_confirm: true,
      });
      if (error || !created.user) return { ok: false, message: `create: ${error?.message}` };
      userId = created.user.id;
    }

    const { error: rerr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (rerr) return { ok: false, message: `role: ${rerr.message}` };

    return { ok: true, message: "Admin bootstrapped", created: true, userId };
  });
