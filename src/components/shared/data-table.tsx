"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

export type DataColumn<T extends Record<string, string>> = {
  key: keyof T & string;
  header: string;
  /** Another field to sort by, e.g. an ISO date behind a formatted date. */
  sortKey?: keyof T & string;
  /** Long text (notes, summaries) wraps instead of widening the table. */
  wrap?: boolean;
};

export type DataFilter<T extends Record<string, string>> = {
  key: keyof T & string;
  label: string;
  /** Defaults to every value that appears in the column. */
  options?: readonly string[];
};

export type QuickFilter<T extends Record<string, string>> = {
  label: string;
  matches: (row: T) => boolean;
};

export function downloadCsv(fileName: string, header: readonly string[], rows: readonly (readonly string[])[]) {
  const blob = new Blob([toCsv(header, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

const allValue = "__all__";

export function DataTable<T extends Record<string, string>>({
  columns,
  rows,
  caption,
  exportFileName = "export.csv",
  exportColumns,
  rowKey,
  filters = [],
  quickFilters = [],
  selectable = false,
  selected,
  onSelectedChange,
  rowLabel,
  rowActions,
  emptyMessage = "No rows match that filter.",
}: {
  columns: readonly DataColumn<T>[];
  rows: readonly T[];
  caption: string;
  exportFileName?: string;
  /** When set, CSV export uses these columns instead of the visible table columns. */
  exportColumns?: readonly DataColumn<T>[];
  rowKey?: keyof T & string;
  filters?: readonly DataFilter<T>[];
  quickFilters?: readonly QuickFilter<T>[];
  selectable?: boolean;
  selected?: ReadonlySet<string>;
  onSelectedChange?: (keys: Set<string>) => void;
  /** Names a row for screen readers, e.g. the person's name. */
  rowLabel?: (row: T) => string;
  rowActions?: (row: T) => ReactNode;
  emptyMessage?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [quickFilter, setQuickFilter] = useState<number | null>(null);

  const keyOf = (row: T) => row[rowKey ?? columns[0].key];

  const filterOptions = useMemo(
    () =>
      filters.map((filter) => {
        if (filter.options) {
          return filter.options;
        }
        const values = new Set(rows.map((row) => row[filter.key]).filter((value) => value !== ""));
        return [...values].sort((left, right) => left.localeCompare(right, "en"));
      }),
    [filters, rows],
  );

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (quickFilter !== null && !quickFilters[quickFilter]?.matches(row)) {
        return false;
      }
      for (const filter of filters) {
        const wanted = filterValues[filter.key];
        if (wanted && wanted !== allValue && row[filter.key] !== wanted) {
          return false;
        }
      }
      if (!needle) {
        return true;
      }
      return columns.some((column) => row[column.key].toLowerCase().includes(needle));
    });

    if (!sortKey) {
      return filtered;
    }

    const column = columns.find((item) => item.key === sortKey);
    const field = column?.sortKey ?? sortKey;
    return [...filtered].sort((left, right) => {
      const result = left[field].localeCompare(right[field], "en", {
        numeric: true,
        sensitivity: "base",
      });
      return sortDirection === "asc" ? result : -result;
    });
  }, [columns, filterValues, filters, query, quickFilter, quickFilters, rows, sortDirection, sortKey]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  function exportCsv() {
    const exportCols = exportColumns ?? columns;
    downloadCsv(
      exportFileName,
      exportCols.map((column) => column.header),
      visibleRows.map((row) => exportCols.map((column) => row[column.key])),
    );
  }

  const visibleKeys = visibleRows.map(keyOf);
  const selectedVisible = visibleKeys.filter((key) => selected?.has(key)).length;
  const allVisibleSelected = visibleKeys.length > 0 && selectedVisible === visibleKeys.length;

  function setRowSelected(key: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    onSelectedChange?.(next);
  }

  function setAllVisibleSelected(checked: boolean) {
    const next = new Set(selected);
    for (const key of visibleKeys) {
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
    }
    onSelectedChange?.(next);
  }

  const columnCount = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  return (
    <div className="max-w-full space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="w-full space-y-1.5 lg:max-w-xs">
          <Label htmlFor={`${id}-search`}>Search</Label>
          <Input
            id={`${id}-search`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type to search"
          />
        </div>
        {filters.map((filter, index) => (
          <div key={filter.key} className="w-full space-y-1.5 sm:w-auto sm:min-w-40">
            <Label htmlFor={`${id}-filter-${filter.key}`}>{filter.label}</Label>
            <NativeSelect
              id={`${id}-filter-${filter.key}`}
              value={filterValues[filter.key] ?? allValue}
              onChange={(event) =>
                setFilterValues((current) => ({ ...current, [filter.key]: event.target.value }))
              }
            >
              <option value={allValue}>All</option>
              {filterOptions[index].map((option) => (
                <option key={option} value={option}>
                  {option === "" ? "None" : option}
                </option>
              ))}
            </NativeSelect>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 lg:ml-auto">
          {quickFilters.map((filter, index) => (
            <Button
              key={filter.label}
              type="button"
              variant={quickFilter === index ? "default" : "outline"}
              aria-pressed={quickFilter === index}
              onClick={() => setQuickFilter((current) => (current === index ? null : index))}
            >
              {filter.label}
            </Button>
          ))}
          <Button type="button" variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {visibleRows.length} of {rows.length}
        {selectable && selected && selected.size > 0 ? `; ${selected.size} ticked` : ""}
      </p>
      <Table>
        <TableCaption className="text-left">{caption}</TableCaption>
        <TableHeader>
          <TableRow>
            {selectable ? (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="size-4 accent-accent-strong"
                  aria-label="Tick every row shown"
                  checked={allVisibleSelected}
                  ref={(element) => {
                    if (element) {
                      element.indeterminate = selectedVisible > 0 && !allVisibleSelected;
                    }
                  }}
                  onChange={(event) => setAllVisibleSelected(event.target.checked)}
                />
              </TableHead>
            ) : null}
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
                    <span aria-hidden="true" className="text-muted-foreground">
                      {sorted ? (sortDirection === "asc" ? "↑" : "↓") : ""}
                    </span>
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
            {rowActions ? (
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount}>{emptyMessage}</TableCell>
            </TableRow>
          ) : (
            visibleRows.map((row) => {
              const key = keyOf(row);
              const isSelected = selected?.has(key) ?? false;
              return (
                <TableRow key={key} data-state={isSelected ? "selected" : undefined}>
                  {selectable ? (
                    <TableCell>
                      <input
                        type="checkbox"
                        className="size-4 accent-accent-strong"
                        aria-label={`Tick ${rowLabel ? rowLabel(row) : key}`}
                        checked={isSelected}
                        onChange={(event) => setRowSelected(key, event.target.checked)}
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        column.key === columns[0].key && "font-medium",
                        column.wrap && "min-w-48 whitespace-normal",
                      )}
                    >
                      {row[column.key]}
                    </TableCell>
                  ))}
                  {rowActions ? <TableCell className="text-right">{rowActions(row)}</TableCell> : null}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
