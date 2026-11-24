'use client'

import React, { useState, useMemo } from 'react'
import { Tags, ChevronDown, ChevronUp, X, Layers } from 'lucide-react'
import {
  type RepBreakdownSummary,
  type RepTagGroupSummary,
} from '@/lib/clinical/rcmRepTagHelper'

export interface RcmRepTagDashboardProps {
  repBreakdown: RepBreakdownSummary
  selectedReps: string[]
  onSelectGroupReps: (reps: string[]) => void
  onClearReps: () => void
}

function formatMoney(val?: number | null): string {
  const num = Number(val ?? 0)
  if (!Number.isFinite(num) || num === 0) return '0.00'
  return num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function RcmRepTagDashboard({
  repBreakdown,
  selectedReps,
  onSelectGroupReps,
  onClearReps,
}: RcmRepTagDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const selectedSet = useMemo(() => new Set(selectedReps), [selectedReps])

  const isGroupActive = (group: RepTagGroupSummary): boolean => {
    if (group.reps.length === 0 || selectedReps.length === 0) return false
    return group.reps.every((r) => selectedSet.has(r))
  }

  const handleGroupClick = (group: RepTagGroupSummary) => {
    if (group.reps.length === 0) return
    if (isGroupActive(group)) {
      const groupSet = new Set(group.reps)
      const remaining = selectedReps.filter((r) => !groupSet.has(r))
      onSelectGroupReps(remaining)
    } else {
      onSelectGroupReps(Array.from(new Set([...selectedReps, ...group.reps])))
    }
  }

  return (
    <section
      aria-label="สรุปผลแยกตาม TAG เลข REP"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8e0',
        borderRadius: '16px',
        padding: '16px 20px',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              backgroundColor: '#e8f5e9',
              color: '#0d7446',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Tags size={18} aria-hidden="true" />
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#0f172a',
                lineHeight: 1.3,
              }}
            >
              สรุปผลแยกตาม TAG เลข REP
            </h2>
            <div
              style={{
                fontSize: '0.78rem',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span>
                มีเลข REP แล้ว{' '}
                <strong style={{ color: '#0f172a' }}>
                  {repBreakdown.withAnyRepCount.toLocaleString('th-TH')}
                </strong>{' '}
                / {repBreakdown.totalVisits.toLocaleString('th-TH')} ครั้ง
              </span>
              <span>•</span>
              <span>
                จำนวนใบ REP ทั้งหมด{' '}
                <strong style={{ color: '#0f172a' }}>
                  {repBreakdown.repItems.length.toLocaleString('th-TH')}
                </strong>{' '}
                ใบ
              </span>
              {repBreakdown.withMultipleRepsCount > 0 && (
                <>
                  <span>•</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#6b21a8',
                      fontWeight: 600,
                    }}
                  >
                    <Layers size={13} aria-hidden="true" />
                    มีหลาย REP: {repBreakdown.withMultipleRepsCount.toLocaleString('th-TH')} ครั้ง
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectedReps.length > 0 && (
            <button
              type="button"
              onClick={onClearReps}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                cursor: 'pointer',
              }}
            >
              <X size={14} aria-hidden="true" />
              ล้างตัวกรอง REP ({selectedReps.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 600,
              backgroundColor: '#f8fafc',
              color: '#334155',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
            }}
          >
            <span>{isExpanded ? 'ย่อสรุป' : 'แสดงสรุป'}</span>
            {isExpanded ? (
              <ChevronUp size={14} aria-hidden="true" />
            ) : (
              <ChevronDown size={14} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* TAG Group Summary Cards */}
          {repBreakdown.tagGroups.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: '#64748b', padding: '8px 0' }}>
              ยังไม่มีข้อมูลเลขที่ REP ในช่วงเวลาที่เลือก
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '10px',
              }}
            >
              {repBreakdown.tagGroups.map((group) => {
                const active = isGroupActive(group)
                const isSeamless = group.source === 'seamless'
                const isNone = group.source === 'none'

                const badgeBg = isNone ? '#fef3c7' : isSeamless ? '#f3e8ff' : '#e0f2fe'
                const badgeColor = isNone ? '#92400e' : isSeamless ? '#6b21a8' : '#0369a1'
                const badgeBorder = isNone ? '#fde68a' : isSeamless ? '#e9d5ff' : '#bae6fd'
                const activeBorder = isNone ? '#d97706' : isSeamless ? '#7e22ce' : '#0284c7'

                return (
                  <button
                    key={group.groupKey}
                    type="button"
                    onClick={() => handleGroupClick(group)}
                    aria-pressed={active}
                    title={`คลิกเพื่อกรองตามกลุ่ม TAG: ${group.label}`}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      backgroundColor: active
                        ? isNone
                          ? '#fffbeb'
                          : isSeamless
                            ? '#faf5ff'
                            : '#f0f9ff'
                        : '#f8fafc',
                      border: active ? `1.5px solid ${activeBorder}` : '1px solid #e2e8f0',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      transition: 'border-color 150ms ease, background-color 150ms ease',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '9999px',
                          backgroundColor: badgeBg,
                          color: badgeColor,
                          border: `1px solid ${badgeBorder}`,
                        }}
                      >
                        {isNone
                          ? 'ไม่มี REP'
                          : isSeamless
                            ? `Seamless${group.prefix ? ` · ${group.prefix}` : ''}`
                            : 'e-Claim หลัก'}
                      </span>
                      {!isNone && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: '#64748b',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {group.repCount} ใบ REP
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: '#0f172a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={group.label}
                    >
                      {group.label}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: '8px',
                        marginTop: '2px',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                        {group.visitCount.toLocaleString('th-TH')} ครั้ง
                      </span>
                      {!isNone && (
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: isSeamless ? '#6b21a8' : '#047857',
                          }}
                        >
                          {formatMoney(group.compensated)} ฿
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default RcmRepTagDashboard
