'use client'

import React, { useMemo, useState } from 'react'
import { Download, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import ThaiDatePicker from '@/components/ui/ThaiDatePicker'
import { formatThaiDate } from '@/lib/formatters'
import { THAI_MONTH_NAMES } from './rcmDateRangeUtils'

/* -------------------------------------------------------------------------- */
/* Number & Axis Helpers (dashboard-design/references/snippets.md)            */
/* -------------------------------------------------------------------------- */

const compactFormatter = new Intl.NumberFormat('th-TH', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Computes 0 and evenly spaced round ticks covering max (steps of 1, 2, 2.5, 5 × 10^n). */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw
  const length = Math.max(2, Math.ceil(max / step) + 1)
  return Array.from({ length }, (_, i) => +(i * step).toFixed(10))
}

/** Formats compact numbers for chart axes while keeping full precision in tooltips. */
export function formatCompactNumber(value: number, isCurrency = false): string {
  if (value === 0) return isCurrency ? '฿0' : '0'
  const prefix = isCurrency ? '฿' : ''
  if (Math.abs(value) < 1000) return `${prefix}${Math.round(value).toLocaleString('th-TH')}`
  return `${prefix}${compactFormatter.format(value)}`
}

/** Formats percentage shares honestly: never renders "0.0%" for a real tiny share. */
export function formatSharePct(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return '0%'
  if (pct < 0.1) return '<0.1%'
  if (pct < 1) return `${pct.toFixed(1)}%`
  return `${Math.round(pct)}%`
}

/* -------------------------------------------------------------------------- */
/* 1. Command Header                                                          */
/* -------------------------------------------------------------------------- */

export interface RcmCommandHeaderProps {
  code: string
  title: string
  icon: React.ReactNode
  dateMode: 'custom' | 'month' | 'year'
  onDateModeChange: (mode: 'custom' | 'month' | 'year') => void
  ds1: string
  ds2: string
  onDs1Change: (val: string) => void
  onDs2Change: (val: string) => void
  selectedMonth: number
  onSelectMonth: (month: number) => void
  monthYearBe: number
  selectedYear: number
  availableYears: number[]
  onSelectFiscalYear: (fiscalYear: number) => void
  loading: boolean
  exportDisabled: boolean
  onRefresh: () => void
  onExport: () => void
  extraToolbarSlot?: React.ReactNode
}

/** Single compact command bar: identity left, range + filter + actions right. */
export function RcmCommandHeader({
  code,
  title,
  icon,
  dateMode,
  onDateModeChange,
  ds1,
  ds2,
  onDs1Change,
  onDs2Change,
  selectedMonth,
  onSelectMonth,
  monthYearBe,
  selectedYear,
  availableYears,
  onSelectFiscalYear,
  loading,
  exportDisabled,
  onRefresh,
  onExport,
  extraToolbarSlot,
}: RcmCommandHeaderProps) {
  return (
    <header className="dd-header" aria-label="ส่วนควบคุมรายงาน">
      <div className="dd-header-left">
        <div className="dd-icon-square" aria-hidden="true">
          {icon}
        </div>
        <div className="dd-title-block">
          <div className="dd-title-row">
            <span className="dd-code-pill">{code}</span>
            <h1 className="dd-title">{title}</h1>
          </div>
          <div className="dd-range-meta dd-tnum">
            <span className="dd-live-dot" aria-hidden="true" />
            <span>
              {formatThaiDate(ds1)} – {formatThaiDate(ds2)}
            </span>
          </div>
        </div>
      </div>

      <div className="dd-toolbar">
        <div className="dd-segmented" role="tablist" aria-label="รูปแบบช่วงเวลา">
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'custom'}
            onClick={() => onDateModeChange('custom')}
            className={`dd-seg-btn ${dateMode === 'custom' ? 'active' : ''}`}
          >
            กำหนดเอง
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'month'}
            onClick={() => onDateModeChange('month')}
            className={`dd-seg-btn ${dateMode === 'month' ? 'active' : ''}`}
          >
            เดือน
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={dateMode === 'year'}
            onClick={() => onDateModeChange('year')}
            className={`dd-seg-btn ${dateMode === 'year' ? 'active' : ''}`}
          >
            ปีงบประมาณ
          </button>
        </div>

        {dateMode === 'year' && (
          <select
            aria-label="เลือกปีงบประมาณ"
            value={selectedYear}
            onChange={(e) => onSelectFiscalYear(Number(e.target.value))}
            className="dd-select dd-tnum"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                ปีงบฯ {y + 543}
              </option>
            ))}
          </select>
        )}

        {dateMode === 'month' && (
          <select
            aria-label="เลือกเดือน"
            value={selectedMonth}
            onChange={(e) => onSelectMonth(Number(e.target.value))}
            className="dd-select dd-tnum"
          >
            {THAI_MONTH_NAMES.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {name} {monthYearBe}
              </option>
            ))}
          </select>
        )}

        {dateMode === 'custom' && (
          <div className="dd-date-range-inline">
            <ThaiDatePicker
              value={ds1}
              onChange={onDs1Change}
              maxDate={ds2}
              aria-label="ตั้งแต่วันที่"
            />
            <span className="dd-range-sep">ถึง</span>
            <ThaiDatePicker
              value={ds2}
              onChange={onDs2Change}
              minDate={ds1}
              aria-label="ถึงวันที่"
            />
          </div>
        )}

        {extraToolbarSlot}

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="dd-btn"
          title="รีเฟรชข้อมูลล่าสุดจาก HOSxP"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>รีเฟรช</span>
        </button>

        <button
          type="button"
          onClick={onExport}
          disabled={loading || exportDisabled}
          className="dd-btn dd-btn-primary"
          title="ส่งออกรายงานเป็นไฟล์ Excel (.xlsx)"
        >
          <Download size={14} />
          <span>ส่งออก Excel</span>
        </button>
      </div>
    </header>
  )
}

