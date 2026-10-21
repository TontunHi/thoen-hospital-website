'use client'

import React from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { SmtBudgetRecord } from '@/lib/budget/smtBudgetService'

interface SmtDisbursementTrendChartProps {
  records: SmtBudgetRecord[]
  selectedYears: string[]
}

const THAI_MONTH_NAMES: Record<string, string> = {
  '01': 'ม.ค.',
  '02': 'ก.พ.',
  '03': 'มี.ค.',
  '04': 'เม.ย.',
  '05': 'พ.ค.',
  '06': 'มิ.ย.',
  '07': 'ก.ค.',
  '08': 'ส.ค.',
  '09': 'ก.ย.',
  '10': 'ต.ค.',
  '11': 'พ.ย.',
  '12': 'ธ.ค.',
}

export default function SmtDisbursementTrendChart({
  records,
  selectedYears,
}: SmtDisbursementTrendChartProps) {
  const isMultiYear = selectedYears.length > 1

  // Format currency helper
  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(val)
  }

  const formatShort = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`
    return String(val)
  }

  // Multi-Year Data: Compare by Year along X-axis
  if (isMultiYear) {
    const sortedYears = [...selectedYears].sort()
    const chartData = sortedYears.map(yr => {
      const yearRecords = records.filter(r => r.fiscalYear === yr)
      const allocated = yearRecords.reduce((acc, r) => acc + (Number(r.amount) || 0), 0)
      const net = yearRecords.reduce((acc, r) => acc + (Number(r.total) || 0), 0)
      return {
        name: `ปีงบ ${yr}`,
        allocated: Math.round(allocated),
        net: Math.round(net),
      }
    })

    return (
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} />
            <YAxis tickFormatter={formatShort} tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip
              formatter={(value: any, name: any) => [
                `฿${formatMoney(Number(value))}`,
                name === 'allocated' ? 'วงเงินจัดสรร' : 'ยอดโอนสุทธิ',
              ]}
              labelStyle={{ fontWeight: 700, color: '#0f172a' }}
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
              }}
            />
            <Legend
              formatter={value => (value === 'allocated' ? 'วงเงินจัดสรร (Amount)' : 'ยอดโอนสุทธิ (Net Total)')}
              wrapperStyle={{ fontSize: '0.8rem', paddingTop: '6px' }}
            />
            <Bar dataKey="allocated" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={48} />
            <Line
              type="monotone"
              dataKey="net"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ fill: '#10b981', r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // Single Year: Monthly Trend in Thai Fiscal Cycle (Oct - Sep)
  const currentYearNum = parseInt(selectedYears[0] || '2570', 10)
  const prevYearNum = currentYearNum - 1

  const fiscalMonths = [
    { key: `${prevYearNum}10`, label: `ต.ค. ${String(prevYearNum).slice(-2)}` },
    { key: `${prevYearNum}11`, label: `พ.ย. ${String(prevYearNum).slice(-2)}` },
    { key: `${prevYearNum}12`, label: `ธ.ค. ${String(prevYearNum).slice(-2)}` },
    { key: `${currentYearNum}01`, label: `ม.ค. ${String(currentYearNum).slice(-2)}` },
    { key: `${currentYearNum}02`, label: `ก.พ. ${String(currentYearNum).slice(-2)}` },
    { key: `${currentYearNum}03`, label: `มี.ค. ${String(currentYearNum).slice(-2)}` },
    { key: `${currentYearNum}04`, label: `เม.ย. ${String(currentYearNum).slice(-2)}` },
    { key: `${currentYearNum}05`, label: `พ.ค. ${String(currentYearNum).slice(-2)}` },
    { key: `${currentYearNum}06`, label: `มิ.ย. ${String(currentYearNum).slice(-2)}` },
    { key: `${currentYearNum}07`, label: `ก.ค. ${String(currentYearNum).slice(-2)}` },
    { key: `${currentYearNum}08`, label: `ส.ค. ${String(currentYearNum).slice(-2)}` },
    { key: `${currentYearNum}09`, label: `ก.ย. ${String(currentYearNum).slice(-2)}` },
  ]

  const monthMap: Record<string, { allocated: number; net: number; label: string }> = {}
  fiscalMonths.forEach(fm => {
    monthMap[fm.key] = { allocated: 0, net: 0, label: fm.label }
  })

  records.forEach(r => {
    const dateStr = String(r.postingDate || '')
    if (dateStr.length >= 6) {
      const key = dateStr.substring(0, 6)
      if (!monthMap[key]) {
        const y = key.substring(0, 4)
        const m = key.substring(4, 6)
        const thM = THAI_MONTH_NAMES[m] || m
        monthMap[key] = { allocated: 0, net: 0, label: `${thM} ${y.slice(-2)}` }
      }
      monthMap[key].allocated += Number(r.amount) || 0
      monthMap[key].net += Number(r.total) || 0
    }
  })

  const chartData = fiscalMonths.map(fm => ({
    name: fm.label,
    allocated: Math.round(monthMap[fm.key]?.allocated || 0),
    net: Math.round(monthMap[fm.key]?.net || 0),
  }))

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 15, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 11 }} />
          <YAxis tickFormatter={formatShort} tick={{ fill: '#64748b', fontSize: 11 }} />
          <Tooltip
            formatter={(value: any, name: any) => [
              `฿${formatMoney(Number(value))}`,
              name === 'allocated' ? 'วงเงินจัดสรร' : 'ยอดโอนสุทธิ',
            ]}
            labelStyle={{ fontWeight: 700, color: '#0f172a' }}
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
            }}
          />
          <Legend
            formatter={value => (value === 'allocated' ? 'วงเงินจัดสรร (Amount)' : 'ยอดโอนสุทธิ (Net Total)')}
            wrapperStyle={{ fontSize: '0.8rem', paddingTop: '6px' }}
          />
          <Bar dataKey="allocated" fill="#059669" radius={[3, 3, 0, 0]} maxBarSize={30} />
          <Line
            type="monotone"
            dataKey="net"
            stroke="#0284c7"
            strokeWidth={2.5}
            dot={{ fill: '#0284c7', r: 3.5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
