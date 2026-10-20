"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { updateTools } from "@/lib/content/tools";
import { formatDate } from "@/lib/format";

export type UpdateFeedItem = {
  slug: string;
  title: string;
  date: string;
  tools: string[];
  actionRequired: boolean;
  actionText: string | null;
  actionDue: string | null;
};

export function WhatChangedFeed({
  items,
  tool,
  actionOnly,
}: {
  items: UpdateFeedItem[];
  tool?: string;
  actionOnly?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label htmlFor="tool-filter">Tool</Label>
          <NativeSelect
            id="tool-filter"
            value={tool ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              const params = new URLSearchParams();
              if (value) {
                params.set("tool", value);
              }
              if (actionOnly) {
                params.set("action", "1");
              }
              router.push(params.toString() ? `/what-changed?${params}` : "/what-changed");
            }}
          >
            <option value="">All tools</option>
            {updateTools.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </NativeSelect>
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(actionOnly)}
            onChange={(event) => {
              const params = new URLSearchParams();
              if (tool) {
                params.set("tool", tool);
              }
              if (event.target.checked) {
                params.set("action", "1");
              }
              router.push(params.toString() ? `/what-changed?${params}` : "/what-changed");
            }}
          />
          Action required only
        </label>
      </div>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.slug}>
            <Card>
              <CardHeader>
                <CardTitle>
                  <Link href={`/what-changed/${item.slug}`} className="hover:underline">
                    {item.title}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted">{item.date}</p>
                <div className="flex flex-wrap gap-2">
                  {item.tools.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
                {item.actionRequired && item.actionDue ? (
                  <p>
                    Action required by {formatDate(item.actionDue)}
                    {item.actionText ? `: ${item.actionText}` : ""}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
