/** One CSV cell. Leading = + - @ are escaped so spreadsheet apps do not run them as formulas. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safe)) {
    return `"${safe.replaceAll('"', '""')}"`;
  }
  return safe;
}

export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return `${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}
