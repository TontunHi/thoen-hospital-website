import type React from 'react'

// Ordered reference values from mishos-rh1
export const ORDER = {
  l: ['A', 'S', 'M1', 'M2', 'F1', 'F2', 'F3'],
  g: [
    'รพศ.A B>700to1000',
    'รพท.S B>400',
    'รพท.S B<=400',
    'รพท.M1 B>200',
    'รพช.M2 B>100',
    'รพช.M2 B<=100',
    'รพช.F1 P50,000-100,000',
    'รพช.F1 P<=50,000',
    'รพช.F2 P30,000-60,000',
    'รพช.F2 P<=30,000',
    'รพช.F3 P15,000-25,000',
    'รพช.F3 P<=15,000',
  ],
}

// Heatmap color generator from original mishos-rh1
export function heatRGB(t: number) {
  const A = [217, 83, 79],
    B = [242, 201, 76],
    C = [58, 167, 109]
  const [p, q, u] = t < 0.5 ? [A, B, t / 0.5] : [B, C, (t - 0.5) / 0.5]
  return `rgb(${p.map((x, i) => Math.round(x + (q[i] - x) * u)).join(',')})`
}

export function heatStyle(rk: number, n: number): React.CSSProperties {
  if (!rk || n <= 1) return {}
  const t = (n - rk) / (n - 1)
  return {
    backgroundColor: heatRGB(t),
    color: t < 0.35 || t > 0.65 ? '#ffffff' : '#14191f',
  }
}

export function rankWithin(vals: Float64Array, idx: number[], out: Int16Array) {
  const nz = idx.filter(i => vals[i] !== 0).sort((a, b) => Math.round(vals[b]) - Math.round(vals[a]))
  let r = 0,
    prev: number | null = null
  nz.forEach((i, k) => {
    const q = Math.round(vals[i])
    if (prev === null || q !== prev) {
      r = k + 1
      prev = q
    }
    out[i] = r
  })
  return nz.length
}

export function calcMedian(arr: number[]): number {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
