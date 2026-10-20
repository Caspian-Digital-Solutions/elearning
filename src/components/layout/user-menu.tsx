"use client";

import { useTransition } from "react";
import { roleLabels } from "@/config/navigation";
import { signOut } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/auth/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu({ user }: { user: CurrentUser }) {
  const [signingOut, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-10 max-w-56 gap-2"
            aria-label="Account menu"
          />
        }
      >
        <Avatar size="sm">
          <AvatarFallback>{initials(user.fullName)}</AvatarFallback>
        </Avatar>
        <span className="truncate">{user.fullName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{user.fullName}</DropdownMenuLabel>
        <p className="px-1.5 py-1 text-sm text-foreground">
          {roleLabels[user.role]}
          {user.isPreviewingRole ? ` (preview; you are ${roleLabels[user.actualRole]})` : null}
        </p>
        <p className="px-1.5 text-sm text-foreground">
          {user.departmentName ?? "No department yet"}
        </p>
        <p className="px-1.5 pb-1 text-xs text-muted-foreground">{user.email}</p>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onClick={() => {
            startTransition(() => signOut());
          }}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
