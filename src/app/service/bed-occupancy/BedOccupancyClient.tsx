'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Bed,
  RefreshCw,
  ArrowLeft,
  Activity,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import Link from 'next/link'
import './page.css'

interface SpecialtyBreakdown {
  name: string
  count: number
}

interface IcnpClassification {
  name: string
  count: number
}

interface DeliveryRoomDetail {
  beds: number
  occupied: number
  remaining: number
  usagePercent: number
}

interface WardExtra {
  onVentilator?: number
  ciCount?: number
  vipPersons?: number
  preDelivery?: DeliveryRoomDetail
  postDelivery?: DeliveryRoomDetail
}

interface WardOccupancy {
  id: string
  name: string
  totalBeds: number
  occupiedBeds: number
  remainingBeds: number
  usagePercent: number
  occupancyRate: number | null
  admitToday: number
  dischargeToday: number
  specialties: SpecialtyBreakdown[]
  icnpClassifications: IcnpClassification[]
  unclassifiedBeds: string[]
  extra?: WardExtra
}

interface BedOccupancyData {
  opdPatientCount: number
  totalBeds: number
  totalOccupied: number
  totalRemaining: number
  totalUsagePercent: number
  occupancyRate: number
  occupancyFormula: {
    totalAdmDays: number
    daysInMonth: number
  }
  totalAdmitToday: number
  totalDischargeToday: number
  wards: WardOccupancy[]
  updatedAt: string
}

/** Format number with 2 decimal places */
function fmt2(n: number): string {
  return n.toFixed(2)
}

/** Get color class based on usage percentage */
function getUsageColor(percent: number): string {
  if (percent >= 90) return 'usage-critical'
  if (percent >= 70) return 'usage-warning'
  return 'usage-normal'
}

/** Get color styling for ICNP classification level matching PHP colors */
function getIcnpBadgeClass(name: string): string {
  if (name.includes('Critical') && !name.includes('Semi')) return 'icnp-critical'
  if (name.includes('Semi-critical')) return 'icnp-semicritical'
  if (name.includes('Moderate')) return 'icnp-moderate'
  if (name.includes('Convalescent')) return 'icnp-convalescent'
  return 'icnp-default'
}

