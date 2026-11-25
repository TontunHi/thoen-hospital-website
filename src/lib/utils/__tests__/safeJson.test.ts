import { describe, it, expect } from 'vitest'
import { safeJsonParse } from '../safeJson'

describe('safeJsonParse', () => {
  it('parses valid JSON strings and preserves pre-parsed objects', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 })
    expect(safeJsonParse(['x', 'y'], [])).toEqual(['x', 'y'])
  })

  it('returns fallback on invalid JSON or empty values', () => {
    expect(safeJsonParse('{invalid', { ok: false })).toEqual({ ok: false })
    expect(safeJsonParse('', [])).toEqual([])
    expect(safeJsonParse(null, [])).toEqual([])
    expect(safeJsonParse(undefined, null)).toBeNull()
  })
})
