'use client'

import React, { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { sortByPreferredOrder } from '@/lib/projects/projectTrackerDomain'
import {
  PROJECT_SUBMISSION_STATUSES,
  type ProjectDashboardStats,
} from '@/lib/projects/projectTrackerTypes'

interface ProjectTrackerDashboardProps {
  stats: ProjectDashboardStats
  fiscalYear: number
  strategyFilter?: string
  statusFilter?: string
  budgetSourceFilter?: string
  onSelectStrategy?: (strategy: string) => void
  onSelectStatus?: (status: string) => void
  onSelectBudgetSource?: (source: string) => void
}

const CHART_TICK_SECONDARY = { fontSize: 12, fill: 'var(--ds-color-text-secondary)' }
const CHART_TICK_PRIMARY = { fontSize: 12, fill: 'var(--ds-color-text-primary)' }
const CHART_MARGIN = { top: 4, right: 20, left: 8, bottom: 4 }
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

function formatBaht(amount: number): string {
  return `฿${Math.round(amount).toLocaleString('en-US')}`
}

function formatCompactBaht(amount: number): string {
  if (amount >= 1_000_000) {
    return `฿${(amount / 1_000_000).toFixed(2)}M`
  }
  if (amount >= 1_000) {
    return `฿${Math.round(amount / 1_000).toLocaleString('en-US')}K`
  }
  return formatBaht(amount)
}

function getStatusToneClass(status: string): string {
  if (status === 'ส่งแล้ว') return 'ptToneSubmitted'
  if (status === 'ยังไม่ส่ง') return 'ptTonePending'
  if (status === 'ไม่ใช้งบประมาณ') return 'ptToneNoBudget'
  if (status === 'ยกเลิกโครงการ') return 'ptToneCancelled'
  return 'ptToneNoBudget'
}

const ProjectTrackerDashboard = React.memo(function ProjectTrackerDashboard({
  stats,
  fiscalYear,
  strategyFilter = '',
  statusFilter = '',
  budgetSourceFilter = '',
  onSelectStrategy,
  onSelectStatus,
  onSelectBudgetSource,
}: ProjectTrackerDashboardProps) {
  const [chartMode, setChartMode] = useState<'budget' | 'projects'>('budget')

  const total = Math.max(0, stats.totalProjects)
  const orderedStatusEntries = useMemo(
    () =>
      sortByPreferredOrder(
        Object.keys(stats.byStatus).filter((s) => (stats.byStatus[s] || 0) > 0),
        PROJECT_SUBMISSION_STATUSES
      ).map((label) => ({
        label,
        count: stats.byStatus[label] || 0,
      })),
    [stats.byStatus]
  )

  const chartData = useMemo(
    () =>
      stats.byStrategy.map((row) => ({
        strategy: row.strategy,
        ส่งแล้ว: row.submittedCount,
        ยังไม่ส่ง: row.pendingCount,
        ไม่ใช้งบหรือยกเลิก: row.noBudgetCount + row.cancelledCount,
        ใช้จ่ายจริง: row.actualSpent,
        งบคงเหลือ: Math.max(0, row.remainingBudget),
        allocatedBudget: row.allocatedBudget,
      })),
    [stats.byStrategy]
  )

  const chartHeight = Math.max(240, chartData.length * 38 + 32)
  const activeStrategyCount = stats.byStrategy.filter((s) => s.totalProjects > 0).length

  return (
    <section
      className="ptDashboardSection"
      aria-label={`ภาพรวมการติดตามโครงการ ปีงบประมาณ ${fiscalYear}`}
    >
      {/* Compact 4-Card KPI Strip */}
      <div className="ptKpiGrid">
        <div className="ptKpiCard ptKpiCardAccent">
          <span className="ptKpiLabel">ส่งสรุปโครงการแล้ว</span>
          <div className="ptKpiValueRow">
            <span className="ptKpiValue">
              {stats.submittedCount.toLocaleString()} / {stats.totalProjects.toLocaleString()}
            </span>
            <span className="ptKpiHighlight">{stats.submissionRate.toFixed(1)}%</span>
          </div>
          <span className="ptKpiSub">
            ยังไม่ส่ง {stats.pendingCount.toLocaleString()} · ไม่ใช้งบ{' '}
            {stats.noBudgetCount.toLocaleString()} · ยกเลิก {stats.cancelledCount.toLocaleString()}
          </span>
        </div>

        <div className="ptKpiCard">
          <span className="ptKpiLabel">โครงการในแผนปฏิบัติการ</span>
          <div className="ptKpiValueRow">
            <span className="ptKpiValue">{stats.totalProjects.toLocaleString()} โครงการ</span>
          </div>
          <span className="ptKpiSub">
            ปีงบประมาณ {fiscalYear} · {activeStrategyCount} หมวดยุทธศาสตร์
          </span>
        </div>

        <div className="ptKpiCard">
          <span className="ptKpiLabel">งบประมาณได้รับจัดสรรรวม (Q1–Q4)</span>
          <div className="ptKpiValueRow">
            <span className="ptKpiValue">{formatBaht(stats.allocatedBudgetTotal)}</span>
          </div>
          <span className="ptKpiSub">
            Q1 {formatCompactBaht(stats.byQuarter[0]?.allocatedBudget ?? 0)} · Q2{' '}
            {formatCompactBaht(stats.byQuarter[1]?.allocatedBudget ?? 0)} · Q3{' '}
            {formatCompactBaht(stats.byQuarter[2]?.allocatedBudget ?? 0)} · Q4{' '}
            {formatCompactBaht(stats.byQuarter[3]?.allocatedBudget ?? 0)}
          </span>
        </div>

        <div className="ptKpiCard">
          <span className="ptKpiLabel">งบประมาณใช้จริง (คงเหลือสุทธิ)</span>
          <div className="ptKpiValueRow">
            <span className="ptKpiValue">{formatBaht(stats.actualSpentTotal)}</span>
            <span className="ptKpiHighlight">
              คงเหลือ {stats.remainingRate.toFixed(1)}%
            </span>
          </div>
          <span className="ptKpiSub">
            คงเหลือสุทธิ {formatBaht(stats.remainingBudgetTotal)}
          </span>
        </div>
      </div>

      {/* Charts & Breakdown Split */}
      <div className="ptChartsGrid">
        <div className="ptCard ptSpan8">
          <div className="ptCardHeader">
            <div>
              <h2 className="ptCardTitle">
                {chartMode === 'budget'
                  ? 'การใช้งบประมาณจำแนกรายยุทธศาสตร์'
                  : 'ความก้าวหน้าการส่งสรุปโครงการรายยุทธศาสตร์'}
              </h2>
              <span className="ptCardMeta">
                {stats.byStrategy.length > 0
                  ? `จำแนกตาม ${stats.byStrategy.length} หมวดยุทธศาสตร์ที่มีข้อมูล ปีงบประมาณ ${fiscalYear}`
                  : `ปีงบประมาณ ${fiscalYear}`}
              </span>
            </div>

            <div className="ptTabGroup" role="tablist" aria-label="สลับมุมมองกราฟ">
              <button
                type="button"
                role="tab"
                aria-selected={chartMode === 'budget'}
                className={`ptTabBtn ${chartMode === 'budget' ? 'active' : ''}`}
                onClick={() => setChartMode('budget')}
              >
                งบประมาณ (บาท)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={chartMode === 'projects'}
                className={`ptTabBtn ${chartMode === 'projects' ? 'active' : ''}`}
                onClick={() => setChartMode('projects')}
              >
                จำนวนโครงการ
              </button>
            </div>
          </div>

          <div className="ptChartLegend">
            {chartMode === 'budget' ? (
              <>
                <span className="ptLegendItem">
                  <span className="ptLegendSwatch ptSwatchSpent" />
                  ใช้จ่ายจริง
                </span>
                <span className="ptLegendItem">
                  <span className="ptLegendSwatch ptSwatchAccent" />
                  งบประมาณคงเหลือ
                </span>
              </>
            ) : (
              <>
                <span className="ptLegendItem">
                  <span className="ptLegendSwatch ptSwatchAccent" />
                  ส่งแล้ว
                </span>
                <span className="ptLegendItem">
                  <span className="ptLegendSwatch ptSwatchSpent" />
                  ยังไม่ส่ง
                </span>
                <span className="ptLegendItem">
                  <span className="ptLegendSwatch ptSwatchNeutral" />
                  ไม่ใช้งบฯ / ยกเลิก
                </span>
              </>
            )}
          </div>

          {stats.totalProjects === 0 ? (
            <div className="ptEmpty">ยังไม่มีข้อมูลโครงการสำหรับปีงบประมาณ {fiscalYear}</div>
          ) : (
            <div style={{ width: '100%', height: chartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={CHART_MARGIN}>
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
                    tickFormatter={(val: number) =>
                      chartMode === 'budget' ? formatCompactBaht(val) : String(val)
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="strategy"
                    width={72}
                    interval={0}
                    tick={CHART_TICK_PRIMARY}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                    itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    formatter={(value: unknown) => {
                      const num = Number(value ?? 0)
                      return chartMode === 'budget'
                        ? formatBaht(num)
                        : `${num.toLocaleString()} โครงการ`
                    }}
                  />
                  {chartMode === 'budget' ? (
                    <>
                      <Bar
                        dataKey="ใช้จ่ายจริง"
                        stackId="b"
                        fill="var(--ds-color-bg-warning-bold)"
                        barSize={18}
                      />
                      <Bar
                        dataKey="งบคงเหลือ"
                        stackId="b"
                        fill="var(--ds-color-bg-action-primary)"
                        barSize={18}
                        radius={[0, 4, 4, 0]}
                      />
                    </>
                  ) : (
                    <>
                      <Bar
                        dataKey="ส่งแล้ว"
                        stackId="p"
                        fill="var(--ds-color-bg-action-primary)"
                        barSize={18}
                      />
                      <Bar
                        dataKey="ยังไม่ส่ง"
                        stackId="p"
                        fill="var(--ds-color-bg-warning-bold)"
                        barSize={18}
                      />
                      <Bar
                        dataKey="ไม่ใช้งบหรือยกเลิก"
                        name="ไม่ใช้งบฯ / ยกเลิก"
                        stackId="p"
                        fill="var(--ds-color-border-subtle)"
                        barSize={18}
                        radius={[0, 4, 4, 0]}
                      />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="ptCard ptSpan4">
          <div className="ptCardHeader">
            <div>
              <h2 className="ptCardTitle">สัดส่วนสถานะการส่งงาน</h2>
              <span className="ptCardMeta">คลิกเพื่อกรองรายการในตารางด้านล่าง</span>
            </div>
          </div>

          {total === 0 ? (
            <div className="ptEmpty">ยังไม่มีข้อมูลสถานะโครงการ</div>
          ) : (
            <>
              <div className="ptShareBar" aria-hidden="true">
                {orderedStatusEntries
                  .filter((e) => e.count > 0)
                  .map((entry) => (
                    <div
                      key={entry.label}
                      className={getStatusToneClass(entry.label)}
                      style={{ width: `${(entry.count / total) * 100}%` }}
                    />
                  ))}
              </div>

              <div className="ptStatusList">
                {orderedStatusEntries.map((entry) => {
                  const pct = total > 0 ? (entry.count / total) * 100 : 0
                  const isActive = statusFilter === entry.label
                  const toneClass = getStatusToneClass(entry.label)
                  return (
                    <button
                      key={entry.label}
                      type="button"
                      className={`ptStatusBtn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        if (!onSelectStatus) return
                        onSelectStatus(isActive ? '' : entry.label)
                      }}
                    >
                      <div className="ptStatusBtnTop">
                        <span className="ptStatusLabelWrap">
                          <span className={`ptStatusDot ${toneClass}`} />
                          <span>{entry.label}</span>
                        </span>
                        <span className="ptStatusNums">
                          <strong>{entry.count.toLocaleString()}</strong> ({pct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="ptTrack">
                        <div
                          className={`ptTrackFill ${toneClass}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {stats.byBudgetSource.length > 0 && (
            <div className="ptSourceSection">
              <span className="ptCardMeta">แหล่งงบประมาณ (คลิกเพื่อกรอง)</span>
              <div className="ptSourceGrid">
                {stats.byBudgetSource.map((src) => {
                  const isActive = budgetSourceFilter === src.label
                  return (
                    <button
                      key={src.label}
                      type="button"
                      className={`ptSourceBtn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        if (!onSelectBudgetSource) return
                        onSelectBudgetSource(isActive ? '' : src.label)
                      }}
                    >
                      <span className="ptSourceName">
                        {src.label} ({src.count})
                      </span>
                      <span className="ptSourceMeta">{formatBaht(src.allocatedBudget)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Strategic Summary Table */}
        <div className="ptCard ptSpan12">
          <div className="ptCardHeader">
            <div>
              <h2 className="ptCardTitle">
                ตารางสรุปผลการดำเนินงานและงบประมาณจำแนกรายยุทธศาสตร์
              </h2>
              <span className="ptCardMeta">
                คลิกแถวยุทธศาสตร์เพื่อกรองรายการโครงการในทะเบียนคุม
              </span>
            </div>
          </div>

          {stats.byStrategy.length === 0 ? (
            <div className="ptEmpty">ยังไม่มีข้อมูลโครงการสำหรับปีงบประมาณ {fiscalYear}</div>
          ) : (
            <div className="ptSummaryScroll">
              <table className="ptSummaryTable">
                <thead>
                  <tr>
                    <th>ยุทธศาสตร์</th>
                    <th className="ptNumCol">โครงการทั้งหมด</th>
                    <th className="ptNumCol">ส่งสรุปแล้ว</th>
                    <th className="ptNumCol">ยังไม่ส่ง</th>
                    <th className="ptNumCol">ไม่ใช้งบฯ</th>
                    <th className="ptNumCol">ยกเลิก</th>
                    <th>ความก้าวหน้า</th>
                    <th className="ptNumCol">งบได้รับจัดสรรรวม</th>
                    <th className="ptNumCol">งบใช้จ่ายจริงรวม</th>
                    <th className="ptNumCol">งบคงเหลือรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byStrategy.map((row) => {
                    const isActive = strategyFilter === row.strategy
                    return (
                      <tr
                        key={row.strategy}
                        className={`ptSummaryRowClickable ${isActive ? 'ptSummaryRowActive' : ''}`}
                        onClick={() => {
                          if (!onSelectStrategy) return
                          onSelectStrategy(isActive ? '' : row.strategy)
                        }}
                      >
                        <td>
                          <span className="ptStrategyTag">{row.strategy}</span>
                        </td>
                        <td className="ptNumCol">{row.totalProjects.toLocaleString()}</td>
                        <td className="ptNumCol">{row.submittedCount.toLocaleString()}</td>
                        <td className="ptNumCol">{row.pendingCount.toLocaleString()}</td>
                        <td className="ptNumCol">{row.noBudgetCount.toLocaleString()}</td>
                        <td className="ptNumCol">{row.cancelledCount.toLocaleString()}</td>
                        <td>
                          <div className="ptMiniProgressWrap">
                            <div className="ptMiniProgressTrack">
                              <div
                                className="ptMiniProgressFill"
                                style={{ width: `${Math.min(100, row.completionRate)}%` }}
                              />
                            </div>
                            <span>{row.completionRate.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="ptNumCol">{formatBaht(row.allocatedBudget)}</td>
                        <td className="ptNumCol">{formatBaht(row.actualSpent)}</td>
                        <td className="ptNumCol">{formatBaht(row.remainingBudget)}</td>
                      </tr>
                    )
                  })}
                  <tr className="ptSummaryTotalRow">
                    <td>รวมทั้งหมด</td>
                    <td className="ptNumCol">{stats.totalProjects.toLocaleString()}</td>
                    <td className="ptNumCol">{stats.submittedCount.toLocaleString()}</td>
                    <td className="ptNumCol">{stats.pendingCount.toLocaleString()}</td>
                    <td className="ptNumCol">{stats.noBudgetCount.toLocaleString()}</td>
                    <td className="ptNumCol">{stats.cancelledCount.toLocaleString()}</td>
                    <td>
                      <div className="ptMiniProgressWrap">
                        <div className="ptMiniProgressTrack">
                          <div
                            className="ptMiniProgressFill"
                            style={{ width: `${Math.min(100, stats.submissionRate)}%` }}
                          />
                        </div>
                        <span>{stats.submissionRate.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="ptNumCol">{formatBaht(stats.allocatedBudgetTotal)}</td>
                    <td className="ptNumCol">{formatBaht(stats.actualSpentTotal)}</td>
                    <td className="ptNumCol">{formatBaht(stats.remainingBudgetTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
})

export default ProjectTrackerDashboard
