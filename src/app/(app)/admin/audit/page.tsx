import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authorise } from "@/lib/auth";
import {
  auditPageSize,
  auditTableNames,
  loadAuditPage,
  parseAuditFilters,
  type AuditEntry,
  type AuditFilters,
} from "@/lib/audit/queries";
import { formatDateTime } from "@/lib/format";
import { loadPeople } from "@/lib/people/directory";

export const metadata: Metadata = {
  title: "Audit log",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Audit log"
        purpose="Who changed what, and when. Read-only. Times are Malaysia time (Asia/Kuala_Lumpur)."
      />
      <Suspense fallback={<Skeleton className="h-96" aria-busy="true" aria-label="Loading the audit log" />}>
        <AuditData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function ChangeList({ entry }: { entry: AuditEntry }) {
  if (entry.changes.length === 0) {
    return <span className="text-muted-foreground">No field changes</span>;
  }
  const list = (
    <ul className="space-y-0.5">
      {entry.changes.map((change) => (
        <li key={change.field}>
          <span className="font-mono text-xs">{change.field}</span>: {change.before} → {change.after}
        </li>
      ))}
    </ul>
  );
  if (entry.action === "Changed" || entry.changes.length <= 8) {
    return list;
  }
  return (
    <details>
      <summary className="cursor-pointer text-accent-strong underline-offset-4 hover:underline">
        Show {entry.changes.length} fields
      </summary>
      <div className="mt-1">{list}</div>
    </details>
  );
}

function queryString(filters: AuditFilters, page?: number) {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.who) params.set("who", filters.who);
  if (filters.table) params.set("table", filters.table);
  if (filters.person) params.set("person", filters.person);
  if (page && page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function AuditData({ searchParams }: { searchParams: SearchParams }) {
  if (!(await authorise(["admin"]))) {
    return null;
  }
  const filters = parseAuditFilters(await searchParams);
  const [{ entries, total, page, pageCount }, people] = await Promise.all([loadAuditPage(filters), loadPeople()]);
  const first = total === 0 ? 0 : (page - 1) * auditPageSize + 1;
  const last = Math.min(total, page * auditPageSize);
  const filtered = Boolean(filters.from || filters.to || filters.who || filters.table || filters.person);

  return (
    <div className="space-y-4">
      <form method="get" action="/admin/audit" className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="audit-from">From</Label>
          <Input id="audit-from" name="from" type="date" defaultValue={filters.from ?? ""} className="w-full lg:w-40" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-to">To</Label>
          <Input id="audit-to" name="to" type="date" defaultValue={filters.to ?? ""} className="w-full lg:w-40" />
        </div>
        <div className="space-y-1.5 lg:min-w-48">
          <Label htmlFor="audit-who">Who</Label>
          <NativeSelect id="audit-who" name="who" defaultValue={filters.who ?? ""}>
            <option value="">Anyone</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5 lg:min-w-40">
          <Label htmlFor="audit-table">Table</Label>
          <NativeSelect id="audit-table" name="table" defaultValue={filters.table ?? ""}>
            <option value="">All tables</option>
            {Object.entries(auditTableNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5 lg:min-w-48">
          <Label htmlFor="audit-person">Person affected</Label>
          <NativeSelect id="audit-person" name="person" defaultValue={filters.person ?? ""}>
            <option value="">Anyone</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={buttonVariants()}>
            Apply filters
          </button>
          {filtered ? (
            <Link href="/admin/audit" className={buttonVariants({ variant: "ghost" })}>
              Clear filters
            </Link>
          ) : null}
          <a
            href={`/admin/audit/export${queryString(filters)}`}
            className={buttonVariants({ variant: "outline" })}
            download
          >
            Export CSV
          </a>
        </div>
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total === 0 ? "No entries" : `Showing ${first} to ${last} of ${total} entries`}
        {filtered ? " that match the filters" : ""}. Newest first.
      </p>

      <Table>
        <TableCaption className="text-left">
          Every change to people, roles, cohorts and settings. Only changed fields are shown.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Table</TableHead>
            <TableHead>Person or record</TableHead>
            <TableHead>Changes</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>
                {filtered
                  ? "No changes match these filters."
                  : "No changes yet. Changes to people, roles, cohorts and settings appear here automatically."}
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => (
              <TableRow key={entry.id} className="align-top">
                <TableCell className="whitespace-nowrap">{formatDateTime(entry.at)}</TableCell>
                <TableCell>{entry.who}</TableCell>
                <TableCell>{entry.action}</TableCell>
                <TableCell>{entry.table}</TableCell>
                <TableCell className="font-medium">{entry.affected}</TableCell>
                <TableCell className="min-w-64 whitespace-normal">
                  <ChangeList entry={entry} />
                </TableCell>
                <TableCell className="min-w-48 whitespace-normal">{entry.reason}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {pageCount > 1 ? (
        <nav aria-label="Audit log pages" className="flex items-center justify-between gap-2">
          {page > 1 ? (
            <Link href={`/admin/audit${queryString(filters, page - 1)}`} className={buttonVariants({ variant: "outline" })}>
              Newer entries
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </p>
          {page < pageCount ? (
            <Link href={`/admin/audit${queryString(filters, page + 1)}`} className={buttonVariants({ variant: "outline" })}>
              Older entries
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
