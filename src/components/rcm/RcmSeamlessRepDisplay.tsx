import React from 'react'

export interface SeamlessRepBreakdown {
  rep: string
  fund: string | null
  type: string | null
  collected: number
  compensated: number
}

export function splitSeamlessReps(value?: string | null): string[] {
  if (!value) return []
  return Array.from(
    new Set(
      String(value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  )
}

function fmtMoney(val?: number | null): string {
  const num = Number(val ?? 0)
  if (!Number.isFinite(num) || num === 0) return '—'
  return num.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function getSeamlessCompensated(row: any): number {
  if (!row) return 0
  return Number(row.compensatedSeamless ?? row.compensated_seamless ?? 0) || 0
}

export function getSeamlessRepString(row: any): string | null {
  if (!row) return null
  const val =
    row.repSeamless ??
    row.rep_seamless ??
    (typeof row.seamless === 'string' && row.seamless !== 'Y' && row.seamless !== 'N'
      ? row.seamless
      : null)
  return val ? String(val).trim() || null : null
}

export function getSeamlessFunds(row: any): string | null {
  if (!row) return null
  const val = row.seamlessFunds ?? row.seamless_funds ?? row.fund_seamless ?? null
  return val ? String(val).trim() || null : null
}

export function getSeamlessRepItems(row: any): SeamlessRepBreakdown[] {
  if (!row) return []
  if (Array.isArray(row.seamlessRepItems) && row.seamlessRepItems.length > 0) {
    return row.seamlessRepItems
  }
  if (Array.isArray(row.seamless_rep_items) && row.seamless_rep_items.length > 0) {
    return row.seamless_rep_items
  }
  const reps = splitSeamlessReps(getSeamlessRepString(row))
  const comp = getSeamlessCompensated(row)
  const funds = getSeamlessFunds(row)
  return reps.map((rep, _idx, arr) => ({
    rep,
    fund: funds,
    type: row.seamless_type ? String(row.seamless_type) : null,
    collected: 0,
    compensated: arr.length === 1 ? comp : 0,
  }))
}

/**
 * แสดงบรรทัด `+ Seamless X,XXX.XX` (สีม่วง) ใต้ยอดชดเชย e-Claim ในคอลัมน์ "ชดเชยแล้ว"
 */
export function RcmSeamlessSubAmount({
  row,
  hasPrimaryAmount,
}: {
  row: any
  hasPrimaryAmount?: boolean
}) {
  const compSeamless = getSeamlessCompensated(row)
  if (compSeamless <= 0) return null
  const funds = getSeamlessFunds(row)
  const primary = hasPrimaryAmount ?? Number(row?.compensated ?? 0) > 0

  return (
    <div
      style={{
        fontSize: '11px',
        fontWeight: 600,
        color: '#6b21a8',
        whiteSpace: 'nowrap',
        lineHeight: 1.25,
        marginTop: primary ? '2px' : 0,
      }}
      title={`ชดเชยจาก Seamless${funds ? ` (${funds})` : ''}`}
    >
      {primary ? '+ ' : ''}Seamless {fmtMoney(compSeamless)}
    </div>
  )
}

/**
 * แสดงป้ายเลข Rep ของ Seamless (สีม่วง แสดงเฉพาะเลข Rep ล้วนๆ) สำหรับวางในคอลัมน์ Rep / สถานะ
 */
export function RcmSeamlessRepBadges({ row }: { row: any }) {
  const items = getSeamlessRepItems(row)
  if (items.length === 0) return null
  const funds = getSeamlessFunds(row)

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        marginTop: row?.rep ? '3px' : 0,
      }}
    >
      {items.map((item) => (
        <span
          key={`seamless-badge-${item.rep}`}
          className="font-mono"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 7px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            lineHeight: 1.25,
            backgroundColor: '#f3e8ff',
            color: '#6b21a8',
            border: '1px solid #e9d5ff',
            whiteSpace: 'nowrap',
          }}
          title={[
            'Seamless',
            item.fund || funds,
            item.type,
            item.collected > 0 ? `ขอเบิก ${fmtMoney(item.collected)} ฿` : null,
            item.compensated > 0 ? `ชดเชย ${fmtMoney(item.compensated)} ฿` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        >
          {item.rep}
        </span>
      ))}
    </div>
  )
}

/**
 * แสดงรายละเอียด Seamless (เลข Rep, ยอดรวม, กองทุน, และรายการแยกรายใบ Rep) ใน Modal รายละเอียดของทุกกองทุน
 */
export function RcmSeamlessModalSection({ item }: { item: any }) {
  if (!item) return null
  const items = getSeamlessRepItems(item)
  const compSeamless = getSeamlessCompensated(item)
  const funds = getSeamlessFunds(item)
  const repStr = items.map((i) => i.rep).join(', ')

  if (items.length === 0 && compSeamless <= 0) return null

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        marginTop: '8px',
        padding: '10px 12px',
        borderRadius: '8px',
        backgroundColor: '#faf5ff',
        border: '1px solid #e9d5ff',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b21a8' }}>
            เลข Rep Seamless {funds ? `(${funds})` : ''}
          </span>
          <span className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: '#581c87' }}>
            {repStr || '—'}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b21a8' }}>
            ชดเชยจาก Seamless (รวม)
          </span>
          <span
            className="tabular"
            style={{ fontSize: '13px', fontWeight: 700, color: '#6b21a8' }}
          >
            {fmtMoney(compSeamless)} บาท
          </span>
        </div>
      </div>

      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {items.map((repItem) => (
            <div
              key={`modal-seamless-${repItem.rep}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                padding: '5px 9px',
                borderRadius: '6px',
                backgroundColor: '#ffffff',
                border: '1px solid #e9d5ff',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span className="font-mono" style={{ fontWeight: 600, color: '#6b21a8' }}>
                  {repItem.rep}
                </span>
                {(repItem.type || repItem.fund) && (
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {[repItem.type, repItem.fund].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
              <div
                className="tabular"
                style={{ display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap' }}
              >
                {repItem.collected > 0 && (
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    ขอเบิก {fmtMoney(repItem.collected)} ฿
                  </span>
                )}
                <strong style={{ color: '#6b21a8' }}>
                  ชดเชย {fmtMoney(repItem.compensated)} ฿
                </strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
