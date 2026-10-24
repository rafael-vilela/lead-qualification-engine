// Small helpers shared by adapters so every source produces clean, typed signals.

export function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function toCount(value) {
  return Math.floor(clampNumber(value, 0, Number.MAX_SAFE_INTEGER));
}

// Only a literal `true` counts. Strings like "yes" are treated as unknown/false.
export function toFlag(value) {
  return value === true;
}

export function rawSource(lead, source) {
  const raw = lead?.mockSources?.[source];
  return raw && typeof raw === 'object' ? raw : null;
}
