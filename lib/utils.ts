/** Pure, client-safe utility functions — no Node.js imports */

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function adjacentDates(dates: string[], current: string) {
  const idx  = dates.indexOf(current);
  const prev = idx < dates.length - 1 ? dates[idx + 1] : null;
  const next = idx > 0                ? dates[idx - 1] : null;
  return { prev, next };
}
