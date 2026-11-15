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
import type { FctHomeVisitDashboardStats } from '@/lib/clinical/fctHomeVisitTypes'

interface FctHomeVisitDashboardProps {
  stats: FctHomeVisitDashboardStats
  fiscalYear: number
  adlGroupFilter?: string
  outcomeFilter?: string
  onSelectAdlGroup?: (adlGroup: string) => void
  onSelectOutcome?: (outcome: string) => void
}

const ADL_TONE_CLASSES: Record<string, string> = {
  ติดเตียง: 'fctToneBedbound',
  ติดบ้าน: 'fctToneHomebound',
  ติดสังคม: 'fctToneSocial',
  ยังไม่ระบุ: 'fctToneUnknown',
}

const OUTCOME_TONE_CLASSES: Record<string, string> = {
  ดีขึ้น: 'fctToneImproved',
  คงเดิม: 'fctToneStable',
  แย่ลง: 'fctToneWorse',
  เสียชีวิต: 'fctToneDeceased',
  ยังไม่ระบุ: 'fctToneUnknown',
}

function getAdlToneClass(label: string): string {
  return ADL_TONE_CLASSES[label] || 'fctToneUnknown'
}

function getOutcomeToneClass(label: string): string {
  return OUTCOME_TONE_CLASSES[label] || 'fctToneUnknown'
}

const CHART_TICK_SECONDARY = { fontSize: 12, fill: 'var(--ds-color-text-secondary)' }
const CHART_TICK_PRIMARY = { fontSize: 12, fill: 'var(--ds-color-text-primary)' }
const CHART_MARGIN_HORIZONTAL = { top: 4, right: 20, left: 12, bottom: 4 }
const CHART_MARGIN_VERTICAL = { top: 8, right: 16, left: 0, bottom: 4 }
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

function buildOrderedEntries(
  counts: Record<string, number>,
  preferredOrder: readonly string[]
): Array<{ label: string; count: number }> {
  const extras = Object.keys(counts).filter(
    (k) => !preferredOrder.includes(k) && (counts[k] || 0) > 0
  )
  return [...preferredOrder, ...extras]
    .map((label) => ({
      label,
      count: counts[label] || 0,
    }))
    .filter((entry) => entry.count > 0 || preferredOrder.slice(0, 3).includes(entry.label))
}

