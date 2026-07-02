import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/admin/editor")({
  ssr: false,
  head: () => ({ meta: [{ title: "Layout Editor · Phaos AI" }, { name: "robots", content: "noindex" }] }),
  component: RedirectToEditor,
});

function RedirectToEditor() {
  useEffect(() => { window.location.replace("/?adminEdit=1"); }, []);
  return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Opening editor…</div>;
}