/* -------------------------------------------------------------------------- */
/* 2. Page-level Error Banner                                                 */
/* -------------------------------------------------------------------------- */

export function RcmErrorBanner({
  error,
  onRetry,
}: {
  error: string | null
  onRetry?: () => void
}) {
  if (!error) return null
  return (
    <div className="dd-error-banner" role="alert">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <AlertCircle size={16} />
        <span>{error}</span>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className="dd-btn">
          ลองใหม่
        </button>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 3. Inline Sparkline (No axes, dot on latest point)                         */
/* -------------------------------------------------------------------------- */

function InlineSparkline({
  values,
  color,
}: {
  values: number[]
  color: string
}) {
  if (values.length < 2) return null
  const width = 72
  const height = 22
  const pad = 2
  const min = Math.min(...values, 0)
  const max = Math.max(...values)
  const span = max - min || 1

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2)
    const y = height - pad - ((v - min) / span) * (height - pad * 2)
    return { x, y }
  })

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const last = points[points.length - 1]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={2.3} fill={color} />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* 4. Hairline-Divided KPI Strip                                              */
/* -------------------------------------------------------------------------- */

export interface RcmKpiTile {
  id: string
  label: string
  value: string
  context: string
  tooltip: string
  icon: React.ReactNode
  tone: 'accent' | 'money' | 'warn' | 'neutral'
  selected?: boolean
  interactive?: boolean
  isAlert?: boolean
  compactValue?: boolean
  sparkValues?: number[]
  onClick?: () => void
}

