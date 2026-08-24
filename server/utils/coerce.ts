/** Safe coercion helpers for untrusted Xtream payloads. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asOptionalTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Xtream reports booleans as 0/1, "1"/"0" or true/false depending on server. */
export function asTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** Numeric ids may arrive as numbers or strings; anything else is absent. */
export function asIdentifier(value: unknown): string | null {
  const numeric = asFiniteNumber(value);
  if (numeric !== null) return String(numeric);
  return asOptionalTrimmedString(value);
}

export function asHttpUrlOrNull(value: unknown): string | null {
  const raw = asOptionalTrimmedString(value);
  if (raw === null) return null;
  return /^https?:\/\//i.test(raw) ? raw : null;
}

export function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}
