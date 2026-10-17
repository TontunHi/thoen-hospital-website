'use client'

import React from 'react'
import {
  Building2,
  RefreshCw,
  TrendingUp,
  Stethoscope,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface IpdChartsSectionProps {
  chartCategory: 'all' | 'department' | 'doctor'
  deptStats: any
  deptAdjrwLoading: boolean
  deptChartData: any[]
  deptChartSortedByAdjrw: any[]
  deptChartSortedByVisits: any[]
  deptChartSortedByCmi: any[]
  deptMonthlyTrendData: any[]
  doctorAdmitSummaryData: any[]
  doctorDcSummaryData: any[]
}

export default function IpdChartsSection({
  chartCategory,
  deptStats,
  deptAdjrwLoading,
  deptChartData,
  deptChartSortedByAdjrw,
  deptChartSortedByVisits,
  deptChartSortedByCmi,
  deptMonthlyTrendData,
  doctorAdmitSummaryData,
  doctorDcSummaryData,
}: IpdChartsSectionProps) {
  return (
    <>
      {/* SECTION 1: 🏢 กราฟวิเคราะห์ผู้ป่วยในแยกรายแผนกการรักษา (Department Charts) */}
      {(chartCategory === 'all' || chartCategory === 'department') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="rcm-chart-section-title">
            <h3>
              <Building2 size={20} style={{ color: '#047857' }} />
              <span>🏢 กราฟสรุปภาพรวมแยกรายแผนกการรักษา</span>
            </h3>
            <span className="rcm-chart-section-badge">
              {deptStats?.monthCount ? `${deptStats.monthCount} เดือน` : 'ข้อมูลรายแผนก'}
            </span>
          </div>

          {deptAdjrwLoading ? (
            <div className="rcm-chart-card" style={{ textAlign: 'center', padding: '3rem' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: '#059669' }} />
              <p style={{ color: '#334155', fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>
                กำลังโหลดข้อมูลกราฟแผนกจากฐานข้อมูล HOSxP...
              </p>
            </div>
          ) : deptChartData.length === 0 ? (
            <div className="rcm-chart-card" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
              ไม่พบข้อมูลรายแผนกสำหรับสร้างกราฟในช่วงเวลานี้
            </div>
          ) : (
            <>
              <div className="rcm-chart-grid-3">
                {/* Dept Chart 1: SumAdjRW by Department */}
                <div className="rcm-chart-card">
                  <div className="rcm-chart-header">
                    <div>
                      <h4 className="rcm-chart-title">ผลรวม SumAdjRW แยกตามแผนก</h4>
                      <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                        เรียงตามผลรวมค่าน้ำหนักสัมพัทธ์ (ความยากโรค)
                      </p>
                    </div>
                  </div>
                  <div style={{ height: '340px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={deptChartSortedByAdjrw}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: '#0f172a' }} />
                        <Tooltip
                          formatter={(val: any) => [
                            `${Number(val).toFixed(4)} (${deptStats?.grandTotal ? ((Number(val) / deptStats.grandTotal) * 100).toFixed(1) : 0}%)`,
                            'SumAdjRW',
                          ]}
                        />
                        <Bar dataKey="adjrw" radius={[0, 4, 4, 0]}>
                          {deptChartSortedByAdjrw.map((entry) => (
                            <Cell key={`dept-adjrw-${entry.key}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Dept Chart 2: Visits by Department */}
                <div className="rcm-chart-card">
                  <div className="rcm-chart-header">
                    <div>
                      <h4 className="rcm-chart-title">จำนวนผู้ป่วยใน (ครั้ง/Admit) แยกตามแผนก</h4>
                      <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                        เรียงตามจำนวนครั้งที่รับไว้รักษา
                      </p>
                    </div>
                  </div>
                  <div style={{ height: '340px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={deptChartSortedByVisits}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: '#0f172a' }} />
                        <Tooltip
                          formatter={(val: any) => [
                            `${Number(val).toLocaleString()} ครั้ง (${deptStats?.totalVisits ? ((Number(val) / deptStats.totalVisits) * 100).toFixed(1) : 0}%)`,
                            'จำนวนครั้ง Admit',
                          ]}
                        />
                        <Bar dataKey="visits" radius={[0, 4, 4, 0]}>
                          {deptChartSortedByVisits.map((entry) => (
                            <Cell key={`dept-visits-${entry.key}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Dept Chart 3: CMI by Department */}
                <div className="rcm-chart-card">
                  <div className="rcm-chart-header">
                    <div>
                      <h4 className="rcm-chart-title">ค่าเฉลี่ยความยากโรค (CMI) แยกตามแผนก</h4>
                      <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                        Case Mix Index = SumAdjRW / ครั้ง • เรียงจากมากไปน้อย
                      </p>
                    </div>
                  </div>
                  <div style={{ height: '340px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={deptChartSortedByCmi}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: '#0f172a' }} />
                        <Tooltip formatter={(val: any) => [`${Number(val).toFixed(4)}`, 'CMI']} />
                        <Bar dataKey="cmi" radius={[0, 4, 4, 0]}>
                          {deptChartSortedByCmi.map((entry) => (
                            <Cell key={`dept-cmi-${entry.key}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Monthly Trend Chart */}
              {deptMonthlyTrendData.length > 0 && (
                <div className="rcm-chart-card">
                  <div className="rcm-chart-header">
                    <div>
                      <h4 className="rcm-chart-title" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <TrendingUp size={16} style={{ color: '#059669' }} />
                        <span>แนวโน้มผลรวม SumAdjRW รวมรายเดือน</span>
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                        การเปลี่ยนแปลงของ SumAdjRW ตลอด {deptMonthlyTrendData.length} เดือน
                      </p>
                    </div>
                  </div>
                  <div style={{ height: '280px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={deptMonthlyTrendData}
                        margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                      >
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#0f172a' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip
                          formatter={(val: any, _name: any, item: any) => [
                            `${Number(val).toFixed(4)} (ผู้ป่วย: ${(item?.payload?.visits ?? 0).toLocaleString()} ครั้ง, CMI: ${(item?.payload?.cmi ?? 0).toFixed(4)})`,
                            'SumAdjRW ประจำเดือน',
                          ]}
                        />
                        <Bar dataKey="adjrw" fill="#059669" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* SECTION 2: 👨‍⚕️ กราฟวิเคราะห์ผู้ป่วยในแยกตามแพทย์ผู้รักษา (Physician Charts) */}
      {(chartCategory === 'all' || chartCategory === 'doctor') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: chartCategory === 'all' ? '0.5rem' : '0' }}>
          <div className="rcm-chart-section-title">
            <h3>
              <Stethoscope size={20} style={{ color: '#2563eb' }} />
              <span>👨‍⚕️ กราฟสรุปภาพรวมแยกตามแพทย์ผู้ให้การรักษา</span>
            </h3>
            <span className="rcm-chart-section-badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
              {doctorAdmitSummaryData.length} ท่าน
            </span>
          </div>

          <div className="rcm-chart-grid-3">
            {/* Chart 1: Cases by Admit Doctor */}
            <div className="rcm-chart-card">
              <div className="rcm-chart-header">
                <div>
                  <h4 className="rcm-chart-title">จำนวนผู้ป่วยแยกตามแพทย์ Admit</h4>
                  <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                    เรียงตามจำนวนผู้ป่วยที่รับไว้รักษา (ราย)
                  </p>
                </div>
              </div>
              <div style={{ height: '320px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={doctorAdmitSummaryData.slice(0, 10).map((d) => ({ name: d.doctor, cases: d.cases }))}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(val: any) => [`${val} ราย`, 'ผู้ป่วย Admit']} />
                    <Bar dataKey="cases" fill="#059669" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: SumAdjRW by Admit Doctor */}
            <div className="rcm-chart-card">
              <div className="rcm-chart-header">
                <div>
                  <h4 className="rcm-chart-title">ผลรวมค่าความยากโรค SumAdjRW แยกตามแพทย์ Admit</h4>
                  <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                    ผลรวมค่าน้ำหนักสัมพัทธ์ (SumAdjRW)
                  </p>
                </div>
              </div>
              <div style={{ height: '320px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={doctorAdmitSummaryData.slice(0, 10).map((d) => ({ name: d.doctor, sumAdjrw: Number(d.sumAdjrw.toFixed(4)) }))}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(val: any) => [`${val}`, 'SumAdjRW']} />
                    <Bar dataKey="sumAdjrw" fill="#0d9488" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: CMI by D/C Doctor */}
            <div className="rcm-chart-card">
              <div className="rcm-chart-header">
                <div>
                  <h4 className="rcm-chart-title">ผลรวมค่าความยากโรค Cmi แยกตามแพทย์ D/C</h4>
                  <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.2rem 0 0 0', fontWeight: 500 }}>
                    ค่าเฉลี่ยความซับซ้อนโรค (CMI = SumAdjRW / Cases)
                  </p>
                </div>
              </div>
              <div style={{ height: '320px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={doctorDcSummaryData
                      .filter((d) => d.cases > 0)
                      .slice(0, 10)
                      .map((d) => ({
                        name: d.doctor,
                        cmi: Number((d.sumAdjrw / d.cases).toFixed(4)),
                      }))}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(val: any) => [`${val}`, 'CMI (แพทย์ D/C)']} />
                    <Bar dataKey="cmi" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
