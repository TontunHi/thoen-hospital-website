'use client'

import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { DmRemissionDashboardStats } from '@/lib/clinical/dmRemissionTypes'

interface DmRemissionDashboardProps {
  stats: DmRemissionDashboardStats
  fiscalYear: number
  statusFilter?: string
  onSelectStatus?: (status: string) => void
}

const STATUS_TONE_CLASSES: Record<string, string> = {
  Remission: 'dmrToneRemission',
  'ไม่ Remission': 'dmrToneNotRemission',
  'รอ lab A1c': 'dmrToneWaiting',
  'ยังไม่ระบุ': 'dmrToneUnknown',
}

function getStatusToneClass(label: string): string {
  return STATUS_TONE_CLASSES[label] || 'dmrToneOther'
}

const CHART_TICK_SECONDARY = { fontSize: 12, fill: 'var(--ds-color-text-secondary)' } /* od-ignore */
const CHART_TICK_PRIMARY = { fontSize: 12, fill: 'var(--ds-color-text-primary)' } /* od-ignore */
const CHART_MARGIN = { top: 4, right: 20, left: 12, bottom: 4 } /* od-ignore */
const CHART_AXIS_LINE = { stroke: 'var(--ds-color-border-separator)' }
const CHART_TOOLTIP_CONTENT_STYLE = {
  backgroundColor: 'var(--ds-color-bg-inverse)',
  border: 'none',
  borderRadius: 'var(--ds-radius-control)',
  color: 'var(--ds-color-text-inverse)',
  fontSize: 'var(--ds-font-size-12)',
}
const CHART_TOOLTIP_ITEM_STYLE = { color: 'var(--ds-color-text-inverse)' }
const CHART_TOOLTIP_LABEL_STYLE = {
  color: 'var(--ds-color-text-inverse)',
  fontWeight: 600,
  marginBottom: '0.25rem',
}

function formatNum(val: number | null | undefined, digits = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '-'
  return val.toFixed(digits)
}

function formatDelta(val: number | null | undefined, unit = ''): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '-'
  const prefix = val > 0 ? '+' : ''
  return `${prefix}${val.toFixed(2)}${unit ? ` ${unit}` : ''}`
}

const BREAKDOWN_SECTIONS: Array<{
  key: keyof DmRemissionDashboardStats['breakdowns']
  title: string
}> = [
  { key: 'summaryA1c', title: 'สรุป A1c' },
  { key: 'summaryMeds', title: 'สรุป ยาเบาหวาน' },
  { key: 'summaryWeight', title: 'สรุป น้ำหนัก' },
  { key: 'summaryWaist', title: 'สรุป รอบเอว' },
  { key: 'summaryDiet', title: 'สรุป การปรับอาหาร' },
  { key: 'summaryExercise', title: 'สรุป การออกกำลังกาย' },
  { key: 'summaryIf', title: 'สรุป IF' },
]

