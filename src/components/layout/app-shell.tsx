"use client";

import { Suspense, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { filterNavigation, navigation, titleForPath } from "@/config/navigation";
import type { CurrentUser } from "@/lib/auth/types";
import { NavList } from "@/components/layout/nav-list";
import { UserMenu } from "@/components/layout/user-menu";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function AppShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full max-w-full bg-background">
      <Suspense
        fallback={<div className="hidden w-64 shrink-0 border-r border-border bg-surface md:block" />}
      >
        <Sidebar user={user} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-14 shrink-0 border-b border-border bg-surface" />}>
          <TopBar user={user} />
        </Suspense>
        <main id="main" className="min-w-0 flex-1 px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const items = filterNavigation(navigation, user.role);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-surface md:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <Link href="/my-path" className="px-3 py-4" aria-label="CDS AI Academy, My path">
        {collapsed ? (
          <span className="block text-center font-heading text-sm text-heading">CDS</span>
        ) : (
          <Logo className="h-8 w-auto" />
        )}
      </Link>
      <nav id="sidebar-nav" aria-label="Main" className="flex-1 overflow-y-auto px-2 pb-4">
        <NavList items={items} pathname={pathname} collapsed={collapsed} />
      </nav>
      <div className="border-t border-border p-2">
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start"
          aria-expanded={!collapsed}
          aria-controls="sidebar-nav"
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          <span className={collapsed ? "sr-only" : undefined}>
            {collapsed ? "Expand menu" : "Collapse menu"}
          </span>
        </Button>
      </div>
    </aside>
  );
}

function TopBar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();
  const items = filterNavigation(navigation, user.role);
  const [menuOpen, setMenuOpen] = useState(false);
  const pageTitle = titleForPath(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 md:px-4">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="md:hidden"
              aria-label="Open menu"
            />
          }
        >
          <Menu aria-hidden="true" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 max-w-[85vw] bg-surface p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription className="sr-only">Site sections</SheetDescription>
          </SheetHeader>
          <nav aria-label="Menu" className="overflow-y-auto px-2 py-3">
            <NavList items={items} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          </nav>
        </SheetContent>
      </Sheet>
      <p className="min-w-0 flex-1 truncate font-heading text-base text-heading">{pageTitle}</p>
      <UserMenu user={user} />
    </header>
  );
}
