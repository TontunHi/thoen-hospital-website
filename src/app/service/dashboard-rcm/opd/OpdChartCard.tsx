'use client'

import React from 'react'
import { TrendingUp } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface OpdChartItem {
  name: string
  visits: number
  patients: number
}

interface OpdChartCardProps {
  chartData: OpdChartItem[]
}

export default function OpdChartCard({ chartData }: OpdChartCardProps) {
  if (chartData.length === 0) return null

  return (
    <div className="rcm-chart-card">
      <div className="rcm-chart-header">
        <div>
          <h4 className="rcm-chart-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <TrendingUp size={18} style={{ color: '#059669' }} />
            <span>กราฟเปรียบเทียบจำนวนครั้งการรับบริการ (VN) แยกรายแผนก</span>
          </h4>
          <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
            เรียงลำดับตามจำนวนครั้งการรับบริการจากมากไปน้อย • แสดงผลควบคู่กับจำนวนคน (HN)
          </p>
        </div>
      </div>
      <div style={{ height: '380px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: '#0f172a' }} />
            <Tooltip
              formatter={(val: any, _name: any, item: any) => {
                const patients = item?.payload?.patients ?? 0
                return [
                  `${Number(val).toLocaleString()} ครั้ง (ผู้ป่วย: ${Number(patients).toLocaleString()} คน)`,
                  'จำนวนครั้งที่รับบริการ',
                ]
              }}
              contentStyle={{
                backgroundColor: '#ffffff',
                borderColor: '#cbd5e1',
                borderRadius: '8px',
                fontSize: '0.82rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}
            />
            <Bar dataKey="visits" fill="#059669" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
