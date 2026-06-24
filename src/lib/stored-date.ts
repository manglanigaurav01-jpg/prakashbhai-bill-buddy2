// Stored date helper:
// We store dates in a way that prevents timezone shifts (e.g. selecting 7th becoming 6th).
//
// Strategy:
// - When saving, set time to local noon and store as ISO string.
// - When reading, handle both old "YYYY-MM-DD" (no time) and newer ISO strings.

export const toStoredDateISO = (date: Date): string => {
  const d = new Date(date);
  // Local noon avoids crossing the previous/next day due to timezone conversions.
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

export const parseStoredDateToLocal = (value: string): Date => {
  if (!value) return new Date();

  // New format: full ISO datetime (contains 'T')
  if (value.includes('T')) {
    return new Date(value);
  }

  // Old format: "YYYY-MM-DD"
  const parts = value.split('-').map((n) => Number(n));
  const [y, m, d] = parts;
  if (!y || !m || !d) return new Date(value);

  // Store as noon local too (for consistent UI).
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

