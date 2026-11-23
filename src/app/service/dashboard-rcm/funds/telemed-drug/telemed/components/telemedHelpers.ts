export const THAI_MONTHS = [
  { value: 1, label: 'มกราคม' },
  { value: 2, label: 'กุมภาพันธ์' },
  { value: 3, label: 'มีนาคม' },
  { value: 4, label: 'เมษายน' },
  { value: 5, label: 'พฤษภาคม' },
  { value: 6, label: 'มิถุนายน' },
  { value: 7, label: 'กรกฎาคม' },
  { value: 8, label: 'สิงหาคม' },
  { value: 9, label: 'กันยายน' },
  { value: 10, label: 'ตุลาคม' },
  { value: 11, label: 'พฤศจิกายน' },
  { value: 12, label: 'ธันวาคม' },
]

export function formatMoney(val?: number | null): string {
  if (val == null || val === 0) return '—'
  return val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function maskCid(cid?: string | null): string {
  if (!cid) return '—'
  const clean = cid.replace(/\D/g, '')
  if (clean.length === 13) {
    return `${clean[0]}-${clean.slice(1, 5)}-xxxxx-${clean.slice(10, 12)}-${clean[12]}`
  }
  return cid
}

export function cleanStatusName(status?: string | null, isCompensated?: boolean): string {
  if (!status) return isCompensated ? 'ชดเชยแล้ว' : 'รอชดเชย / ยังไม่ส่ง'
  const clean = status.replace(/^[-\s:]+/, '').trim()
  if (clean.toLowerCase().includes('rep') || isCompensated) return 'ชดเชยแล้ว'
  if (clean.includes('ยังไม่ได้ส่ง') || clean.includes('ยังไม่ส่ง')) return 'รอชดเชย / ยังไม่ส่ง'
  return clean || (isCompensated ? 'ชดเชยแล้ว' : 'รอชดเชย / ยังไม่ส่ง')
}

export interface ConsolidatedDrug {
  item_code: string
  item_name: string
  units: string
  qty: number
  sum_price: number
}

export function consolidateDrugs(items?: any[]): ConsolidatedDrug[] {
  if (!items || !Array.isArray(items)) return []
  const map = new Map<string, ConsolidatedDrug>()
  for (const item of items) {
    const key = (item.item_code || item.item_name || '').trim()
    const qty = Number(item.qty) || 0
    const price = Number(item.sum_price) || 0
    const existing = map.get(key)
    if (existing) {
      existing.qty += qty
      existing.sum_price += price
    } else {
      map.set(key, {
        item_code: item.item_code || '',
        item_name: item.item_name || '',
        units: item.units || 'หน่วย',
        qty,
        sum_price: price,
      })
    }
  }
  return Array.from(map.values())
}

export type CompensationCard = 'COMPENSATED' | 'UNCOMPENSATED'
export type ClaimCard = 'WITH_AUTHEN' | 'NO_AUTHEN'

export interface ActiveCardsState {
  compensation?: CompensationCard
  claim?: ClaimCard
  hasFee?: boolean
  ucOnly?: boolean
  exportCode5?: boolean
}
