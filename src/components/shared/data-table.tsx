"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DataColumn<T extends Record<string, string>> = {
  key: keyof T & string;
  header: string;
};

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safe)) {
    return `"${safe.replaceAll('"', '""')}"`;
  }
  return safe;
}

export function DataTable<T extends Record<string, string>>({
  columns,
  rows,
  caption,
  exportFileName = "export.csv",
}: {
  columns: readonly DataColumn<T>[];
  rows: readonly T[];
  caption: string;
  exportFileName?: string;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (!needle) {
        return true;
      }
      return columns.some((column) =>
        row[column.key].toLowerCase().includes(needle),
      );
    });

    if (!sortKey) {
      return filtered;
    }

    return [...filtered].sort((left, right) => {
      const result = left[sortKey].localeCompare(right[sortKey], "en", {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? result : -result;
    });
  }, [columns, query, rows, sortDirection, sortKey]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function exportCsv() {
    const header = columns.map((column) => csvCell(column.header)).join(",");
    const body = visibleRows
      .map((row) => columns.map((column) => csvCell(row[column.key])).join(","))
      .join("\n");
    const blob = new Blob([`${header}\n${body}\n`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-full space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-sm space-y-1.5">
          <Label htmlFor="table-filter">Filter</Label>
          <Input
            id="table-filter"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type to filter"
          />
        </div>
        <Button type="button" variant="outline" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
      <Table>
        <TableCaption className="text-left">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            {columns.map((column) => {
              const sorted = sortKey === column.key;
              const ariaSort = sorted
                ? sortDirection === "asc"
                  ? "ascending"
                  : "descending"
                : "none";
              return (
                <TableHead key={column.key} aria-sort={ariaSort}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left font-medium"
                    onClick={() => toggleSort(column.key)}
                  >
                    {column.header}
                    <span className="sr-only">
                      {sorted
                        ? sortDirection === "asc"
                          ? ", sorted ascending"
                          : ", sorted descending"
                        : ", not sorted"}
                    </span>
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length}>No rows match that filter.</TableCell>
            </TableRow>
          ) : (
            visibleRows.map((row) => (
              <TableRow key={row[columns[0].key]}>
                {columns.map((column) => (
                  <TableCell key={column.key}>{row[column.key]}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
