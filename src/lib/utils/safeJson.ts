/**
 * Safely parses a JSON string (or returns an already-parsed value) with a typed fallback.
 * Replaces repetitive `try { JSON.parse(...) } catch {}` blocks across services.
 */
export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  if (typeof value !== 'string') {
    return value as T
  }
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
