"use client";

import Link from "next/link";
import type { NavItem } from "@/config/navigation";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const groupLabels = {
  main: null,
  trainer: "Trainer",
  admin: "Admin",
} as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const badgeDescriptions: Record<string, string> = {
  "/trainer/users": "set-up pending",
};

export function NavList({
  items,
  pathname,
  collapsed = false,
  badges,
  onNavigate,
}: {
  items: readonly NavItem[];
  pathname: string;
  collapsed?: boolean;
  badges?: Readonly<Record<string, number>>;
  onNavigate?: () => void;
}) {
  const groups = ["main", "trainer", "admin"] as const;

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const groupItems = items.filter((item) => item.group === group);
        if (groupItems.length === 0) {
          return null;
        }
        const label = groupLabels[group];
        return (
          <div key={group} className="flex flex-col gap-1">
            {label && !collapsed ? (
              <p className="px-3 pt-2 text-xs font-medium text-muted-foreground">{label}</p>
            ) : null}
            {label && collapsed ? <Separator /> : null}
            <ul className="flex flex-col gap-1">
              {groupItems.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                const className = cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary",
                  collapsed && "justify-center px-2",
                  active && "bg-secondary font-medium text-heading",
                );
                const icon = (
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-accent" />
                );
                const count = badges?.[item.href] ?? 0;
                const badgeText = count > 0 ? `${count} ${badgeDescriptions[item.href] ?? "waiting"}` : null;
                if (collapsed) {
                  return (
                    <li key={item.href}>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Link
                              href={item.href}
                              aria-current={active ? "page" : undefined}
                              aria-label={badgeText ? `${item.label}, ${badgeText}` : item.label}
                              className={className}
                              onClick={onNavigate}
                            />
                          }
                        >
                          <span className="relative">
                            {icon}
                            {badgeText ? (
                              <span
                                aria-hidden="true"
                                className="absolute -top-2 -right-2.5 min-w-4 rounded-full bg-accent-strong px-1 text-center text-[10px] leading-4 text-white"
                              >
                                {count}
                              </span>
                            ) : null}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          {badgeText ? `${item.label} (${badgeText})` : item.label}
                        </TooltipContent>
                      </Tooltip>
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={className}
                      onClick={onNavigate}
                    >
                      {icon}
                      <span>{item.label}</span>
                      {badgeText ? (
                        <span className="ml-auto rounded-full bg-accent-strong px-2 text-xs leading-5 font-medium text-white">
                          {count}
                          <span className="sr-only"> {badgeDescriptions[item.href] ?? "waiting"}</span>
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
