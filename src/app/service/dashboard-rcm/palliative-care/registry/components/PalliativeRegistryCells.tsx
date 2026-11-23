'use client'

import React, { useState, useEffect } from 'react'
import { PalliativeRegistryItem, VisitRepItem } from '@/lib/clinical/palliativeRegistryService'
import { formatThaiDate } from '@/lib/formatters'

export const PROJECT_CODE_PRESETS = [
  '30001, Cons01',
  'Eva001 เฉพาะกรณีปรับยา',
  'PALDS เฉพาะกรณีเคสที่มีแผล',
  'O2 เฉพาะกรณี Home Oxigen',
]

export interface EditableTextCellProps {
  value: string | null | undefined
  placeholder?: string
  canEdit: boolean
  isEditing: boolean
  onStartEdit: () => void
  onSave: (val: string) => void
  onCancel: () => void
  className?: string
  style?: React.CSSProperties
}

export function EditableTextCell({
  value,
  placeholder = '-',
  canEdit,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  className = '',
  style = {},
}: EditableTextCellProps) {
  const [temp, setTemp] = useState(value || '')

  useEffect(() => {
    setTemp(value || '')
  }, [value, isEditing])

  if (!canEdit) {
    return <span style={style}>{value || placeholder}</span>
  }

  if (isEditing) {
    return (
      <input
        type="text"
        className="pcr-sheet-input"
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onBlur={() => {
          if (temp.trim() !== (value || '').trim()) {
            onSave(temp.trim())
          } else {
            onCancel()
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onSave(temp.trim())
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        autoFocus
      />
    )
  }

  return (
    <div
      className={`pcr-sheet-cell ${className}`}
      style={{ minHeight: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}
      onClick={onStartEdit}
      title="คลิกเพื่อแก้ไข (Google Sheets Mode)"
    >
      <span>{value || placeholder}</span>
    </div>
  )
}

export interface EditableVisitCellProps {
  item: PalliativeRegistryItem
  visitNum: number
  canEdit: boolean
  onSaveDate: (val: string) => void
}

export interface RepAmountBadgeProps {
  rep?: string | null
  compensated?: number | string | null
  reason?: string | null
  source?: string | null
}

export function RepAmountBadge({
  rep,
  compensated,
  reason,
  source,
}: RepAmountBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const amount = Number(compensated || 0)
  const isPaid = amount > 0
  const amountStr = `${amount.toLocaleString()} ฿`

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !isExpanded
    setIsExpanded(next)

    if (rep && next) {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(rep).then(() => {
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
          }).catch(() => {})
        }
      } catch {
        // ignore
      }
    }
  }

  return (
    <button
      type="button"
      className={`pcr-rep-badge ${isPaid ? 'pcr-rep-paid' : 'pcr-rep-zero'}`}
      onClick={handleClick}
      title={
        isExpanded
          ? 'คลิกเพื่อย่อ'
          : `เลขที่หนังสือ (Rep): ${rep || '-'}${reason ? `\nสาเหตุ: ${reason}` : ''}${source ? `\nแหล่งข้อมูล: ${source}` : ''}\n(คลิกเพื่อดูและคัดลอกเลข Rep)`
      }
      aria-expanded={isExpanded}
    >
      <span className="pcr-rep-amount">{amountStr}</span>
      {isExpanded && (
        <span className="pcr-rep-detail">
          Rep: {rep || '-'}
          {isCopied ? ' (คัดลอกแล้ว)' : ''}
          {reason ? ` (${reason})` : ''}
        </span>
      )}
    </button>
  )
}

export function EditableVisitCell({
  item,
  visitNum,
  canEdit,
  onSaveDate,
}: EditableVisitCellProps) {
  const visitObj = item.visits?.find((v) => v.visitNo === visitNum)
  const date = visitObj?.visitDate || (visitNum <= 6 ? (item as any)[`visit${visitNum}Date`] : '') || ''
  const rep = visitObj?.rep || (visitNum <= 6 ? (item as any)[`visit${visitNum}Rep`] : '') || ''
  const compensated =
    visitObj !== undefined && visitObj.compensated !== undefined
      ? visitObj.compensated
      : visitNum <= 6
        ? (item as any)[`visit${visitNum}Compensated`]
        : 0
  const reason = visitObj?.reason || (visitNum <= 6 ? (item as any)[`visit${visitNum}Reason`] : '') || ''
  const repItems = (
    Array.isArray(visitObj?.repItems)
      ? visitObj?.repItems
      : Array.isArray((item as any)[`visit${visitNum}RepItems`])
        ? (item as any)[`visit${visitNum}RepItems`]
        : []
  ) as VisitRepItem[]

  const latestRep = repItems.length > 0 ? repItems[0] : null
  const displayRep = latestRep?.rep || rep || ''
  const displayComp = latestRep !== null ? latestRep.compensated : compensated
  const displayReason = latestRep?.reason || reason || ''
  const displaySource = latestRep?.source

  const hasComp = displayComp !== undefined && displayComp !== null && Number(displayComp) > 0
  const hasRep = Boolean(displayRep || hasComp)

  return (
    <div className="pcr-visit-card">
      {canEdit ? (
        <input
          type="text"
          className="pcr-sheet-date-input"
          placeholder="วว/ดด/ปปปป"
          defaultValue={date}
          key={`${item.id}-v${visitNum}-${date}`}
          onBlur={(e) => {
            if (e.target.value.trim() !== date.trim()) {
              onSaveDate(e.target.value.trim())
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            }
          }}
          title={`วันที่เยี่ยมครั้งที่ ${visitNum} (Enter เพื่อบันทึก)`}
        />
      ) : (
        date && <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{formatThaiDate(date)}</div>
      )}

      {date ? (
        hasRep ? (
          <RepAmountBadge
            rep={displayRep}
            compensated={displayComp}
            reason={displayReason}
            source={displaySource}
          />
        ) : (
          <span className="pcr-rep-badge pcr-rep-pending" title="ยังไม่พบข้อมูลในระบบชดเชย RCM">
            รอผลชดเชย
          </span>
        )
      ) : (
        !canEdit && <span style={{ color: 'var(--pc-muted)', fontSize: '0.75rem' }}>-</span>
      )}

      {displayReason && !displayRep && (
        <span className="pcr-remark-badge" title={`เหตุผล: ${displayReason}`}>
          {displayReason}
        </span>
      )}
    </div>
  )
}

export interface EditableDeathCellProps {
  item: PalliativeRegistryItem
  canEdit: boolean
  onSaveDate: (val: string) => void
  isSavedDate?: boolean
}

export function EditableDeathCell({
  item,
  canEdit,
  onSaveDate,
  isSavedDate,
}: EditableDeathCellProps) {
  const date = (item.deathDate || '').trim()
  const isDeceased = Boolean(date)

  return (
    <td
      style={{ fontSize: '0.8rem', minWidth: 95 }}
      className={`${isSavedDate ? 'just-saved' : ''} ${isDeceased ? 'pcr-cell-death' : ''}`}
      title={isDeceased ? `ผู้ป่วยเสียชีวิต: ${formatThaiDate(date)}` : undefined}
    >
      {canEdit ? (
        <input
          type="text"
          className={`pcr-sheet-date-input ${isDeceased ? 'pcr-death-input' : ''}`}
          placeholder="วว/ดด/ปปปป"
          defaultValue={date}
          key={`${item.id}-death-${date}`}
          onBlur={(e) => {
            if (e.target.value.trim() !== date.trim()) {
              onSaveDate(e.target.value.trim())
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          title="วันที่เสียชีวิต (Enter เพื่อบันทึก)"
        />
      ) : date ? (
        <span className="pcr-death-chip">{formatThaiDate(date)}</span>
      ) : (
        '-'
      )}
    </td>
  )
}
