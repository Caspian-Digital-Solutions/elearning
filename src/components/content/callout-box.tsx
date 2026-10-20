import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { CalloutKind } from "@/lib/content/callouts";
import { calloutLabel } from "@/lib/content/callouts";
import { MarkdownChunk } from "@/components/shared/markdown-chunk";
import { cn } from "@/lib/utils";

const styles: Record<CalloutKind, { box: string; icon: typeof Info }> = {
  NOTE: { box: "border-sky-700/30 bg-sky-50 text-foreground", icon: Info },
  WARNING: { box: "border-amber-700/40 bg-amber-50 text-foreground", icon: AlertTriangle },
  IMPORTANT: { box: "border-orange-700/40 bg-orange-50 text-foreground", icon: AlertCircle },
};

export function CalloutBox({ kind, body }: { kind: CalloutKind; body: string }) {
  const style = styles[kind];
  const Icon = style.icon;
  const label = calloutLabel(kind);
  return (
    <aside
      className={cn("my-4 rounded-lg border px-4 py-3", style.box)}
      aria-label={label}
    >
      <p className="mb-2 flex items-center gap-2 font-medium text-heading">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </p>
      <MarkdownChunk markdown={body} className="text-sm" />
    </aside>
  );
}