export default function BedOccupancyClient() {
  const [data, setData] = useState<BedOccupancyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  const fetchData = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true)
    try {
      const res = await fetch('/api/service/bed-occupancy', { cache: 'no-store' })
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('Failed to fetch bed occupancy data:', err)
    } finally {
      setLoading(false)
      if (manual) {
        setTimeout(() => setIsRefreshing(false), 500)
      }
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => {
      fetchData()
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchData])

  return (
    <div className="bedOccPage">
      <div className="bedOccContainer">
        {/* Navigation */}
        <div style={{ marginBottom: '1rem' }}>
          <Link
            href="/service"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: '#64748b',
              fontSize: '0.9rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <ArrowLeft size={16} /> กลับหน้ารวมบริการ
          </Link>
        </div>

        {/* Header Card */}
        <div className="bedOccHeaderCard">
          <div className="bedOccTitleWrapper">
            <div className="bedOccIconBadge">
              <Bed size={26} />
            </div>
            <div className="bedOccTitleSection">
              <h1>อัตราการครองเตียง</h1>
              <p className="bedOccSubtitle">
                ติดตามอัตราการใช้เตียงผู้ป่วยในแต่ละหอผู้ป่วยแบบเรียลไทม์ โรงพยาบาลเถิน
              </p>
            </div>
          </div>

          <div className="bedOccControls">
            <div className="lastUpdateText" suppressHydrationWarning>
              อัปเดตล่าสุด:{' '}
              {lastUpdated.toLocaleTimeString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}{' '}
              น.
            </div>
            <button
              className={`refreshBtn ${isRefreshing ? 'spinning' : ''}`}
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={16} />
              <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="emptyState">
            <RefreshCw size={40} className="spinIcon" />
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Stat Cards */}
            <div className="statsGrid">
              <div className="statCard">
                <div className="statCard__header">
                  <span className="statCard__title">เตียงรวม</span>
                  <Bed size={16} color="#6366f1" />
                </div>
                <div className="statCard__value">
                  {data.totalBeds}
                  <span className="statCard__unit">เตียง</span>
                </div>
              </div>

              <div className="statCard">
                <div className="statCard__header">
                  <span className="statCard__title">ใช้</span>
                  <Activity size={16} color="#f43f5e" />
                </div>
                <div className="statCard__value">
                  {data.totalOccupied}
                  <span className="statCard__unit">เตียง</span>
                </div>
              </div>

              <div className="statCard">
                <div className="statCard__header">
                  <span className="statCard__title">เหลือ</span>
                  <Bed size={16} color="#10b981" />
                </div>
                <div className="statCard__value">
                  {data.totalRemaining}
                  <span className="statCard__unit">เตียง</span>
                </div>
              </div>

              <div className="statCard">
                <div className="statCard__header">
                  <span className="statCard__title">%ใช้เตียง</span>
                  <TrendingUp size={16} color="#f59e0b" />
                </div>
                <div className={`statCard__value ${getUsageColor(data.totalUsagePercent)}`}>
                  {fmt2(data.totalUsagePercent)}
                  <span className="statCard__unit">%</span>
                </div>
              </div>

              <div className="statCard statCard--highlight">
                <div className="statCard__header">
                  <span className="statCard__title">อัตราครองเตียง</span>
                  <TrendingUp size={16} color="#0d9488" />
                </div>
                <div className="statCard__value">
                  {fmt2(data.occupancyRate)}
                  <span className="statCard__unit">%</span>
                </div>
              </div>

              <div className="statCard">
                <div className="statCard__header">
                  <span className="statCard__title">OPD วันนี้</span>
                  <Users size={16} color="#8b5cf6" />
                </div>
                <div className="statCard__value">
                  {data.opdPatientCount.toLocaleString()}
                  <span className="statCard__unit">ราย</span>
                </div>
              </div>
            </div>

            {/* Occupancy Formula */}
            <div className="formulaCard">
              <span className="formulaLabel">สูตรอัตราครองเตียง =</span>
              <span className="formulaContent">
                (รวมวันนอน{' '}
                <span className="formulaHighlight">
                  {data.occupancyFormula.totalAdmDays.toLocaleString()}
                </span>
                {' '}× 100) / ({data.totalBeds} × จำนวนวันของเดือน{' '}
                <span className="formulaHighlight">
                  {data.occupancyFormula.daysInMonth}
                </span>
                )
              </span>
            </div>

            {/* IPD Table */}
            <div className="tableWrapper">
              <table className="bedTable">
                <thead>
                  <tr>
                    <th>รายการ</th>
                    <th className="thRight">จำนวน</th>
                    <th className="thRight">ใช้</th>
                    <th className="thRight">เหลือ</th>
                    <th className="thRight">%ใช้</th>
                    <th className="thRight">อัตราครองเตียง</th>
                    <th className="thRight">Admit</th>
                    <th className="thRight">D/C</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Summary Row */}
                  <tr className="summaryRow">
                    <td className="tdBold">การใช้เตียงรวม</td>
                    <td className="tdRight">{data.totalBeds}</td>
                    <td className="tdRight">{data.totalOccupied}</td>
                    <td className="tdRight">{data.totalRemaining}</td>
                    <td className="tdRight">
                      <span className={`usagePill ${getUsageColor(data.totalUsagePercent)}`}>
                        {fmt2(data.totalUsagePercent)}
                      </span>
                    </td>
                    <td className="tdRight">
                      <span className="occupancyPill">
                        {fmt2(data.occupancyRate)}
                      </span>
                    </td>
                    <td className="tdRight">
                      <span className="admitBadge">
                        <ArrowUpRight size={12} />
                        {data.totalAdmitToday}
                      </span>
                    </td>
                    <td className="tdRight">
                      <span className="dischargeBadge">
                        <ArrowDownRight size={12} />
                        {data.totalDischargeToday}
                      </span>
                    </td>
                  </tr>

                  {/* Ward Rows */}
                  {data.wards.map((ward) => (
                    <React.Fragment key={ward.id}>
                      <tr className="wardRow">
                        <td className="tdIndent">{ward.name}</td>
                        <td className="tdRight">{ward.totalBeds}</td>
                        <td className="tdRight">
                          {ward.id === '04' && ward.extra?.vipPersons ? (
                            <span>
                              {ward.occupiedBeds} <span className="vipSubText">/ {ward.extra.vipPersons} คน</span>
                            </span>
                          ) : (
                            ward.occupiedBeds
                          )}
                        </td>
                        <td className="tdRight">{ward.remainingBeds}</td>
                        <td className="tdRight">
                          <span className={`usagePill ${getUsageColor(ward.usagePercent)}`}>
                            {fmt2(ward.usagePercent)}
                          </span>
                        </td>
                        <td className="tdRight">
                          {ward.occupancyRate !== null ? (
                            <span className="occupancyPill">{fmt2(ward.occupancyRate)}</span>
                          ) : '-'}
                        </td>
                        <td className="tdRight">{ward.admitToday || '-'}</td>
                        <td className="tdRight">{ward.dischargeToday || '-'}</td>
                      </tr>

                      {/* ICU extras: On Ventilator / CI */}
                      {ward.id === '05' && ward.extra && (
                        <>
                          <tr className="subRow">
                            <td className="tdIndent2">On Ventilator</td>
                            <td colSpan={7} className="tdRight">
                              {ward.extra.onVentilator ?? '-'}
                            </td>
                          </tr>
                          <tr className="subRow">
                            <td className="tdIndent2">CI</td>
                            <td colSpan={7} className="tdRight">
                              {ward.extra.ciCount ?? '-'}
                            </td>
                          </tr>
                        </>
                      )}

                      {/* VIP room note */}
                      {ward.id === '04' && (
                        <tr className="subRow">
                          <td colSpan={8} className="vipNote">
                            ** ห้องที่ใช้อาจไม่เท่ากับแผนก (เช่น แม่ลูกนอนห้องเดียวกัน) ห้อง/คน
                          </td>
                        </tr>
                      )}

                      {/* ห้องคลอด sub-rows */}
                      {ward.id === '02' && ward.extra?.preDelivery && ward.extra?.postDelivery && (
                        <>
                          <tr className="subRow">
                            <td className="tdIndent2">รอคลอด</td>
                            <td className="tdRight">{ward.extra.preDelivery.beds}</td>
                            <td className="tdRight">{ward.extra.preDelivery.occupied}</td>
                            <td className="tdRight">{ward.extra.preDelivery.remaining}</td>
                            <td className="tdRight">
                              <span className={`usagePill ${getUsageColor(ward.extra.preDelivery.usagePercent)}`}>
                                {fmt2(ward.extra.preDelivery.usagePercent)}
                              </span>
                            </td>
                            <td className="tdRight">&nbsp;</td>
                            <td className="tdRight">&nbsp;</td>
                            <td className="tdRight">&nbsp;</td>
                          </tr>
                          <tr className="subRow">
                            <td className="tdIndent2">หลังคลอด</td>
                            <td className="tdRight">{ward.extra.postDelivery.beds}</td>
                            <td className="tdRight">{ward.extra.postDelivery.occupied}</td>
                            <td className="tdRight">{ward.extra.postDelivery.remaining}</td>
                            <td className="tdRight">
                              <span className={`usagePill ${getUsageColor(ward.extra.postDelivery.usagePercent)}`}>
                                {fmt2(ward.extra.postDelivery.usagePercent)}
                              </span>
                            </td>
                            <td className="tdRight">&nbsp;</td>
                            <td className="tdRight">&nbsp;</td>
                            <td className="tdRight">&nbsp;</td>
                          </tr>
                        </>
                      )}

                      {/* Detail sub-section: Specialties + ICNP + Unclassified Beds */}
                      {(ward.specialties.length > 0 || ward.icnpClassifications.length > 0 || ward.unclassifiedBeds.length > 0) && (
                        <tr className="wardDetailsRow">
                          <td colSpan={8}>
                            <div className="wardDetailsGrid">
                              {/* Left: Specialty Breakdown */}
                              {ward.specialties.length > 0 && (
                                <div className="detailBox specialtyBox">
                                  <div className="detailBox__title">แผนกการรักษา (Specialty)</div>
                                  <table className="miniDetailTable">
                                    <tbody>
                                      {ward.specialties.map((spec, sIdx) => (
                                        <tr key={`${ward.id}-spec-${sIdx}`}>
                                          <td className="miniDetailName">{spec.name}</td>
                                          <td className="miniDetailCount">{spec.count}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Middle: ICNP Classification */}
                              {ward.icnpClassifications.length > 0 && (
                                <div className="detailBox icnpBox">
                                  <div className="detailBox__title">ระดับความรุนแรงของอาการ (ICNP)</div>
                                  <table className="miniDetailTable">
                                    <tbody>
                                      {ward.icnpClassifications.map((icnp, iIdx) => (
                                        <tr key={`${ward.id}-icnp-${iIdx}`}>
                                          <td className="miniDetailName">
                                            <span className={`icnpBadge ${getIcnpBadgeClass(icnp.name)}`}>
                                              {icnp.name}
                                            </span>
                                          </td>
                                          <td className="miniDetailCount">{icnp.count}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Right: Unclassified Beds */}
                              {ward.unclassifiedBeds.length > 0 && (
                                <div className="detailBox unclassifiedBox">
                                  <div className="detailBox__title unclassifiedTitle">
                                    เตียงที่ยังไม่ระบุอาการแรกรับ ({ward.unclassifiedBeds.length})
                                  </div>
                                  <div className="unclassifiedBedTags">
                                    {ward.unclassifiedBeds.map((bed, bIdx) => (
                                      <span key={`${ward.id}-bed-${bIdx}`} className="bedTag">
                                        {bed}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
