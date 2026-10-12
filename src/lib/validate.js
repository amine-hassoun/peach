// Returns an i18n error key, or null when the stay is acceptable.
// ISO dates compare correctly as plain strings, so no Date objects are needed.
export function validateStay({ entry, exit, ongoing }, todayISO) {
  if (!entry) return 'err.required';
  if (ongoing) return entry > todayISO ? 'err.futureOngoing' : null;
  if (!exit) return 'err.exitRequired';
  if (exit < entry) return 'err.exitBefore';
  return null;
}