/** Single hairline-divided KPI strip; selected tiles carry soft fill + inset ring. */
export function RcmKpiStrip({
  tiles,
  loading = false,
}: {
  tiles: RcmKpiTile[]
  loading?: boolean
}) {
  const cols = tiles.length === 4 ? '4' : '5'

  return (
    <section className="dd-kpi-card" aria-label="ตัวชี้วัดหลัก">
      <div className="dd-kpi-grid" data-cols={cols}>
        {tiles.map((tile) => {
          const selectedClass = tile.selected
            ? tile.tone === 'money'
              ? 'is-selected-money'
              : tile.tone === 'warn'
                ? 'is-selected-warn'
                : 'is-selected-accent'
            : ''
          const interactive = Boolean(tile.interactive && tile.onClick)
          const sparkColor = tile.selected
            ? tile.tone === 'money'
              ? 'var(--dd-money)'
              : tile.tone === 'warn'
                ? 'var(--dd-down)'
                : 'var(--dd-accent)'
            : 'var(--dd-muted)'

          const content = (
            <>
              <div className="dd-kpi-head">
                <span className="dd-kpi-label">{tile.label}</span>
                <span
                  className={`dd-kpi-icon ${tile.isAlert ? 'is-alert' : ''}`}
                  aria-hidden="true"
                >
                  {tile.icon}
                </span>
              </div>

              {loading ? (
                <div className="dd-skeleton" style={{ height: 30, width: '68%', margin: '4px 0' }} />
              ) : (
                <div
                  className={`dd-kpi-value ${tile.compactValue ? 'is-compact-text' : ''} ${
                    tile.isAlert ? 'is-alert' : ''
                  }`}
                >
                  {tile.value}
                </div>
              )}

              <div className="dd-kpi-footer">
                <span className={`dd-kpi-context ${tile.isAlert ? 'is-alert' : ''}`}>
                  {tile.context}
                </span>
                {tile.sparkValues && tile.sparkValues.length > 1 && (
                  <InlineSparkline values={tile.sparkValues} color={sparkColor} />
                )}
              </div>
            </>
          )

          return (
            <div key={tile.id} className="dd-kpi-cell">
              {interactive ? (
                <button
                  type="button"
                  aria-pressed={Boolean(tile.selected)}
                  onClick={tile.onClick}
                  title={tile.tooltip}
                  data-interactive="true"
                  className={`dd-kpi-btn ${selectedClass}`}
                >
                  {content}
                </button>
              ) : (
                <div
                  title={tile.tooltip}
                  data-interactive="false"
                  className={`dd-kpi-btn ${selectedClass}`}
                >
                  {content}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* 5. Monthly Bar Chart (Pastel fill + solid top cap, dashed partial period)  */
/* -------------------------------------------------------------------------- */

export interface MonthlyBarDatum {
  key: string
  label: string
  value: number
  secondaryLabel?: string
  isPartial?: boolean
}

interface TooltipState {
  x: number
  y: number
  title: string
  value: string
  sub?: string
}

export function RcmMonthlyBarChart({
  kicker,
  headline,
  data,
  hue,
  isCurrency = false,
  unit = '',
  chips,
  loading = false,
  emptyLabel = 'ไม่มีข้อมูลรายเดือนในช่วงเวลานี้',
}: {
  kicker: string
  headline: string
  data: MonthlyBarDatum[]
  hue: 'money' | 'accent'
  isCurrency?: boolean
  unit?: string
  chips?: Array<{ label: string; value: string }>
  loading?: boolean
  emptyLabel?: string
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null)

  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 0), [data])
  const ticks = useMemo(() => niceTicks(maxValue, 4), [maxValue])
  const yTop = ticks[ticks.length - 1] || 1

  const colorVar = hue === 'money' ? 'var(--dd-money)' : 'var(--dd-accent)'
  const chartAriaLabel = useMemo(() => {
    if (data.length === 0) return kicker
    const peak = data.reduce((best, cur) => (cur.value > best.value ? cur : best), data[0])
    return `${kicker} รวม ${headline} สูงสุดเดือน ${peak.label} (${peak.value.toLocaleString('th-TH')}${unit})`
  }, [data, kicker, headline, unit])

  const svgWidth = 640
  const svgHeight = 230
  const padLeft = 10
  const padRight = 48
  const padTop = 14
  const padBottom = 28
  const plotW = svgWidth - padLeft - padRight
  const plotH = svgHeight - padTop - padBottom

  const showTip = (e: React.SyntheticEvent<SVGGElement>, item: MonthlyBarDatum) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const formattedVal = isCurrency
      ? `฿${item.value.toLocaleString('th-TH')}`
      : `${item.value.toLocaleString('th-TH')}${unit ? ` ${unit}` : ''}`
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      title: item.label,
      value: formattedVal,
      sub: [item.secondaryLabel, item.isPartial ? 'เดือนปัจจุบัน (ยังไม่ปิดงวด)' : undefined]
        .filter(Boolean)
        .join(' · '),
    })
  }

  return (
    <section className="dd-panel" aria-label={kicker}>
      <div className="dd-panel-header">
        <div>
          <div className="dd-panel-kicker">{kicker}</div>
          <div className="dd-panel-headline">{headline}</div>
        </div>
        {chips && chips.length > 0 && (
          <div className="dd-summary-chips">
            {chips.map((c) => (
              <span key={c.label} className="dd-stat-pill">
                <span>{c.label}</span>
                <b>{c.value}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="dd-skeleton" style={{ height: 220, width: '100%' }} />
      ) : data.length === 0 || maxValue === 0 ? (
        <div className="dd-empty-box" style={{ minHeight: 200, justifyContent: 'center' }}>
          <p className="dd-empty-title">{emptyLabel}</p>
        </div>
      ) : (
        <div
          className="dd-chart-wrap"
          onMouseLeave={() => {
            setTooltip(null)
            setFocusedIdx(null)
          }}
        >
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            width="100%"
            height="230"
            role="img"
            aria-label={chartAriaLabel}
            style={{ overflow: 'visible' }}
          >
            {/* Horizontal gridlines + right-edge Y ticks */}
            {ticks.map((tick) => {
              const y = padTop + plotH - (tick / yTop) * plotH
              return (
                <g key={tick}>
                  <line
                    x1={padLeft}
                    x2={svgWidth - padRight}
                    y1={y}
                    y2={y}
                    stroke="var(--dd-line)"
                    strokeWidth={1}
                  />
                  <text
                    x={svgWidth - padRight + 8}
                    y={y + 4}
                    fontSize={11}
                    fill="var(--dd-muted)"
                    className="dd-tnum"
                  >
                    {formatCompactNumber(tick, isCurrency)}
                  </text>
                </g>
              )
            })}

            {/* Bars */}
            {data.map((d, idx) => {
              const slotW = plotW / data.length
              const barW = Math.min(34, Math.max(12, slotW * 0.58))
              const x = padLeft + idx * slotW + (slotW - barW) / 2
              const barH = d.value > 0 ? Math.max(4, (d.value / yTop) * plotH) : 0
              const y = padTop + plotH - barH
              const isFocused = focusedIdx === idx
              const capH = Math.min(5, barH)

              return (
                <g
                  key={d.key}
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.label}: ${d.value.toLocaleString('th-TH')}${unit}`}
                  onMouseEnter={(e) => {
                    setFocusedIdx(idx)
                    showTip(e, d)
                  }}
                  onFocus={(e) => {
                    setFocusedIdx(idx)
                    showTip(e, d)
                  }}
                  onBlur={() => {
                    setFocusedIdx(null)
                    setTooltip(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setTooltip(null)
                      setFocusedIdx(null)
                    }
                  }}
                  style={{ cursor: 'pointer', outline: 'none' }}
                >
                  {/* Full-height column hit area + subtle focus outline */}
                  <rect
                    x={padLeft + idx * slotW + 2}
                    y={padTop}
                    width={Math.max(4, slotW - 4)}
                    height={plotH}
                    rx={8}
                    fill={isFocused ? 'color-mix(in srgb, var(--dd-ink) 4%, transparent)' : 'transparent'}
                    stroke={isFocused ? 'var(--dd-line-strong)' : 'transparent'}
                    strokeWidth={1}
                  />

                  {barH > 0 && (
                    <>
                      <rect
                        x={x}
                        y={y}
                        width={barW}
                        height={barH}
                        rx={6}
                        fill={colorVar}
                        fillOpacity={d.isPartial ? 0.12 : 0.22}
                        stroke={d.isPartial ? colorVar : 'none'}
                        strokeWidth={d.isPartial ? 1.5 : 0}
                        strokeDasharray={d.isPartial ? '4 3' : undefined}
                      />
                      {!d.isPartial && (
                        <rect
                          x={x}
                          y={y}
                          width={barW}
                          height={capH}
                          rx={3}
                          fill={colorVar}
                        />
                      )}
                    </>
                  )}

                  {/* X-axis label */}
                  <text
                    x={x + barW / 2}
                    y={svgHeight - 8}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={d.isPartial ? 600 : 400}
                    fill={d.isPartial ? colorVar : 'var(--dd-muted)'}
                  >
                    {d.label}
                  </text>
                </g>
              )
            })}
          </svg>

          {tooltip && (
            <div
              className="dd-chart-tooltip"
              style={{
                left: Math.max(12, Math.min(typeof window !== 'undefined' ? window.innerWidth - 190 : 800, tooltip.x - 65)),
                top: Math.max(12, tooltip.y - 62),
              }}
              role="status"
            >
              <div className="dd-chart-tooltip-val">{tooltip.value}</div>
              <div className="dd-chart-tooltip-sub">
                {tooltip.title}
                {tooltip.sub ? ` · ${tooltip.sub}` : ''}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* 6. Horizontal Ranked Bar Chart (Categories / Departments)                  */
/* -------------------------------------------------------------------------- */

export interface HorizontalBarDatum {
  id: string
  label: string
  value: number
  secondaryText?: string
  sharePct: number
}

export function RcmHorizontalRankedChart({
  kicker,
  headline,
  data,
  hue = 'accent',
  unit = '',
  headerAction,
  loading = false,
  onSelectBar,
  selectedId,
}: {
  kicker: string
  headline: string
  data: HorizontalBarDatum[]
  hue?: 'accent' | 'money'
  unit?: string
  headerAction?: React.ReactNode
  loading?: boolean
  onSelectBar?: (id: string) => void
  selectedId?: string | null
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const maxVal = useMemo(() => Math.max(...data.map((d) => d.value), 0), [data])
  const ticks = useMemo(() => niceTicks(maxVal, 4), [maxVal])
  const xTop = ticks[ticks.length - 1] || 1
  const colorVar = hue === 'money' ? 'var(--dd-money)' : 'var(--dd-accent)'

  return (
    <section className="dd-panel" aria-label={kicker}>
      <div className="dd-panel-header">
        <div>
          <div className="dd-panel-kicker">{kicker}</div>
          <div className="dd-panel-headline">{headline}</div>
        </div>
        {headerAction}
      </div>

      {loading ? (
        <div className="dd-skeleton" style={{ height: 280, width: '100%' }} />
      ) : data.length === 0 || maxVal === 0 ? (
        <div className="dd-empty-box" style={{ minHeight: 220, justifyContent: 'center' }}>
          <p className="dd-empty-title">ไม่มีข้อมูลสำหรับแสดงกราฟ</p>
        </div>
      ) : (
        <div
          className="dd-chart-wrap"
          onMouseLeave={() => setTooltip(null)}
          style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}
        >
          {data.map((item) => {
            const pctWidth = Math.max(2, (item.value / xTop) * 100)
            const isSelected = selectedId === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectBar?.(item.id)}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setTooltip({
                    x: rect.left + rect.width * 0.45,
                    y: rect.top,
                    title: item.label,
                    value: `${item.value.toLocaleString('th-TH')}${unit ? ` ${unit}` : ''}`,
                    sub: `${item.secondaryText ? `${item.secondaryText} · ` : ''}${formatSharePct(item.sharePct)}`,
                  })
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(110px, 165px) minmax(0, 1fr) 82px',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.35rem 0.5rem',
                  borderRadius: 9,
                  border: isSelected ? `1px solid ${colorVar}` : '1px solid transparent',
                  background: isSelected ? `color-mix(in srgb, ${colorVar} 7%, transparent)` : 'transparent',
                  cursor: onSelectBar ? 'pointer' : 'default',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span
                  title={item.label}
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--dd-ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </span>

                <span
                  style={{
                    position: 'relative',
                    height: 16,
                    borderRadius: 5,
                    background: 'var(--dd-soft)',
                    overflow: 'hidden',
                    display: 'block',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      inset: '0 auto 0 0',
                      width: `${Math.min(100, pctWidth)}%`,
                      borderRadius: 5,
                      background: `color-mix(in srgb, ${colorVar} 22%, transparent)`,
                      borderRight: `4px solid ${colorVar}`,
                    }}
                  />
                </span>

                <span
                  className="dd-tnum"
                  style={{
                    textAlign: 'right',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--dd-ink)',
                  }}
                >
                  {formatCompactNumber(item.value)}
                  <span style={{ color: 'var(--dd-muted)', fontWeight: 400, marginLeft: 4 }}>
                    {formatSharePct(item.sharePct)}
                  </span>
                </span>
              </button>
            )
          })}

          {/* X-axis round ticks reference */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(110px, 165px) minmax(0, 1fr) 82px',
              gap: '0.65rem',
              padding: '0.2rem 0.5rem 0',
            }}
          >
            <span />
            <div
              className="dd-tnum"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'var(--dd-muted)',
              }}
            >
              {ticks.map((t) => (
                <span key={t}>{formatCompactNumber(t)}</span>
              ))}
            </div>
            <span />
          </div>

          {tooltip && (
            <div
              className="dd-chart-tooltip"
              style={{
                left: Math.max(12, Math.min(typeof window !== 'undefined' ? window.innerWidth - 210 : 800, tooltip.x)),
                top: Math.max(12, tooltip.y - 58),
              }}
              role="status"
            >
              <div className="dd-chart-tooltip-val">{tooltip.value}</div>
              <div className="dd-chart-tooltip-sub">
                {tooltip.title}
                {tooltip.sub ? ` · ${tooltip.sub}` : ''}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* 7. Ranked Breakdown List (3px slim share bar + attention flag)             */
/* -------------------------------------------------------------------------- */

export interface RankedListItem {
  id: string
  name: string
  value: number
  valueLabel: string
  sharePct: number
  alertChip?: string
  tooltip?: string
}

export function RcmRankedListCard({
  title,
  metricLabel,
  items,
  hue = 'money',
  selectedId,
  onSelect,
  headerAction,
  emptyLabel = 'ไม่พบรายการ',
  initialLimit = 7,
}: {
  title: string
  metricLabel: string
  items: RankedListItem[]
  hue?: 'money' | 'accent'
  selectedId?: string | null
  onSelect?: (id: string) => void
  headerAction?: React.ReactNode
  emptyLabel?: string
  initialLimit?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, initialLimit)
  const maxVal = Math.max(...items.map((i) => i.value), 1)
  const barColor = hue === 'money' ? 'var(--dd-money)' : 'var(--dd-accent)'

  return (
    <section className="dd-panel" aria-label={title}>
      <div className="dd-panel-header">
        <div>
          <h2 className="dd-panel-title">{title}</h2>
          <div className="dd-panel-kicker">{metricLabel}</div>
        </div>
        {headerAction}
      </div>

      {items.length === 0 ? (
        <div className="dd-empty-box" style={{ minHeight: 160, justifyContent: 'center' }}>
          <p className="dd-empty-title">{emptyLabel}</p>
        </div>
      ) : (
        <>
          <div className="dd-rank-list">
            {visible.map((item, idx) => {
              const barWidth = Math.max(2, (item.value / maxVal) * 100)
              const isSelected = selectedId === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.tooltip || item.name}
                  onClick={() => onSelect?.(item.id)}
                  className={`dd-rank-row ${isSelected ? 'is-active' : ''}`}
                >
                  <span className="dd-rank-idx">{idx + 1}</span>
                  <span className="dd-rank-name">{item.name}</span>
                  {item.alertChip && <span className="dd-warn-chip">{item.alertChip}</span>}
                  <span className="dd-rank-val">{item.valueLabel}</span>
                  <span className="dd-rank-share">{formatSharePct(item.sharePct)}</span>

                  <span className="dd-share-track" aria-hidden="true">
                    <span
                      className="dd-share-fill"
                      style={{
                        width: `${Math.min(100, barWidth)}%`,
                        backgroundColor: item.alertChip ? 'var(--dd-down)' : barColor,
                      }}
                    />
                  </span>
                </button>
              )
            })}
          </div>

          {items.length > initialLimit && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="dd-btn"
              style={{ alignSelf: 'flex-start', height: 30, fontSize: 12 }}
            >
              {expanded ? (
                <>
                  <ChevronUp size={13} />
                  <span>ย่อรายการ</span>
                </>
              ) : (
                <>
                  <ChevronDown size={13} />
                  <span>ดูทั้งหมด ({items.length})</span>
                </>
              )}
            </button>
          )}
        </>
      )}
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* 8. Few's Bullet Graph List (Value vs Benchmark / Hospital Average)         */
/* -------------------------------------------------------------------------- */

export interface BulletListItem {
  id: string
  name: string
  value: number
  valueLabel: string
  isHighAttention: boolean
  tooltip: string
}

export function RcmBulletListCard({
  title,
  kicker,
  target,
  targetLabel,
  items,
  selectedId,
  onSelect,
}: {
  title: string
  kicker: string
  target: number
  targetLabel: string
  items: BulletListItem[]
  selectedId?: string | null
  onSelect?: (id: string) => void
}) {
  const maxVal = Math.max(target * 1.5, ...items.map((i) => i.value), 1)
  const pct = (v: number) => `${Math.min(100, Math.max(0, (v / maxVal) * 100))}%`

  return (
    <section className="dd-panel" aria-label={title}>
      <div className="dd-panel-header">
        <div>
          <h2 className="dd-panel-title">{title}</h2>
          <div className="dd-panel-kicker">{kicker}</div>
        </div>
        <span className="dd-stat-pill">
          <span>เกณฑ์เฉลี่ย</span>
          <b>{targetLabel}</b>
        </span>
      </div>

      {items.length === 0 ? (
        <div className="dd-empty-box" style={{ minHeight: 160, justifyContent: 'center' }}>
          <p className="dd-empty-title">ไม่มีข้อมูลเปรียบเทียบ</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.tooltip}
              onClick={() => onSelect?.(item.id)}
              className={`dd-bullet-row ${selectedId === item.id ? 'is-active' : ''}`}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--dd-ink)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.name}
              </span>

              <div
                className="dd-bullet-track"
                role="img"
                aria-label={`${item.name}: ${item.valueLabel} (ค่าเฉลี่ย ${targetLabel})`}
              >
                {/* Qualitative range bands (lightest = normal, darker = elevated) */}
                <span
                  className="dd-bullet-band"
                  style={{ width: pct(target), background: 'color-mix(in srgb, var(--dd-ink) 6%, transparent)' }}
                />
                <span
                  className="dd-bullet-band"
                  style={{ width: pct(target * 1.25), background: 'color-mix(in srgb, var(--dd-ink) 4%, transparent)' }}
                />
                <span
                  className="dd-bullet-measure"
                  style={{
                    width: pct(item.value),
                    background: item.isHighAttention ? 'var(--dd-warn)' : 'var(--dd-ink-2)',
                  }}
                />
                <span className="dd-bullet-target" style={{ left: pct(target) }} />
              </div>

              <span
                className="dd-tnum"
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: item.isHighAttention ? 'var(--dd-warn)' : 'var(--dd-ink)',
                  minWidth: 48,
                  textAlign: 'right',
                }}
              >
                {item.valueLabel}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