export default function FctHomeVisitDashboard({
  stats,
  fiscalYear,
  adlGroupFilter = '',
  outcomeFilter = '',
  onSelectAdlGroup,
  onSelectOutcome,
}: FctHomeVisitDashboardProps) {
  const total = Math.max(0, stats.totalVisits)

  const bedboundCount = stats.adlGroupCounts['ติดเตียง'] || 0
  const homeboundCount = stats.adlGroupCounts['ติดบ้าน'] || 0
  const socialCount = stats.adlGroupCounts['ติดสังคม'] || 0

  const improvedCount = stats.outcomeCounts['ดีขึ้น'] || 0
  const stableCount = stats.outcomeCounts['คงเดิม'] || 0
  const worseCount = stats.outcomeCounts['แย่ลง'] || 0
  const deceasedCount = stats.outcomeCounts['เสียชีวิต'] || 0
  const improvedRate = total > 0 ? (improvedCount / total) * 100 : 0

  const adlEntries = buildOrderedEntries(stats.adlGroupCounts, [
    'ติดเตียง',
    'ติดบ้าน',
    'ติดสังคม',
    'ยังไม่ระบุ',
  ])
  const outcomeEntries = buildOrderedEntries(stats.outcomeCounts, [
    'ดีขึ้น',
    'คงเดิม',
    'แย่ลง',
    'เสียชีวิต',
    'ยังไม่ระบุ',
  ])

  const pcuBarData = stats.byPcu.map((row) => ({
    pcuName: row.pcuName,
    ติดเตียง: row.adlGroupCounts['ติดเตียง'] || 0,
    ติดบ้าน: row.adlGroupCounts['ติดบ้าน'] || 0,
    ติดสังคม: row.adlGroupCounts['ติดสังคม'] || 0,
    อื่นหรือไม่ระบุ: Math.max(
      0,
      row.totalVisits -
        (row.adlGroupCounts['ติดเตียง'] || 0) -
        (row.adlGroupCounts['ติดบ้าน'] || 0) -
        (row.adlGroupCounts['ติดสังคม'] || 0)
    ),
    totalVisits: row.totalVisits,
  }))

  const pcuChartHeight = Math.max(240, pcuBarData.length * 28 + 36)
  const maxCategoryCount = Math.max(
    1,
    ...stats.patientCategoryBreakdown.map((item) => item.count)
  )

  return (
    <section
      className="fctDashboardSection"
      aria-label={`ภาพรวมการเยี่ยมบ้านทีม FCT ปีงบประมาณ ${fiscalYear}`}
    >
      <div className="fctKpiGrid">
        <div className="fctKpiCard fctKpiCardAccent">
          <span className="fctKpiLabel">จำนวนการเยี่ยมบ้าน (Visits)</span>
          <div className="fctKpiValueRow">
            <span className="fctKpiValue">{stats.totalVisits.toLocaleString()} ครั้ง</span>
            <span className="fctKpiHighlight">
              {stats.uniquePatients.toLocaleString()} ราย
            </span>
          </div>
          <span className="fctKpiSub">
            ผู้ป่วยไม่ซ้ำราย {stats.uniquePatients.toLocaleString()} ราย · {stats.byPcu.length} รพ.สต.
            {stats.unidentifiedHnVisits > 0 && (
              <>
                {' · '}
                <span className="fctKpiNoteWarn">
                  ไม่ระบุ HN {stats.unidentifiedHnVisits.toLocaleString()} ครั้ง
                </span>
              </>
            )}
          </span>
        </div>

        <div className="fctKpiCard">
          <span className="fctKpiLabel">สัดส่วนกลุ่ม ADL</span>
          <div className="fctKpiValueRow">
            <span className="fctKpiValue fctKpiValueMd">
              ติดเตียง {bedboundCount.toLocaleString()} · ติดบ้าน {homeboundCount.toLocaleString()}
            </span>
          </div>
          <span className="fctKpiSub">
            ติดสังคม {socialCount.toLocaleString()} ครั้ง
            {total > 0
              ? ` · ติดเตียง ${((bedboundCount / total) * 100).toFixed(1)}%`
              : ''}
          </span>
        </div>

        <div className="fctKpiCard">
          <span className="fctKpiLabel">ผลลัพธ์การเยี่ยมบ้าน</span>
          <div className="fctKpiValueRow">
            <span className="fctKpiValue fctKpiValueMd">
              ดีขึ้น {improvedCount.toLocaleString()} ครั้ง
            </span>
            <span className="fctKpiHighlight">{improvedRate.toFixed(1)}%</span>
          </div>
          <span className="fctKpiSub">
            คงเดิม {stableCount.toLocaleString()} · แย่ลง {worseCount.toLocaleString()} · เสียชีวิต{' '}
            {deceasedCount.toLocaleString()}
          </span>
        </div>

        <div className={`fctKpiCard ${stats.highRiskOrSevereCount > 0 ? 'fctKpiCardDanger' : ''}`}>
          <span className="fctKpiLabel">เคสเฝ้าระวังสูง</span>
          <div className="fctKpiValueRow">
            <span className="fctKpiValue">{stats.highRiskOrSevereCount.toLocaleString()} ครั้ง</span>
            {stats.highRiskOrSevereCount > 0 && (
              <span className="fctKpiHighlight fctKpiHighlightDanger">ต้องติดตามใกล้ชิด</span>
            )}
          </div>
          <span className="fctKpiSub">
            ความเสี่ยงระดับ High หรือภาวะขาดสารอาหารรุนแรง
          </span>
        </div>
      </div>

      <div className="fctChartsGrid">
        <div className="fctCard fctSpan8">
          <div className="fctCardHeader">
            <div>
              <h2 className="fctCardTitle">จำนวนการเยี่ยมบ้านแยกตาม รพ.สต. และกลุ่ม ADL</h2>
              <span className="fctCardMeta">
                ปีงบประมาณ {fiscalYear} ({stats.byPcu.length} หน่วยบริการ)
              </span>
            </div>
            <div className="fctChartLegend">
              <span className="fctLegendItem">
                <span className="fctLegendSwatch fctLegendSwatchBedbound" />
                ติดเตียง
              </span>
              <span className="fctLegendItem">
                <span className="fctLegendSwatch fctLegendSwatchHomebound" />
                ติดบ้าน
              </span>
              <span className="fctLegendItem">
                <span className="fctLegendSwatch fctLegendSwatchSocial" />
                ติดสังคม
              </span>
            </div>
          </div>

          {pcuBarData.length === 0 ? (
            <div className="fctEmpty">ยังไม่มีข้อมูลสำหรับแสดงกราฟในปีงบประมาณนี้</div>
          ) : (
            <div className="fctChartScroll">
              <div style={{ width: '100%', height: pcuChartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pcuBarData}
                    layout="vertical"
                    margin={CHART_MARGIN_HORIZONTAL}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--ds-color-border-separator)"
                      horizontal={false}
                    />
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
                      dataKey="ติดเตียง"
                      stackId="adl"
                      fill="var(--ds-color-danger-light-9)"
                      barSize={16}
                    />
                    <Bar
                      dataKey="ติดบ้าน"
                      stackId="adl"
                      fill="var(--ds-color-warning-light-9)"
                      barSize={16}
                    />
                    <Bar
                      dataKey="ติดสังคม"
                      stackId="adl"
                      fill="var(--ds-color-bg-action-primary)"
                      barSize={16}
                    />
                    <Bar
                      dataKey="อื่นหรือไม่ระบุ"
                      name="ยังไม่ระบุ"
                      stackId="adl"
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

        <div className="fctCard fctSpan4">
          <div className="fctCardHeader">
            <div>
              <h2 className="fctCardTitle">สัดส่วนกลุ่ม ADL</h2>
              <span className="fctCardMeta">คลิกกลุ่มเพื่อกรองตาราง</span>
            </div>
          </div>

          {total === 0 ? (
            <div className="fctEmpty">ยังไม่มีข้อมูลกลุ่ม ADL</div>
          ) : (
            <>
              <div className="fctShareBar" aria-hidden="true">
                {adlEntries
                  .filter((e) => e.count > 0)
                  .map((entry) => (
                    <div
                      key={entry.label}
                      className={getAdlToneClass(entry.label)}
                      style={{ width: `${(entry.count / total) * 100}%` }}
                    />
                  ))}
              </div>

              <div className="fctStatusList">
                {adlEntries.map((entry) => {
                  const pct = total > 0 ? (entry.count / total) * 100 : 0
                  const isActive = adlGroupFilter === entry.label
                  const toneClass = getAdlToneClass(entry.label)
                  return (
                    <button
                      key={entry.label}
                      type="button"
                      className={`fctStatusBtn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        if (!onSelectAdlGroup) return
                        onSelectAdlGroup(isActive ? '' : entry.label)
                      }}
                    >
                      <div className="fctStatusBtnTop">
                        <span className="fctStatusLabelWrap">
                          <span className={`fctStatusDot ${toneClass}`} />
                          <span>{entry.label}</span>
                        </span>
                        <span className="fctStatusNums">
                          <strong>{entry.count.toLocaleString()}</strong> ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="fctTrack">
                        <div
                          className={`fctTrackFill ${toneClass}`}
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

        <div className="fctCard fctSpan8">
          <div className="fctCardHeader">
            <div>
              <h2 className="fctCardTitle">แนวโน้มการเยี่ยมบ้านรายเดือน (ปีงบประมาณ {fiscalYear})</h2>
              <span className="fctCardMeta">ตุลาคม – กันยายน (12 เดือน)</span>
            </div>
          </div>

          {stats.monthlyTrend.length === 0 ? (
            <div className="fctEmpty">ยังไม่มีข้อมูลรายเดือน</div>
          ) : (
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthlyTrend} margin={CHART_MARGIN_VERTICAL}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--ds-color-border-separator)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="monthLabel"
                    tick={CHART_TICK_SECONDARY}
                    axisLine={CHART_AXIS_LINE}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={CHART_TICK_SECONDARY}
                    axisLine={CHART_AXIS_LINE}
                    tickLine={false}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  />
                  <Bar
                    dataKey="count"
                    name="จำนวนการเยี่ยม (ครั้ง)"
                    fill="var(--ds-color-bg-action-primary)"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="fctCard fctSpan4">
          <div className="fctCardHeader">
            <div>
              <h2 className="fctCardTitle">ผลลัพธ์การเยี่ยมบ้าน</h2>
              <span className="fctCardMeta">คลิกผลลัพธ์เพื่อกรองตาราง</span>
            </div>
          </div>

          {total === 0 ? (
            <div className="fctEmpty">ยังไม่มีข้อมูลผลลัพธ์</div>
          ) : (
            <>
              <div className="fctShareBar" aria-hidden="true">
                {outcomeEntries
                  .filter((e) => e.count > 0)
                  .map((entry) => (
                    <div
                      key={entry.label}
                      className={getOutcomeToneClass(entry.label)}
                      style={{ width: `${(entry.count / total) * 100}%` }}
                    />
                  ))}
              </div>

              <div className="fctStatusList">
                {outcomeEntries.map((entry) => {
                  const pct = total > 0 ? (entry.count / total) * 100 : 0
                  const isActive = outcomeFilter === entry.label
                  const toneClass = getOutcomeToneClass(entry.label)
                  return (
                    <button
                      key={entry.label}
                      type="button"
                      className={`fctStatusBtn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        if (!onSelectOutcome) return
                        onSelectOutcome(isActive ? '' : entry.label)
                      }}
                    >
                      <div className="fctStatusBtnTop">
                        <span className="fctStatusLabelWrap">
                          <span className={`fctStatusDot ${toneClass}`} />
                          <span>{entry.label}</span>
                        </span>
                        <span className="fctStatusNums">
                          <strong>{entry.count.toLocaleString()}</strong> ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="fctTrack">
                        <div
                          className={`fctTrackFill ${toneClass}`}
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

        <div className="fctCard fctSpan6">
          <div className="fctCardHeader">
            <h2 className="fctCardTitle">ประเภทคนไข้เยี่ยมบ้าน</h2>
            <span className="fctCardMeta">
              {stats.patientCategoryBreakdown.length} กลุ่มโรค/โครงการ
            </span>
          </div>

          {stats.patientCategoryBreakdown.length === 0 ? (
            <div className="fctEmpty fctEmptyCompact">ยังไม่มีข้อมูลประเภทคนไข้</div>
          ) : (
            <div className="fctBreakdownList">
              {stats.patientCategoryBreakdown.map((item) => {
                const pctOfMax = (item.count / maxCategoryCount) * 100
                const pctOfTotal = total > 0 ? (item.count / total) * 100 : 0
                return (
                  <div key={item.label} className="fctBreakdownItem">
                    <div className="fctBreakdownRow">
                      <span className="fctBreakdownLabelStrong">{item.label}</span>
                      <span className="fctBreakdownCount">
                        {item.count.toLocaleString()} ({pctOfTotal.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="fctMiniTrack">
                      <div className="fctMiniFillMuted" style={{ width: `${pctOfMax}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="fctCard fctSpan6">
          <div className="fctCardHeader">
            <h2 className="fctCardTitle">การมีส่วนร่วมทีมสหวิชาชีพ 5 ด้าน</h2>
            <span className="fctCardMeta">อัตราการบันทึกข้อมูลต่อรอบการเยี่ยม</span>
          </div>

          {stats.disciplineEngagement.length === 0 ? (
            <div className="fctEmpty fctEmptyCompact">ยังไม่มีข้อมูลการมีส่วนร่วม</div>
          ) : (
            <div className="fctBreakdownList">
              {stats.disciplineEngagement.map((item) => (
                <div key={item.key} className="fctBreakdownItem">
                  <div className="fctBreakdownRow">
                    <span className="fctBreakdownLabelStrong">{item.label}</span>
                    <span className="fctBreakdownCount">
                      {item.filledCount.toLocaleString()} / {stats.totalVisits.toLocaleString()} ครั้ง ({item.rate.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="fctMiniTrack">
                    <div
                      className="fctMiniFill"
                      style={{ width: `${Math.min(100, Math.max(0, item.rate))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
