'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SkeletonCard, SkeletonTable } from '@/components/common/Skeleton'
import { usePolling } from '@/hooks/usePolling'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Clock,
  RefreshCw,
  Tv,
} from 'lucide-react'
import './page.css'

interface Patient {
  hn: string
  vn: string
  ptname: string
  age: number
  bedno: string | null
  enter_time: string
  er_list: string | null
  er_emergency_level_name: string
  er_emergency_level_id: number | string
  observe: string | null
  dch_type_name: string | null
  wardname: string | null
  hosname: string | null
  hosname_dest: string | null
}

interface ErrorPatient {
  vstdate: string
  hn: string
  vn: string
  status_name: string | null
  nname: string | null
}

interface ERData {
  activePatients: Patient[]
  errorStatusList?: {
    total: number
    list: ErrorPatient[]
  }
  summary: {
    totalActive: number
    critical: number
    emergency: number
    urgency: number
    semiUrgency: number
    nonUrgency: number
  }
  stats: {
    ptTypes: { v: number; name: string }[]
    emergencyLevels: { v: number; er_emergency_level_name: string }[]
    dischargeTypes: { v: number; name: string }[]
  }
}

function getLevelMeta(levelId: number, fallbackName: string): { label: string; tone: string } {
  switch (levelId) {
    case 1:
      return { label: 'กู้ชีพทันที (Resuscitate)', tone: 'level-1' }
    case 2:
      return { label: 'ฉุกเฉินวิกฤต (Emergency)', tone: 'level-2' }
    case 3:
      return { label: 'ด่วนมาก (Urgency)', tone: 'level-3' }
    case 4:
      return { label: 'ด่วน (Semi Urgency)', tone: 'level-4' }
    case 5:
      return { label: 'ทั่วไป (Non Urgency)', tone: 'level-5' }
    default:
      return { label: fallbackName || 'ทั่วไป', tone: 'level-5' }
  }
}

