import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CDS AI Academy",
    template: "%s · CDS AI Academy",
  },
  description: "Internal learning site for Caspian Digital Solutions staff.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <TooltipProvider>
          <a
            href="#main"
            className="absolute top-2 left-2 z-50 -translate-y-20 rounded-lg bg-card px-3 py-2 text-sm text-heading focus:translate-y-0"
          >
            Skip to content
          </a>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
