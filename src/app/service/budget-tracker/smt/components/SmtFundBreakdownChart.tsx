'use client'

import React from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { SmtBudgetRecord } from '@/lib/budget/smtBudgetService'

interface SmtFundBreakdownChartProps {
  records: SmtBudgetRecord[]
  selectedFund: string
  onSelectFund: (fund: string) => void
}

const COLORS = [
  '#059669', // Emerald
  '#0284c7', // Sky
  '#d97706', // Amber
  '#6366f1', // Indigo
  '#e11d48', // Rose
  '#0d9488', // Teal
  '#8b5cf6', // Violet
  '#64748b', // Slate
  '#ea580c', // Orange
]

export default function SmtFundBreakdownChart({
  records,
  selectedFund,
  onSelectFund,
}: SmtFundBreakdownChartProps) {
  const groupMap: Record<string, number> = {}

  records.forEach(r => {
    const raw = (r.fundGroupDescr || r.fundName || 'อื่นๆ').trim()
    const amt = Number(r.amount) || 0
    groupMap[raw] = (groupMap[raw] || 0) + amt
  })

  const totalAll = Object.values(groupMap).reduce((a, b) => a + b, 0) || 1

  const chartData = Object.entries(groupMap)
    .map(([name, value]) => ({
      name,
      value: Math.round(value),
      pct: ((value / totalAll) * 100).toFixed(1),
    }))
    .sort((a, b) => b.value - a.value)

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 }).format(val)
  }

  if (chartData.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
        ไม่มีข้อมูลกลุ่มกองทุน
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 280, display: 'flex', alignItems: 'center' }}>
      <div style={{ width: '55%', height: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              onClick={(entry: any) => {
                if (entry && entry.name) {
                  onSelectFund(selectedFund === entry.name ? 'ALL' : entry.name)
                }
              }}
              cursor="pointer"
            >
              {chartData.map((entry, index) => {
                const isSelected = selectedFund === entry.name
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    stroke={isSelected ? '#0f172a' : '#ffffff'}
                    strokeWidth={isSelected ? 3 : 1}
                    opacity={selectedFund === 'ALL' || isSelected ? 1 : 0.45}
                  />
                )
              })}
            </Pie>
            <Tooltip
              formatter={(value: any, name: any, item: any) => [
                `฿${formatMoney(Number(value))} (${item.payload.pct}%)`,
                name,
              ]}
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.8rem',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Custom Legend List on Right */}
      <div
        style={{
          width: '45%',
          maxHeight: '260px',
          overflowY: 'auto',
          paddingRight: '0.5rem',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {chartData.map((d, i) => {
            const isSelected = selectedFund === d.name
            return (
              <button
                key={d.name}
                type="button"
                onClick={() => onSelectFund(isSelected ? 'ALL' : d.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.4rem',
                  padding: '0.25rem 0.45rem',
                  borderRadius: '6px',
                  border: isSelected ? '1px solid #059669' : '1px solid transparent',
                  background: isSelected ? '#ecfdf5' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: COLORS[i % COLORS.length],
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#065f46' : '#334155',
                    }}
                    title={d.name}
                  >
                    {d.name}
                  </span>
                </div>
                <b style={{ color: '#0f172a', flexShrink: 0 }}>{d.pct}%</b>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
