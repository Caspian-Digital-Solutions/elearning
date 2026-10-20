"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
export type HelpListItem = {
  slug: string;
  title: string;
  teaser: string;
  version: number;
  updatedLabel: string;
};

export function HelpList({ pages, initialQuery }: { pages: HelpListItem[]; initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery ?? "");

  return (
    <div className="space-y-6">
      <form
        className="max-w-md"
        onSubmit={(event) => {
          event.preventDefault();
          const q = query.trim();
          router.push(q ? `/help?q=${encodeURIComponent(q)}` : "/help");
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search help pages"
          aria-label="Search help pages"
        />
      </form>
      <ul className="space-y-4">
        {pages.map((page) => (
          <li key={page.slug}>
            <Card>
              <CardHeader>
                <CardTitle>
                  <Link href={`/help/${page.slug}`} className="text-heading hover:underline">
                    {page.title}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted">
                <p>{page.teaser}</p>
                <p>Updated {page.updatedLabel} · Version {page.version}</p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      {pages.length === 0 ? (
        <p className="text-sm text-muted">No published pages match that search.</p>
      ) : null}
    </div>
  );
}