export default function ERInStatusClient() {
  const [data, setData] = useState<ERData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch function
  const fetchStatus = async () => {
    try {
      setIsRefreshing(true)
      const res = await fetch('/api/er/status')
      const result = await res.json()
      if (res.ok) {
        setData(result)
        setError('')
      } else {
        setError(result.error || 'เกิดข้อผิดพลาดในการดึงข้อมูล')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อฐานข้อมูลห้องฉุกเฉินได้')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  // Polling with Page Visibility API (S1)
  const { lastUpdated, refresh } = usePolling(fetchStatus, 15000)

  if (loading && !data) {
    return (
      <div className="erPage">
        <div className="erContainer">
          <div className="erTopBar">
            <Link href="/service" className="erBackLink">
              <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>กลับสู่ระบบงานภายใน</span>
            </Link>
          </div>
          <div className="erSummaryGrid">
            <SkeletonCard height="104px" />
            <SkeletonCard height="104px" />
            <SkeletonCard height="104px" />
            <SkeletonCard height="104px" />
            <SkeletonCard height="104px" />
          </div>
          <div className="erPanel erPanelPadded">
            <SkeletonTable rows={6} cols={7} />
          </div>
        </div>
      </div>
    )
  }

  const hasCritical = (data?.summary.critical || 0) > 0
  const activePatients = data?.activePatients || []
  const ptTypes = data?.stats.ptTypes || []
  const emergencyLevels = data?.stats.emergencyLevels || []
  const dischargeTypes = data?.stats.dischargeTypes || []

  const maxPtType = Math.max(...ptTypes.map((item) => item.v), 1)
  const maxEmergencyLevel = Math.max(...emergencyLevels.map((item) => item.v), 1)
  const maxDischargeType = Math.max(...dischargeTypes.map((item) => item.v), 1)

  return (
    <div className="erPage">
      <div className="erContainer">
        {/* Top utility bar */}
        <div className="erTopBar">
          <Link href="/service" className="erBackLink">
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>กลับสู่ระบบงานภายใน</span>
          </Link>

          {/* Last Updated Status Indicator (S2) */}
          <span className="erLastUpdated">
            <span className="erLiveDot" aria-hidden="true" />
            <Clock size={14} strokeWidth={1.5} aria-hidden="true" />
            <span>
              อัปเดตล่าสุด:{' '}
              <strong className="erTabular">
                {lastUpdated ? lastUpdated.toLocaleTimeString('th-TH') : 'กำลังโหลด...'}
              </strong>
            </span>
          </span>
        </div>

        {/* Page Header */}
        <header className="erHeader">
          <div className="erTitleBlock">
            <h1 className="erTitle">ระบบแสดงผลสถานะห้องฉุกเฉิน (ER Live Status)</h1>
            <p className="erSubtitle">
              ข้อมูลอัปเดตเรียลไทม์เพื่อบริหารจัดการผู้ป่วย ณ จุดบริการฉุกเฉิน
            </p>
          </div>
          <div className="erHeaderActions">
            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing}
              className="erBtn"
              aria-label="รีเฟรชข้อมูล"
              title="รีเฟรชข้อมูลทันที"
            >
              <RefreshCw
                size={15}
                strokeWidth={1.5}
                className={isRefreshing ? 'erSpin' : ''}
                aria-hidden="true"
              />
              <span>{isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}</span>
            </button>
            <Link
              href="/service/er-in-status/tv-mode"
              target="_blank"
              rel="noopener noreferrer"
              className="erBtn erBtnPrimary"
            >
              <Tv size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>เปิดจอโหมดทีวี (TV Mode)</span>
            </Link>
          </div>
        </header>

        {/* Connection / API Error Banner */}
        {error && (
          <div className="erErrorBanner" role="alert">
            <AlertCircle size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Critical Alert Warning Banner */}
        {hasCritical && (
          <section className="erAlertBanner" role="status" aria-live="polite">
            <div className="erAlertIconWrap" aria-hidden="true">
              <AlertTriangle size={20} strokeWidth={1.75} />
            </div>
            <div className="erAlertContent">
              <p className="erAlertTitle">
                คำเตือน: ขณะนี้มีผู้ป่วยวิกฤตฉุกเฉินกู้ชีพ (Resuscitate Red Level) จำนวน{' '}
                <span className="erTabular">{data?.summary.critical}</span> ราย กำลังรับการช่วยเหลือ
              </p>
              <p className="erAlertDesc">
                ทีมแพทย์และพยาบาลกำลังระดมกำลังให้การกู้ชีพอย่างเร่งด่วนที่สุด
              </p>
            </div>
          </section>
        )}

        {/* Real-time Summary Cards */}
        <section className="erSummaryGrid" aria-label="สรุปจำนวนผู้ป่วยห้องฉุกเฉิน">
          <div className="erStatCard erStatTotal">
            <div className="erStatHeader">
              <span className="erStatLabel">ผู้ป่วยในห้องฉุกเฉินทั้งหมด</span>
            </div>
            <div className="erStatValue erTabular">{data?.summary.totalActive ?? 0}</div>
          </div>

          <div className="erStatCard erStatCritical">
            <div className="erStatHeader">
              <span className="erTriageDot erDotCritical" aria-hidden="true" />
              <span className="erStatLabel">กู้ชีพทันที (Resuscitate)</span>
            </div>
            <div className="erStatValue erTabular">{data?.summary.critical ?? 0}</div>
          </div>

          <div className="erStatCard erStatEmergency">
            <div className="erStatHeader">
              <span className="erTriageDot erDotEmergency" aria-hidden="true" />
              <span className="erStatLabel">ฉุกเฉินวิกฤต (Emergency)</span>
            </div>
            <div className="erStatValue erTabular">{data?.summary.emergency ?? 0}</div>
          </div>

          <div className="erStatCard erStatUrgency">
            <div className="erStatHeader">
              <span className="erTriageDot erDotUrgency" aria-hidden="true" />
              <span className="erStatLabel">ฉุกเฉินเร่งด่วน (Urgency)</span>
            </div>
            <div className="erStatValue erTabular">{data?.summary.urgency ?? 0}</div>
          </div>

          <div className="erStatCard erStatSemi">
            <div className="erStatHeader">
              <span className="erTriageDot erDotSemi" aria-hidden="true" />
              <span className="erStatLabel">ฉุกเฉินไม่รุนแรง (Semi Urgency)</span>
            </div>
            <div className="erStatValue erTabular">{data?.summary.semiUrgency ?? 0}</div>
          </div>
        </section>

        {/* Active Patients Live Queue */}
        <section className="erPanel">
          <div className="erPanelHeader">
            <h2 className="erPanelTitle">รายชื่อผู้ป่วยที่กำลังตรวจรักษาในห้องฉุกเฉิน</h2>
            <span className="erCountMeta erTabular">{activePatients.length} ราย</span>
          </div>

          {activePatients.length === 0 ? (
            <div className="erEmptyState">
              <p>ในขณะนี้ไม่มีผู้ป่วยที่ค้างรอรับการรักษาในห้องฉุกเฉิน</p>
            </div>
          ) : (
            <div className="erTableScroll">
              <table className="erTable">
                <thead>
                  <tr>
                    <th className="colTime">เวลาที่เข้า</th>
                    <th className="colHn">HN</th>
                    <th className="colName">ชื่อผู้ป่วย</th>
                    <th className="colAge">อายุ</th>
                    <th className="colBed">เตียงสังเกตอาการ</th>
                    <th className="colLevel">ระดับความเร่งด่วน</th>
                    <th className="colObserve">เตียงสังเกต (Observe)</th>
                  </tr>
                </thead>
                <tbody>
                  {activePatients.map((patient: Patient, idx) => {
                    const levelId = Number(patient.er_emergency_level_id)
                    const { label, tone } = getLevelMeta(
                      levelId,
                      patient.er_emergency_level_name
                    )

                    return (
                      <tr key={patient.vn || idx} className={`erRow ${tone}`}>
                        <td data-label="เวลาเข้า" className="colTime erCellMono">
                          {patient.enter_time ? patient.enter_time.substring(0, 5) : '-'}
                        </td>
                        <td data-label="HN" className="colHn erCellMono">
                          {patient.hn}
                        </td>
                        <td data-label="ชื่อ-สกุล" className="colName erCellName">
                          {patient.ptname}
                        </td>
                        <td data-label="อายุ" className="colAge erTabular">
                          {patient.age} ปี
                        </td>
                        <td data-label="เตียง" className="colBed">
                          {patient.bedno ? (
                            <span className="erBedTag">เตียง {patient.bedno}</span>
                          ) : (
                            <span className="erMutedDash">-</span>
                          )}
                        </td>
                        <td data-label="ระดับความรุนแรง" className="colLevel">
                          <span className={`erSeverityBadge pill-${levelId}`}>
                            <span className="erBadgeDot" aria-hidden="true" />
                            <span>{label}</span>
                          </span>
                        </td>
                        <td data-label="สถานะ Observe" className="colObserve">
                          {patient.observe === 'Y' ? (
                            <span className="erObserveBadge">Observe ON</span>
                          ) : (
                            <span className="erMutedDash">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Error Status Warning & Table Section */}
        {data?.errorStatusList && (
          <section className="erPanel erErrorPanel">
            <div className="erErrorPanelHeader">
              <div className="erErrorPanelTitleGroup">
                <AlertTriangle size={18} strokeWidth={1.75} aria-hidden="true" />
                <h2 className="erErrorPanelTitle">
                  แสดงสถานะไม่ถูกต้อง จำนวน{' '}
                  <span className="erTabular">{data.errorStatusList.total}</span> ราย
                </h2>
              </div>
            </div>

            {data.errorStatusList.total > 0 && (
              <div className="erTableScroll">
                <table className="erTable erErrorTable">
                  <thead>
                    <tr>
                      <th className="colErrDate">วันที่มารับบริการ</th>
                      <th className="colErrHn">HN</th>
                      <th className="colErrStatus">สถานะ</th>
                      <th className="colErrStaff">พยาบาลเวร / เจ้าหน้าที่เวร</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.errorStatusList.list.map((item, idx) => {
                      const vstDateObj = item.vstdate ? new Date(item.vstdate) : null
                      const formattedDate = vstDateObj
                        ? vstDateObj.toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '-'

                      return (
                        <tr key={item.vn || idx}>
                          <td data-label="วันที่มารับบริการ" className="colErrDate erTabular">
                            {formattedDate}
                          </td>
                          <td data-label="HN" className="colErrHn erCellMono">
                            {item.hn}
                          </td>
                          <td data-label="สถานะ" className="colErrStatus">
                            <span className="erErrorStatusBadge">
                              {item.status_name || '-'}
                            </span>
                          </td>
                          <td data-label="พยาบาลเวร / เจ้าหน้าที่เวร" className="colErrStaff">
                            {item.nname || '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Monthly statistics */}
        <section className="erMonthlyStatsGrid" aria-label="สถิติห้องฉุกเฉินประจำเดือน">
          {/* 1. Monthly Pt Types */}
          <div className="erStatsCard">
            <div className="erStatsCardHeader">
              <h3>ประเภทผู้ป่วย (ประจำเดือนนี้)</h3>
            </div>
            {ptTypes.length === 0 ? (
              <p className="erNoStatsText">ไม่มีข้อมูลในเดือนนี้</p>
            ) : (
              <ul className="erStatsList">
                {ptTypes.map((pt, idx) => (
                  <li key={idx} className="erStatsRow">
                    <div className="erStatsRowTop">
                      <span className="erStatsName">{pt.name || 'ไม่ระบุประเภท'}</span>
                      <span className="erStatsCount erTabular">{pt.v} ราย</span>
                    </div>
                    <div className="erStatsTrack" aria-hidden="true">
                      <div
                        className="erStatsFill erFillAccent"
                        style={{ width: `${Math.max(4, (pt.v / maxPtType) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 2. Monthly Emergency Levels */}
          <div className="erStatsCard">
            <div className="erStatsCardHeader">
              <h3>สัดส่วนความรุนแรงผู้ป่วย (ประจำเดือนนี้)</h3>
            </div>
            {emergencyLevels.length === 0 ? (
              <p className="erNoStatsText">ไม่มีข้อมูลในเดือนนี้</p>
            ) : (
              <ul className="erStatsList">
                {emergencyLevels.map((el, idx) => (
                  <li key={idx} className="erStatsRow">
                    <div className="erStatsRowTop">
                      <span className="erStatsName">
                        {el.er_emergency_level_name || 'ไม่ระบุความรุนแรง'}
                      </span>
                      <span className="erStatsCount erTabular">{el.v} ราย</span>
                    </div>
                    <div className="erStatsTrack" aria-hidden="true">
                      <div
                        className="erStatsFill erFillDanger"
                        style={{
                          width: `${Math.max(4, (el.v / maxEmergencyLevel) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 3. Monthly Discharge Types */}
          <div className="erStatsCard">
            <div className="erStatsCardHeader">
              <h3>สถานะหลังออกจากห้องฉุกเฉิน (ประจำเดือนนี้)</h3>
            </div>
            {dischargeTypes.length === 0 ? (
              <p className="erNoStatsText">ไม่มีข้อมูลในเดือนนี้</p>
            ) : (
              <ul className="erStatsList">
                {dischargeTypes.map((dt, idx) => (
                  <li key={idx} className="erStatsRow">
                    <div className="erStatsRowTop">
                      <span className="erStatsName">{dt.name || 'ไม่ระบุการจำหน่าย'}</span>
                      <span className="erStatsCount erTabular">{dt.v} ราย</span>
                    </div>
                    <div className="erStatsTrack" aria-hidden="true">
                      <div
                        className="erStatsFill erFillInfo"
                        style={{
                          width: `${Math.max(4, (dt.v / maxDischargeType) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
