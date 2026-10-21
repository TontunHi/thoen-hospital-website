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
  Cell,
} from 'recharts'
import { BarChart3, TrendingUp, Layers } from 'lucide-react'

interface MisHosChartProps {
  records: Record<string, any>[]
  reportTitle: string
  chartType?: string
}

const PALETTE = ['#0284c7', '#0f766e', '#059669', '#0369a1', '#2563eb', '#0891b2', '#475569', '#334155']

export default function MisHosChart({ records, reportTitle }: MisHosChartProps) {
  if (!records || records.length === 0) return null

  // Analyze record keys to determine best chart data structure
  const first = records[0]

  // Case 1: Multi-year trend (e.g. YEAR & BUDGET_UC)
  if ('YEAR' in first && ('BUDGET_UC' in first || 'BUDGET' in first)) {
    const valKey = 'BUDGET_UC' in first ? 'BUDGET_UC' : 'BUDGET'
    const chartData = records.map(r => ({
      name: `ปี ${r.YEAR}`,
      value: parseFloat(r[valKey]) || 0,
    }))

    return (
      <div className="bt-mishos-chart-card">
        <div className="bt-mishos-chart-header">
          <h3 className="bt-mishos-chart-title">
            <TrendingUp size={16} style={{ color: '#0284c7' }} />
            <span>แนวโน้มงบประมาณรายปี: {reportTitle}</span>
          </h3>
          <span className="bt-mishos-chart-unit">หน่วย: ล้านบาท</span>
        </div>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
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
              <Bar dataKey="value" name="งบประมาณ (ล้านบาท)" fill="#0284c7" radius={[4, 4, 0, 0]} />
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
      <div className="bt-mishos-chart-card">
        <div className="bt-mishos-chart-header">
          <h3 className="bt-mishos-chart-title">
            <BarChart3 size={16} style={{ color: '#0f766e' }} />
            <span>แนวโน้มการโอนเงินรายเดือน: {reportTitle}</span>
          </h3>
          <span className="bt-mishos-chart-unit">{isMillion ? 'หน่วย: ล้านบาท' : 'หน่วย: บาท'}</span>
        </div>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 35 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" tick={{ fontSize: 10, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
              <Tooltip
                formatter={(val: any) => [
                  `${Number(val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ${isMillion ? 'ล้านบาท' : 'บาท'}`,
                  'ยอดเงิน'
                ]}
                contentStyle={{
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8125rem',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
              <Bar dataKey="value" name="ยอดเงิน" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  // Case 3: Categorical / Fund breakdown (e.g. DESCRIPTION / M_FUND_DESC & BUDGET / ACT_AMT)
  const nameKey = 'DESCRIPTION' in first ? 'DESCRIPTION' : ('M_FUND_DESC' in first ? 'M_FUND_DESC' : ('S_FUND_DESC' in first ? 'S_FUND_DESC' : null))
  const numKey = 'ACT_AMT' in first ? 'ACT_AMT' : ('BUDGET' in first ? 'BUDGET' : ('ACT_AMT_STM' in first ? 'ACT_AMT_STM' : null))

  if (nameKey && numKey) {
    const sorted = [...records]
      .sort((a, b) => (parseFloat(b[numKey]) || 0) - (parseFloat(a[numKey]) || 0))
      .slice(0, 10)

    const chartData = sorted.map(r => ({
      name: String(r[nameKey]).length > 25 ? String(r[nameKey]).substring(0, 25) + '...' : String(r[nameKey]),
      fullName: String(r[nameKey]),
      value: parseFloat(r[numKey]) || 0,
    }))

    return (
      <div className="bt-mishos-chart-card">
        <div className="bt-mishos-chart-header">
          <h3 className="bt-mishos-chart-title">
            <Layers size={16} style={{ color: '#0369a1' }} />
            <span>10 อันดับกองทุน/รายการงบประมาณสูงสุด: {reportTitle}</span>
          </h3>
          <span className="bt-mishos-chart-unit">หน่วย: บาท</span>
        </div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
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
                  <Cell key={`cell-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  return null
}