export default function DmRemissionDashboard({
  stats,
  fiscalYear,
  statusFilter = '',
  onSelectStatus,
}: DmRemissionDashboardProps) {
  const waitingCount = stats.statusCounts['รอ lab A1c'] || 0
  const notRemissionCount = stats.statusCounts['ไม่ Remission'] || 0
  const total = Math.max(0, stats.totalPatients)

  const statusOrder = ['Remission', 'รอ lab A1c', 'ไม่ Remission', 'ยังไม่ระบุ']
  const extraStatuses = Object.keys(stats.statusCounts).filter(
    (k) => !statusOrder.includes(k) && (stats.statusCounts[k] || 0) > 0
  )
  const orderedStatusEntries = [...statusOrder, ...extraStatuses]
    .map((label) => ({
      label,
      count: stats.statusCounts[label] || 0,
    }))
    .filter((entry) => entry.count > 0 || statusOrder.slice(0, 3).includes(entry.label))

  const pcuBarData = stats.byPcu.map((row) => ({
    pcuName: row.pcuName,
    Remission: row.remissionCount,
    อื่นหรือรอผล: Math.max(0, row.total - row.remissionCount),
    total: row.total,
    remissionRate: row.remissionRate,
  }))

  const barChartHeight = Math.max(260, pcuBarData.length * 28 + 36)

  return (
    <section
      className="dmrDashboardSection"
      aria-label={`ภาพรวม DM Remission ปีงบประมาณ ${fiscalYear}`}
    >
      <div className="dmrKpiGrid">
        <div className="dmrKpiCard dmrKpiCardAccent">
          <span className="dmrKpiLabel">เข้าสู่ระยะสงบ (Remission)</span>
          <div className="dmrKpiValueRow">
            <span className="dmrKpiValue">{stats.remissionCount.toLocaleString()} ราย</span>
            <span className="dmrKpiHighlight">{stats.remissionRate.toFixed(1)}%</span>
          </div>
          <span className="dmrKpiSub">
            ไม่ Remission {notRemissionCount.toLocaleString()} ราย · รอ lab {waitingCount.toLocaleString()} ราย
          </span>
        </div>

        <div className="dmrKpiCard">
          <span className="dmrKpiLabel">ผู้ป่วยในโครงการ</span>
          <div className="dmrKpiValueRow">
            <span className="dmrKpiValue">{stats.totalPatients.toLocaleString()} ราย</span>
          </div>
          <span className="dmrKpiSub">
            ปีงบประมาณ {fiscalYear} · {stats.byPcu.length} หน่วยบริการ
          </span>
        </div>

        <div className="dmrKpiCard">
          <span className="dmrKpiLabel">ค่าเฉลี่ย A1c (ก่อน → หลัง)</span>
          <div className="dmrKpiValueRow">
            <span className="dmrKpiValue dmrKpiValueMd">
              {formatNum(stats.averages.a1cBefore)} → {formatNum(stats.averages.a1cAfter)}%
            </span>
          </div>
          <span className="dmrKpiSub">
            เปลี่ยนแปลงเฉลี่ย {formatDelta(stats.averages.a1cDelta, '%')} · หลังหยุดยา 3 เดือน{' '}
            {formatNum(stats.averages.a1cPostStop3m)}
          </span>
        </div>

        <div className="dmrKpiCard">
          <span className="dmrKpiLabel">น้ำหนัก และ BMI เฉลี่ยหลังปรับพฤติกรรม</span>
          <div className="dmrKpiValueRow">
            <span className="dmrKpiValue dmrKpiValueMd">
              {formatNum(stats.averages.weightAfterKg, 1)} kg · BMI {formatNum(stats.averages.bmiAfter)}
            </span>
          </div>
          <span className="dmrKpiSub">
            น้ำหนักเฉลี่ย {formatDelta(stats.averages.weightDelta, 'kg')} · รอบเอว{' '}
            {formatNum(stats.averages.waistBeforeCm, 1)} → {formatNum(stats.averages.waistAfterCm, 1)} cm
          </span>
        </div>
      </div>

      <div className="dmrChartsGrid">
        <div className="dmrCard dmrSpan8">
          <div className="dmrCardHeader">
            <div>
              <h2 className="dmrCardTitle">ผล Remission แยกรายหน่วยบริการ (รพ.สต.)</h2>
              <span className="dmrCardMeta">
                แสดงครบทุกหน่วยบริการในปีงบ {fiscalYear} ({stats.byPcu.length} แห่ง)
              </span>
            </div>
            <div className="dmrChartLegend">
              <span className="dmrLegendItem">
                <span className="dmrLegendSwatch dmrLegendSwatchAccent" />
                Remission
              </span>
              <span className="dmrLegendItem">
                <span className="dmrLegendSwatch dmrLegendSwatchNeutral" />
                อยู่ระหว่างติดตาม / ไม่ Remission
              </span>
            </div>
          </div>

          {pcuBarData.length === 0 ? (
            <div className="dmrEmpty">ยังไม่มีข้อมูลสำหรับแสดงกราฟในปีงบประมาณนี้</div>
          ) : (
            <div className="dmrChartScroll">
              <div style={{ width: '100%', height: barChartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pcuBarData}
                    layout="vertical"
                    margin={CHART_MARGIN}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--ds-color-border-separator)" horizontal={false} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={CHART_TICK_SECONDARY}
                      axisLine={CHART_AXIS_LINE}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="pcuName"
                      width={116}
                      interval={0}
                      tick={CHART_TICK_PRIMARY}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                      itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    />
                    <Bar
                      dataKey="Remission"
                      stackId="a"
                      fill="var(--ds-color-bg-action-primary)"
                      barSize={16}
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="อื่นหรือรอผล"
                      name="อื่น / รอผล"
                      stackId="a"
                      fill="var(--ds-color-border-subtle)"
                      barSize={16}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        <div className="dmrCard dmrSpan4">
          <div className="dmrCardHeader">
            <div>
              <h2 className="dmrCardTitle">สัดส่วนสถานะ Remission</h2>
              <span className="dmrCardMeta">คลิกสถานะเพื่อกรองรายชื่อในตาราง</span>
            </div>
          </div>

          {total === 0 ? (
            <div className="dmrEmpty">ยังไม่มีข้อมูลสถานะ Remission</div>
          ) : (
            <>
              <div className="dmrShareBar" aria-hidden="true">
                {orderedStatusEntries
                  .filter((e) => e.count > 0)
                  .map((entry) => (
                    <div
                      key={entry.label}
                      className={getStatusToneClass(entry.label)}
                      style={{
                        width: `${(entry.count / total) * 100}%`,
                      }}
                    />
                  ))}
              </div>

              <div className="dmrStatusList">
                {orderedStatusEntries.map((entry) => {
                  const pct = total > 0 ? (entry.count / total) * 100 : 0
                  const isActive = statusFilter === entry.label
                  const toneClass = getStatusToneClass(entry.label)
                  return (
                    <button
                      key={entry.label}
                      type="button"
                      className={`dmrStatusBtn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        if (!onSelectStatus) return
                        onSelectStatus(isActive ? '' : entry.label)
                      }}
                    >
                      <div className="dmrStatusBtnTop">
                        <span className="dmrStatusLabelWrap">
                          <span className={`dmrStatusDot ${toneClass}`} />
                          <span>{entry.label}</span>
                        </span>
                        <span className="dmrStatusNums">
                          <strong>{entry.count.toLocaleString()}</strong> ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="dmrTrack">
                        <div
                          className={`dmrTrackFill ${toneClass}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="dmrCard dmrSpan12">
          <div className="dmrCardHeader">
            <h2 className="dmrCardTitle">สรุปผลลัพธ์ทางคลินิกและพฤติกรรม</h2>
            <span className="dmrCardMeta">จำแนกตาม 7 ตัวชี้วัดติดตามผล</span>
          </div>
          <div className="dmrBreakdownGrid">
            {BREAKDOWN_SECTIONS.map(({ key, title }) => {
              const entries = Object.entries(stats.breakdowns[key] || {}).sort(
                (a, b) => b[1] - a[1]
              )
              const sectionTotal = entries.reduce((sum, [, c]) => sum + c, 0)
              return (
                <div key={key} className="dmrBreakdownBox">
                  <h3 className="dmrBreakdownTitle">{title}</h3>
                  {entries.length === 0 ? (
                    <span className="dmrCardMeta">ยังไม่มีข้อมูล</span>
                  ) : (
                    <div className="dmrBreakdownList">
                      {entries.map(([label, count]) => {
                        const pct = sectionTotal > 0 ? (count / sectionTotal) * 100 : 0
                        return (
                          <div key={label} className="dmrBreakdownItem">
                            <div className="dmrBreakdownRow">
                              <span>{label}</span>
                              <span className="dmrBreakdownCount">
                                {count.toLocaleString()} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                            <div className="dmrMiniTrack">
                              <div className="dmrMiniFill" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
