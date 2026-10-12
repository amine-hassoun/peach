// "Today" as a local calendar date. Not toISOString(): that is UTC and would give
// yesterday's or tomorrow's date for part of the day depending on the timezone.
export function localISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
