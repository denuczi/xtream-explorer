export function normalizeRating(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(',', '.');
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1 || parsed > 10) return null;
  const rounded = Math.round(parsed * 10) / 10;
  if (rounded < 1 || rounded > 10) return null;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  if (!/^(10|[1-9])(\.[0-9])?$/.test(text)) return null;
  return text;
}
