"use client";

import { useTransition } from "react";
import { roleLabels } from "@/config/navigation";
import { signOut } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/auth/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Signed-in header: person summary and a always-visible sign-out control (not buried in a menu). */
export function UserMenu({ user }: { user: CurrentUser }) {
  const [signingOut, startTransition] = useTransition();
  const roleLine = `${roleLabels[user.role]}${
    user.isPreviewingRole ? ` (preview; you are ${roleLabels[user.actualRole]})` : ""
  }`;

  return (
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <div
        className="flex min-w-0 max-w-[7.5rem] items-center gap-1.5 rounded-lg border border-border bg-background px-1.5 py-1 sm:max-w-52 sm:gap-2 sm:px-2"
        title={`${user.fullName} · ${roleLine} · ${user.departmentName ?? "No department yet"}`}
      >
        <Avatar size="sm" className="shrink-0">
          <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 truncate text-sm text-foreground">{user.fullName}</span>
      </div>
      <Button
        type="button"
        size="sm"
        className="h-9 shrink-0 border border-accent-strong/30 bg-accent px-2.5 text-accent-foreground hover:bg-accent-strong hover:text-primary-foreground sm:px-3"
        disabled={signingOut}
        aria-busy={signingOut}
        onClick={() => {
          startTransition(() => signOut());
        }}
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
