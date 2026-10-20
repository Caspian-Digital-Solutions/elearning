import type { NextRequest } from "next/server";
import { authorise } from "@/lib/auth";
import { formatChanges, loadAuditExport, parseAuditFilters } from "@/lib/audit/queries";
import { toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";

/** The audit log as CSV, with the same filters as the page. Admin only. */
export async function GET(request: NextRequest) {
  if (!(await authorise(["admin"]))) {
    return new Response("Only an admin can export the audit log.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const filters = parseAuditFilters(request.nextUrl.searchParams);
  const { entries } = await loadAuditExport(filters);
  const csv = toCsv(
    ["When (Malaysia time)", "Who", "Action", "Table", "Person or record", "Changes", "Reason"],
    entries.map((entry) => [
      formatDateTime(entry.at),
      entry.who,
      entry.action,
      entry.table,
      entry.affected,
      formatChanges(entry.changes),
      entry.reason,
    ]),
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="cds-ai-academy-audit-log.csv"',
      "cache-control": "private, no-store",
    },
  });
}
