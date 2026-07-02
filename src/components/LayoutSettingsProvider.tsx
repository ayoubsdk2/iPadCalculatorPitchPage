import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_KNOBS, knobsToCss, type Knobs } from "@/lib/layout-settings";

export function LayoutSettingsProvider({ children }: { children: ReactNode }) {
  const [css, setCss] = useState(() => knobsToCss(DEFAULT_KNOBS));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("layout_settings")
          .select("settings")
          .eq("id", "singleton")
          .maybeSingle();
        if (cancelled) return;
        const saved = (data?.settings ?? {}) as Partial<Knobs>;
        const merged: Knobs = { ...DEFAULT_KNOBS, ...saved } as Knobs;
        setCss(knobsToCss(merged));
      } catch {
        /* fall back to defaults */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <style id="phaos-layout-vars" dangerouslySetInnerHTML={{ __html: css }} />
      {children}
    </>
  );
}
