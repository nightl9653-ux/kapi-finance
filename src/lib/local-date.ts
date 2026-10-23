export function localTodayISO(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalISO(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function formatLocalISO(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Inclusive day count. Returns null when the end is before the start. */
export function inclusiveTripDays(start: string, end: string): number | null {
  const a = parseLocalISO(start);
  const b = parseLocalISO(end);
  if (!a || !b) return null;
  const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  if (diff < 0) return null;
  return diff + 1;
}

/** End date for a trip that starts on `start` and lasts `days` calendar days. */
export function endDateFromTripDays(start: string, days: number): string | null {
  const dt = parseLocalISO(start);
  if (!dt || !Number.isFinite(days) || days < 1) return null;
  dt.setDate(dt.getDate() + Math.round(days) - 1);
  return formatLocalISO(dt);
}

