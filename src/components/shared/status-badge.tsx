import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "border-border bg-secondary text-foreground",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
} as const;

export type StatusTone = keyof typeof tones;

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: StatusTone;
}) {
  return (
    <Badge variant="outline" className={cn("h-6 px-2", tones[tone])}>
      {children}
    </Badge>
  );
}
