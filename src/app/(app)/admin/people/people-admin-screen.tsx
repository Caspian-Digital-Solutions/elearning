"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PersonRecord } from "@/lib/people/types";
import { markPersonAsLeaver } from "./actions";

type Row = {
  id: string;
  name: string;
  email: string;
  department: string;
  active: string;
  leftAt: string;
};

const columns: DataColumn<Row>[] = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "department", header: "Department" },
  { key: "active", header: "Active" },
  { key: "leftAt", header: "Left date" },
];

export function PeopleAdminScreen({
  people,
  currentUserId,
  activeAdminCount,
}: {
  people: PersonRecord[];
  currentUserId: string;
  activeAdminCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [leaver, setLeaver] = useState<PersonRecord | null>(null);
  const [reason, setReason] = useState("");

  const rows: Row[] = people.map((person) => ({
    id: person.id,
    name: person.name,
    email: person.email,
    department: person.departmentName ?? "—",
    active: person.isActive ? "Yes" : "No",
    leftAt: person.leftAt ?? "—",
  }));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <Link href="/admin/retention" className="font-medium text-accent-strong underline underline-offset-2">
          Open retention list
        </Link>{" "}
        for people past the 12-month retention period after leaving.
      </p>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey="id"
        caption="All people"
        exportFileName="admin-people.csv"
        rowActions={(row) => {
          const person = people.find((item) => item.id === row.id);
          const isLastActiveAdmin =
            Boolean(person?.isActive && person.role === "admin" && activeAdminCount <= 1);
          return (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" render={<a href={`/admin/people/export/${row.id}`} />}>
              Export data
            </Button>
            {isLastActiveAdmin ? (
              <span className="text-xs text-muted-foreground">Cannot mark the last active admin as a leaver.</span>
            ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={row.id === currentUserId || row.active === "No"}
              onClick={() => {
                setLeaver(person ?? null);
                setReason("");
                setError(null);
              }}
            >
              Mark as leaver
            </Button>
            )}
          </div>
          );
        }}
      />
      <Dialog open={Boolean(leaver)} onOpenChange={(open) => !open && setLeaver(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark {leaver?.name} as a leaver</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This deactivates their account and records their leaving date. Data is kept for the retention period; nothing
            is deleted automatically.
          </p>
          <div className="space-y-2">
            <Label htmlFor="leaver-reason">Reason (required)</Label>
            <Textarea id="leaver-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
          </div>
          <FormError>{error}</FormError>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLeaver(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending || reason.trim().length < 10}
              onClick={() => {
                if (!leaver) {
                  return;
                }
                startTransition(async () => {
                  const result = await markPersonAsLeaver({ userId: leaver.id, reason });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  toast.success("Marked as leaver.");
                  setLeaver(null);
                  window.location.reload();
                });
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
