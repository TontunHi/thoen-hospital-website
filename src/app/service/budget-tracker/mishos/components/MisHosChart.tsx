'use client'

import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts'
import { BarChart3, TrendingUp, Layers, PieChart as PieIcon } from 'lucide-react'
import { MisHosChartConfig } from '@/lib/budget/misHosService'

interface MisHosChartProps {
  records: Record<string, any>[]
  reportTitle: string
  chartType?: string
  chartConfig?: MisHosChartConfig | null
  height?: number
  hideHeader?: boolean
}

const DEFAULT_PALETTE = [
  '#0284c7',
  '#0f766e',
  '#059669',
  '#0369a1',
  '#2563eb',
  '#0891b2',
  '#475569',
  '#334155',
]

export default function MisHosChart({
  records,
  reportTitle,
  chartType = 'bar',
  chartConfig,
  height = 260,
  hideHeader = false,
}: MisHosChartProps) {
  if (!records || records.length === 0) return null

  const palette = chartConfig?.color && chartConfig.color.length > 0
    ? chartConfig.color
    : DEFAULT_PALETTE

  const unitLabel = chartConfig?.yaxis ? `หน่วย: ${chartConfig.yaxis}` : 'หน่วย: ล้านบาท'

  const first = records[0]

  // Case 0: Pie / Donut Chart (สัดส่วน เช่น ผ่าน / ไม่ผ่าน หรือ สัดส่วนกองทุน)
  if (chartType === 'pie') {
    let pieData: { name: string; fullName: string; value: number }[] = []

    // Pattern A: Single record with category keys e.g. { 'ผ่าน': '3848', 'ไม่ผ่าน': '19' }
    // Matching MIS HOS Module 381: if ("pie" === r && 1 === data.length) Object.keys(data[0]).forEach(...)
    if (records.length === 1) {
      const row = records[0]
      pieData = Object.keys(row)
        .filter(k => !k.toUpperCase().includes('ID') && String(row[k]).trim() !== '')
        .map(k => ({
          name: k,
          fullName: k,
          value: parseFloat(row[k]) || 0,
        }))
        .filter(d => !isNaN(d.value) && d.value >= 0)
    } else {
      // Pattern B: Multiple records with categorical name and numeric value
      const nameKey =
        'DESCRIPTION' in first
          ? 'DESCRIPTION'
          : 'M_FUND_DESC' in first
            ? 'M_FUND_DESC'
            : 'S_FUND_DESC' in first
              ? 'S_FUND_DESC'
              : 'PROVINCE_NAME' in first
                ? 'PROVINCE_NAME'
                : null
      const numKey =
        'ACT_AMT' in first
          ? 'ACT_AMT'
          : 'BUDGET' in first
            ? 'BUDGET'
            : 'ACT_AMT_STM' in first
              ? 'ACT_AMT_STM'
              : 'SUM_AMT' in first
                ? 'SUM_AMT'
                : null

      if (nameKey && numKey) {
        pieData = records
          .slice(0, 10)
          .map(r => ({
            name: String(r[nameKey]).length > 25 ? String(r[nameKey]).substring(0, 25) + '...' : String(r[nameKey]),
            fullName: String(r[nameKey]),
            value: parseFloat(r[numKey]) || 0,
          }))
          .filter(d => !isNaN(d.value) && d.value > 0)
      } else {
        const keys = Object.keys(first)
        const labelKey =
          keys.find(k => typeof first[k] === 'string' && isNaN(Number(first[k])) && !k.toUpperCase().includes('ID')) ||
          keys[0]
        const valKey = keys.find(k => k !== labelKey && !isNaN(Number(first[k])))
        if (valKey) {
          pieData = records
            .slice(0, 10)
            .map(r => ({
              name: String(r[labelKey]).length > 25 ? String(r[labelKey]).substring(0, 25) + '...' : String(r[labelKey]),
              fullName: String(r[labelKey]),
              value: parseFloat(r[valKey]) || 0,
            }))
            .filter(d => !isNaN(d.value) && d.value > 0)
        }
      }
    }

    if (pieData.length > 0) {
      const total = pieData.reduce((acc, d) => acc + d.value, 0)
      const isPassFail = pieData.some(d => d.name.includes('ผ่าน'))

      // Specific semantic palette for pass/fail vs general palette
      const getSliceColor = (name: string, idx: number) => {
        if (name === 'ผ่าน' || name.startsWith('ผ่าน')) return '#10b981' // emerald-500
        if (name === 'ไม่ผ่าน' || name.includes('ไม่ผ่าน')) return '#ef4444' // red-500
        return palette[idx % palette.length]
      }

      return (
        <div className={hideHeader ? '' : 'bt-mishos-chart-card'}>
          {!hideHeader && (
            <div className="bt-mishos-chart-header">
              <h3 className="bt-mishos-chart-title">
                <PieIcon size={16} style={{ color: palette[0] || '#0369a1' }} />
                <span>สัดส่วน: {reportTitle}</span>
              </h3>
              <span className="bt-mishos-chart-unit">{unitLabel}</span>
            </div>
          )}
          <div style={{ width: '100%', height }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={Math.min(height / 4 - 5, 45)}
                  outerRadius={Math.min(height / 2 - 25, 90)}
                  paddingAngle={pieData.length > 1 ? 3 : 0}
                  label={({ name, percent }: any) =>
                    `${name} (${((percent || 0) * 100).toFixed(1)}%)`
                  }
                  labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                >
                  {pieData.map((d, idx) => (
                    <Cell key={`pie-cell-${idx}`} fill={getSliceColor(d.name, idx)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any) => {
                    const num = Number(val ?? 0)
                    const pct = total > 0 ? ((num / total) * 100).toFixed(1) : '0'
                    const unitSuffix = isPassFail ? 'รายการ' : (chartConfig?.yaxis || 'บาท')
                    return [`${num.toLocaleString('th-TH')} ${unitSuffix} (${pct}%)`, name]
                  }}
                  contentStyle={{
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8125rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  wrapperStyle={{ fontSize: '0.8125rem', paddingTop: '4px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
    }
  }

  // Case 1: Multi-year trend (e.g. YEAR & BUDGET_UC or BUDGET)
  if ('YEAR' in first && ('BUDGET_UC' in first || 'BUDGET' in first)) {
    const valKey = 'BUDGET_UC' in first ? 'BUDGET_UC' : 'BUDGET'
    const chartData = records.map(r => ({
      name: `ปี ${r.YEAR}`,
      value: parseFloat(r[valKey]) || 0,
    }))

    return (
      <div className={hideHeader ? '' : 'bt-mishos-chart-card'}>
        {!hideHeader && (
          <div className="bt-mishos-chart-header">
            <h3 className="bt-mishos-chart-title">
              <TrendingUp size={16} style={{ color: palette[0] || '#0284c7' }} />
              <span>แนวโน้มงบประมาณรายปี: {reportTitle}</span>
            </h3>
            <span className="bt-mishos-chart-unit">{unitLabel}</span>
          </div>
        )}
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  formatter={(val: any) => [
                    `${Number(val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ล้านบาท`,
                    'ยอดเงิน',
                  ]}
                  contentStyle={{
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8125rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <Line type="monotone" dataKey="value" stroke={palette[0] || '#0284c7'} strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  formatter={(val: any) => [
                    `${Number(val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ล้านบาท`,
                    'ยอดเงิน',
                  ]}
                  contentStyle={{
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8125rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <Bar dataKey="value" name="งบประมาณ (ล้านบาท)" fill={palette[0] || '#0284c7'} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  // Case 1B: High Cost Multi-Series (STEMI/Stroke, Cancer OP/IP, Cataract In/Out, Instrument OP/IP)
  const isMultiSeriesYear =
    ('YEAR' in first || 'MONTH' in first) &&
    (('ACTAMT_STEMI' in first || 'ACTAMT_STROKE' in first) ||
      ('ACT_AMT_OP' in first && 'ACT_AMT_IP' in first) ||
      ('ACTAMT_IN' in first || 'ACTAMT_OUT' in first))

  if (isMultiSeriesYear) {
    const xNameKey = 'YEAR' in first ? 'YEAR' : 'MONTH'
    const isStemi = 'ACTAMT_STEMI' in first || 'ACTAMT_STROKE' in first
    const isCataract = 'ACTAMT_IN' in first || 'ACTAMT_OUT' in first
    const series1Key = isStemi ? 'ACTAMT_STROKE' : (isCataract ? 'ACTAMT_IN' : 'ACT_AMT_OP')
    const series1Name = isStemi ? 'STROKE (บาท)' : (isCataract ? 'ในเครือข่าย (บาท)' : 'ผู้ป่วยนอก OP (บาท)')
    const series2Key = isStemi ? 'ACTAMT_STEMI' : (isCataract ? 'ACTAMT_OUT' : 'ACT_AMT_IP')
    const series2Name = isStemi ? 'STEMI (บาท)' : (isCataract ? 'นอกเครือข่าย (บาท)' : 'ผู้ป่วยใน IP (บาท)')
    const isStacked = (isStemi || isCataract) ? xNameKey === 'MONTH' : true

    const defaultColor1 = isStemi ? '#bf9930' : (isCataract ? '#1d7373' : '#e0e065')
    const defaultColor2 = isStemi ? '#f2de7e' : (isCataract ? '#5ccccc' : '#d6ba87')

    const chartData = records.map(r => ({
      name: xNameKey === 'YEAR' ? `ปี ${r.YEAR}` : String(r.MONTH),
      series1: parseFloat(r[series1Key]) || 0,
      series2: parseFloat(r[series2Key]) || 0,
    }))

    return (
      <div className={hideHeader ? '' : 'bt-mishos-chart-card'}>
        {!hideHeader && (
          <div className="bt-mishos-chart-header">
            <h3 className="bt-mishos-chart-title">
              <TrendingUp size={16} style={{ color: palette[0] || '#0284c7' }} />
              <span>เปรียบเทียบชดเชยค่าบริการ: {reportTitle}</span>
            </h3>
            <span className="bt-mishos-chart-unit">{unitLabel}</span>
          </div>
        )}
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
              <Tooltip
                formatter={(val: any, name: any) => [
                  `${Number(val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`,
                  name,
                ]}
                contentStyle={{
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8125rem',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '0.5rem' }} />
              <Bar
                dataKey="series1"
                name={series1Name}
                fill={palette[0] || defaultColor1}
                radius={isStacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                stackId={isStacked ? 'multiSeriesStack' : undefined}
              />
              <Bar
                dataKey="series2"
                name={series2Name}
                fill={palette[1] || defaultColor2}
                radius={[4, 4, 0, 0]}
                stackId={isStacked ? 'multiSeriesStack' : undefined}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  // Case 2: Monthly trend (e.g. MONTH_SEND & BUDGET / SUM_AMT)
  if ('MONTH_SEND' in first) {
    const valKey = 'BUDGET' in first ? 'BUDGET' : ('SUM_AMT' in first ? 'SUM_AMT' : Object.keys(first)[1])
    const isMillion = valKey === 'BUDGET'
    const chartData = records.map(r => ({
      name: r.MONTH_SEND,
      value: parseFloat(r[valKey]) || 0,
    }))

    return (
      <div className={hideHeader ? '' : 'bt-mishos-chart-card'}>
        {!hideHeader && (
          <div className="bt-mishos-chart-header">
            <h3 className="bt-mishos-chart-title">
              <BarChart3 size={16} style={{ color: palette[1] || '#0f766e' }} />
              <span>แนวโน้มการโอนเงินรายเดือน: {reportTitle}</span>
            </h3>
            <span className="bt-mishos-chart-unit">{chartConfig?.yaxis ? `หน่วย: ${chartConfig.yaxis}` : (isMillion ? 'หน่วย: ล้านบาท' : 'หน่วย: บาท')}</span>
          </div>
        )}
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  formatter={(val: any) => [
                    `${Number(val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ${isMillion ? 'ล้านบาท' : 'บาท'}`,
                    'ยอดเงิน',
                  ]}
                  contentStyle={{
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8125rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <Line type="monotone" dataKey="value" stroke={palette[1] || '#0f766e'} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  formatter={(val: any) => [
                    `${Number(val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ${isMillion ? 'ล้านบาท' : 'บาท'}`,
                    'ยอดเงิน',
                  ]}
                  contentStyle={{
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8125rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <Bar dataKey="value" name="ยอดเงิน" fill={palette[1] || '#0f766e'} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  // Case 3: Categorical / Fund breakdown
  const nameKey = 'DESCRIPTION' in first ? 'DESCRIPTION' : ('M_FUND_DESC' in first ? 'M_FUND_DESC' : ('S_FUND_DESC' in first ? 'S_FUND_DESC' : ('PROVINCE_NAME' in first ? 'PROVINCE_NAME' : null)))
  const numKey = 'ACT_AMT' in first ? 'ACT_AMT' : ('BUDGET' in first ? 'BUDGET' : ('ACT_AMT_STM' in first ? 'ACT_AMT_STM' : ('SUM_AMT' in first ? 'SUM_AMT' : null)))

  if (nameKey && numKey) {
    const sorted = [...records]
      .sort((a, b) => (parseFloat(b[numKey]) || 0) - (parseFloat(a[numKey]) || 0))
      .slice(0, 10)

    const chartData = sorted.map(r => ({
      name: String(r[nameKey]).length > 25 ? String(r[nameKey]).substring(0, 25) + '...' : String(r[nameKey]),
      fullName: String(r[nameKey]),
      value: parseFloat(r[numKey]) || 0,
    }))

    const isHorizontal = chartType === 'barhorizontal' || records.length > 5

    return (
      <div className={hideHeader ? '' : 'bt-mishos-chart-card'}>
        {!hideHeader && (
          <div className="bt-mishos-chart-header">
            <h3 className="bt-mishos-chart-title">
              <Layers size={16} style={{ color: palette[2] || '#0369a1' }} />
              <span>10 อันดับงบประมาณสูงสุด: {reportTitle}</span>
            </h3>
            <span className="bt-mishos-chart-unit">{unitLabel}</span>
          </div>
        )}
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            {isHorizontal ? (
              <BarChart layout="vertical" data={chartData} margin={{ top: 10, right: 30, left: 100, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#1e293b' }} width={95} />
                <Tooltip
                  formatter={(val: any) => [
                    `${Number(val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`,
                    'ยอดเงิน',
                  ]}
                  labelFormatter={(_, arr) => arr[0]?.payload?.fullName || ''}
                  contentStyle={{
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8125rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <Bar dataKey="value" name="ยอดเงิน (บาท)" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={palette[idx % palette.length]} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                <Tooltip
                  formatter={(val: any) => [
                    `${Number(val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`,
                    'ยอดเงิน',
                  ]}
                  labelFormatter={(_, arr) => arr[0]?.payload?.fullName || ''}
                  contentStyle={{
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8125rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <Bar dataKey="value" name="ยอดเงิน (บาท)" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={palette[idx % palette.length]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  // Case 4 (Generic Fallback): Any sub-report with non-table chartType
  if (chartType !== 'table') {
    const keys = Object.keys(first)
    const labelKey = keys.find(k => {
      const v = first[k]
      return typeof v === 'string' && isNaN(Number(v)) && !k.toUpperCase().includes('ID')
    }) || keys[0]

    const numericKeys = keys.filter(k => {
      if (k === labelKey) return false
      const v = first[k]
      return !isNaN(Number(v)) && String(v).trim() !== ''
    })

    if (labelKey && numericKeys.length > 0) {
      const chartData = records.slice(0, 15).map(r => {
        const item: Record<string, any> = {
          name: String(r[labelKey] || '').length > 20
            ? String(r[labelKey]).substring(0, 20) + '...'
            : String(r[labelKey] || ''),
          fullName: String(r[labelKey] || ''),
        }
        numericKeys.forEach(nk => {
          item[nk] = parseFloat(r[nk]) || 0
        })
        return item
      })

      const displayKeys = numericKeys.slice(0, 3) // show top 3 series max to keep chart clean

      return (
        <div className={hideHeader ? '' : 'bt-mishos-chart-card'}>
          {!hideHeader && (
            <div className="bt-mishos-chart-header">
              <h3 className="bt-mishos-chart-title">
                <BarChart3 size={16} style={{ color: palette[0] || '#0284c7' }} />
                <span>{reportTitle}</span>
              </h3>
              <span className="bt-mishos-chart-unit">{unitLabel}</span>
            </div>
          )}
          <div style={{ width: '100%', height }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      `${Number(val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
                      name,
                    ]}
                    labelFormatter={(_, arr) => arr[0]?.payload?.fullName || ''}
                    contentStyle={{
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8125rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    }}
                  />
                  {displayKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '0.25rem' }} />}
                  {displayKeys.map((nk, idx) => (
                    <Line
                      key={nk}
                      type="monotone"
                      dataKey={nk}
                      name={nk}
                      stroke={palette[idx % palette.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      `${Number(val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`,
                      name,
                    ]}
                    labelFormatter={(_, arr) => arr[0]?.payload?.fullName || ''}
                    contentStyle={{
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8125rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    }}
                  />
                  {displayKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '0.75rem', paddingTop: '0.25rem' }} />}
                  {displayKeys.map((nk, idx) => (
                    <Bar
                      key={nk}
                      dataKey={nk}
                      name={nk}
                      fill={palette[idx % palette.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )
    }
  }

  return null
}
