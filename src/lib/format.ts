const timeZone = "Asia/Kuala_Lumpur";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parts(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const map = Object.fromEntries(partsFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    day: Number(map.day),
    month: months[Number(map.month) - 1],
    year: map.year,
    time: `${map.hour}:${map.minute}`,
  };
}

/** "20 Oct 2026", in Malaysia time. Empty input gives an empty string. */
export function formatDate(value: string | Date | null | undefined): string {
  const p = value ? parts(value) : null;
  return p ? `${p.day} ${p.month} ${p.year}` : "";
}

/** "20 Oct 2026, 14:05", in Malaysia time. */
export function formatDateTime(value: string | Date | null | undefined): string {
  const p = value ? parts(value) : null;
  return p ? `${p.day} ${p.month} ${p.year}, ${p.time}` : "";
}

/** A calendar date stored without a time (e.g. a cohort start date), shown as "2 Nov 2026". */
export function formatCalendarDate(value: string | null | undefined): string {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  return match ? `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}` : "";
}

/** Start of a Malaysia calendar day (YYYY-MM-DD) as an ISO timestamp, for date-range filters. */
export function startOfMalaysiaDay(date: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00+08:00`).toISOString() : null;
}
