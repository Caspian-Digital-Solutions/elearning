"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function HideOnHelp({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/help" || pathname.startsWith("/help/")) {
    return null;
  }
  return children;
}
