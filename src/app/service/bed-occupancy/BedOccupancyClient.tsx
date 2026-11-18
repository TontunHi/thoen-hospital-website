'use client'

import React, { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { usePolling } from '@/hooks/usePolling'
import type { BedOccupancyData, WardOccupancy } from '@/lib/clinical/ipdWardService'
import './page.css'

type UsageTone = 'normal' | 'warning' | 'critical'
type IcnpTone = 'critical' | 'semicritical' | 'moderate' | 'convalescent' | 'default'
type WardFilterMode = 'all' | 'unclassified'

function fmt2(value: number): string {
  return value.toFixed(2)
}

function getUsageMeta(percent: number): { tone: UsageTone; label: string } {
  if (percent >= 90) return { tone: 'critical', label: 'หนาแน่น' }
  if (percent >= 70) return { tone: 'warning', label: 'เฝ้าระวัง' }
  return { tone: 'normal', label: 'ปกติ' }
}

function getIcnpTone(name: string): IcnpTone {
  if (name.includes('Critical') && !name.includes('Semi')) return 'critical'
  if (name.includes('Semi-critical')) return 'semicritical'
  if (name.includes('Moderate')) return 'moderate'
  if (name.includes('Convalescent')) return 'convalescent'
  return 'default'
}

function UsageStatusBadge({ percent }: { percent: number }) {
  const { tone, label } = getUsageMeta(percent)
  return (
    <span className={`bedStatusPill bedStatusPill--${tone}`}>
      {tone === 'critical' && <AlertCircle size={16} strokeWidth={1.5} aria-hidden="true" />}
      {tone === 'warning' && <AlertTriangle size={16} strokeWidth={1.5} aria-hidden="true" />}
      {tone === 'normal' && <CheckCircle2 size={16} strokeWidth={1.5} aria-hidden="true" />}
      <span className="bedTabular">{fmt2(percent)}%</span>
      <span className="bedStatusPill__label">{label}</span>
    </span>
  )
}

function BedCapacityBar({
  percent,
  tone,
  label,
}: {
  percent: number
  tone: UsageTone
  label: string
}) {
  const clamped = Math.max(0, Math.min(percent, 100))
  return (
    <div
      className="bedMeterTrack"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`bedMeterFill bedMeterFill--${tone}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="bedOccPage">
      <div className="bedOccContainer">
        <div className="bedTopBar">
          <Link href="/service" className="bedBackLink">
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>กลับสู่ระบบงานภายใน</span>
          </Link>
        </div>

        <header className="bedHeader">
          <div className="bedTitleBlock">
            <h1 className="bedTitle">อัตราการครองเตียงผู้ป่วยใน</h1>
            <p className="bedSubtitle">กำลังโหลดข้อมูลเตียงผู้ป่วยในจากหอผู้ป่วย</p>
          </div>
        </header>

        <div className="bedOverviewGrid" aria-busy="true" aria-label="กำลังโหลดข้อมูล">
          <div className="bedCard bedHeroCard bedSkeletonBlock bedSkeletonBlock--hero" />
          <div className="bedCard bedSkeletonBlock" />
          <div className="bedCard bedSkeletonBlock" />
          <div className="bedCard bedSkeletonBlock" />
        </div>

        <div className="bedCard bedSkeletonTable">
          <div className="bedSkeletonLine bedSkeletonLine--title" />
          <div className="bedSkeletonLine" />
          <div className="bedSkeletonLine" />
          <div className="bedSkeletonLine" />
        </div>
      </div>
    </div>
  )
}

export default function BedOccupancyClient() {
  const [data, setData] = useState<BedOccupancyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filterMode, setFilterMode] = useState<WardFilterMode>('all')
  const [collapsedWards, setCollapsedWards] = useState<Record<string, boolean>>({})

  const fetchData = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const res = await fetch('/api/service/bed-occupancy', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok && json.success && json.data) {
        setData(json.data)
        setError('')
      } else {
        setError(json.error || 'เกิดข้อผิดพลาดในการดึงข้อมูลอัตราการครองเตียง')
      }
    } catch {
      setError('ไม่สามารถเชื่อมต่อระบบข้อมูลหอผู้ป่วยได้ชั่วคราว')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  const { lastUpdated, refresh } = usePolling(fetchData, 30000)

  const totalWardBeds = useMemo(
    () => (data ? data.wards.reduce((sum, w) => sum + w.totalBeds, 0) : 0),
    [data]
  )

  const totalUnclassifiedBeds = useMemo(
    () => (data ? data.wards.reduce((sum, w) => sum + w.unclassifiedBeds.length, 0) : 0),
    [data]
  )

  const wardsWithUnclassifiedCount = useMemo(
    () => (data ? data.wards.filter((w) => w.unclassifiedBeds.length > 0).length : 0),
    [data]
  )

  const visibleWards = useMemo(() => {
    if (!data) return []
    if (filterMode === 'unclassified') {
      return data.wards.filter((w) => w.unclassifiedBeds.length > 0)
    }
    return data.wards
  }, [data, filterMode])

  const allCollapsed = useMemo(() => {
    if (visibleWards.length === 0) return false
    return visibleWards.every((w) => Boolean(collapsedWards[w.id]))
  }, [visibleWards, collapsedWards])

  const toggleWard = (wardId: string) => {
    setCollapsedWards((prev) => ({ ...prev, [wardId]: !prev[wardId] }))
  }

  const toggleAllWards = () => {
    const nextCollapsed = !allCollapsed
    const updated: Record<string, boolean> = {}
    visibleWards.forEach((w) => {
      updated[w.id] = nextCollapsed
    })
    setCollapsedWards((prev) => ({ ...prev, ...updated }))
  }

  const handleJumpToWard = (wardId: string) => {
    setFilterMode('all')
    setCollapsedWards((prev) => ({ ...prev, [wardId]: false }))
    const el = document.getElementById(`ward-card-${wardId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  if (loading && !data) {
    return <LoadingSkeleton />
  }

  const heroTone = data ? getUsageMeta(data.totalUsagePercent).tone : 'normal'

  return (
    <div className="bedOccPage">
      <div className="bedOccContainer">
        {/* Top Utility Bar */}
        <div className="bedTopBar">
          <Link href="/service" className="bedBackLink">
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>กลับสู่ระบบงานภายใน</span>
          </Link>

          <div className="bedLiveStatus">
            <span className="bedLiveDot" aria-hidden="true" />
            <Clock size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>
              อัปเดตทุก 30 วินาที · ล่าสุด{' '}
              <strong className="bedTabular">
                {lastUpdated
                  ? `${lastUpdated.toLocaleTimeString('th-TH', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })} น.`
                  : 'กำลังโหลด...'}
              </strong>
            </span>
          </div>
        </div>

        {/* Page Header */}
        <header className="bedHeader">
          <div className="bedTitleBlock">
            <h1 className="bedTitle">อัตราการครองเตียงผู้ป่วยใน</h1>
            <p className="bedSubtitle">
              ติดตามจำนวนเตียงที่ใช้ เตียงว่าง อัตราครองเตียง และระดับความรุนแรง ICNP แยกตามหอผู้ป่วย
            </p>
          </div>

          <div className="bedHeaderActions">
            <button
              type="button"
              className="bedBtn bedBtnPrimary"
              onClick={refresh}
              disabled={isRefreshing}
              aria-label="รีเฟรชข้อมูล"
            >
              <RefreshCw
                size={16}
                strokeWidth={1.5}
                className={isRefreshing ? 'bedSpin' : ''}
                aria-hidden="true"
              />
              <span>{isRefreshing ? 'กำลังอัปเดต...' : 'รีเฟรชข้อมูล'}</span>
            </button>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="bedAlert" role="alert">
            <div className="bedAlertContent">
              <AlertCircle size={20} strokeWidth={1.5} aria-hidden="true" />
              <span>{error}</span>
            </div>
            <button type="button" className="bedBtn bedBtnSecondary" onClick={refresh}>
              ลองใหม่อีกครั้ง
            </button>
          </div>
        )}

        {data && (
          <>
            {/* Section 1: Hospital Capacity Overview */}
            <section className="bedOverviewGrid" aria-label="ภาพรวมเตียงผู้ป่วยใน">
              {/* Primary Hero Census Card */}
              <article className="bedCard bedHeroCard">
                <div className="bedHeroTop">
                  <div>
                    <p className="bedStatLabel">การครองเตียงขณะนี้ (จากเตียงกรอบมาตรฐาน)</p>
                    <div className="bedHeroFigureRow">
                      <span className="bedHeroFigure bedTabular">
                        {data.totalOccupied.toLocaleString('th-TH')}
                      </span>
                      <span className="bedHeroDivider">
                        / {data.totalBeds.toLocaleString('th-TH')} เตียงกรอบ
                      </span>
                    </div>
                  </div>
                  <UsageStatusBadge percent={data.totalUsagePercent} />
                </div>

                <div className="bedHeroMeter">
                  <BedCapacityBar
                    percent={data.totalUsagePercent}
                    tone={heroTone}
                    label={`อัตราการใช้เตียงรวม ${fmt2(data.totalUsagePercent)} เปอร์เซ็นต์`}
                  />
                  <div className="bedHeroMeterMeta">
                    <span>
                      คงเหลือจากกรอบ{' '}
                      <strong className="bedTabular">
                        {data.totalRemaining.toLocaleString('th-TH')}
                      </strong>{' '}
                      เตียง
                    </span>
                    <span>
                      เตียงให้บริการจริงทุกหอ{' '}
                      <strong className="bedTabular">
                        {totalWardBeds.toLocaleString('th-TH')}
                      </strong>{' '}
                      เตียง
                    </span>
                  </div>
                </div>
              </article>

              {/* Secondary KPI: Monthly Occupancy Rate */}
              <article className="bedCard bedStatCard">
                <p className="bedStatLabel">อัตราครองเตียงเฉลี่ย (เดือนนี้)</p>
                <div className="bedStatValueRow">
                  <span className="bedStatValue bedTabular">{fmt2(data.occupancyRate)}</span>
                  <span className="bedStatUnit">%</span>
                </div>
                <p className="bedStatMeta bedTabular">
                  วันนอนรวม {data.occupancyFormula.totalAdmDays.toLocaleString('th-TH')} × 100 / (
                  {data.totalBeds} × {data.occupancyFormula.daysInMonth} วัน)
                </p>
              </article>

              {/* Secondary KPI: Today's IPD Flow */}
              <article className="bedCard bedStatCard">
                <p className="bedStatLabel">ความเคลื่อนไหวผู้ป่วยในวันนี้</p>
                <div className="bedFlowPair">
                  <div className="bedFlowItem">
                    <span className="bedFlowTag bedFlowTag--admit">
                      <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
                      <span>รับใหม่ (Admit)</span>
                    </span>
                    <span className="bedFlowCount bedTabular">
                      {data.totalAdmitToday.toLocaleString('th-TH')}
                      <span className="bedStatUnit">ราย</span>
                    </span>
                  </div>
                  <div className="bedFlowDivider" aria-hidden="true" />
                  <div className="bedFlowItem">
                    <span className="bedFlowTag bedFlowTag--dc">
                      <ArrowDownRight size={16} strokeWidth={1.5} aria-hidden="true" />
                      <span>จำหน่าย (D/C)</span>
                    </span>
                    <span className="bedFlowCount bedTabular">
                      {data.totalDischargeToday.toLocaleString('th-TH')}
                      <span className="bedStatUnit">ราย</span>
                    </span>
                  </div>
                </div>
              </article>

              {/* Secondary KPI: OPD Today */}
              <article className="bedCard bedStatCard">
                <p className="bedStatLabel">ผู้ป่วยนอกวันนี้ (OPD)</p>
                <div className="bedStatValueRow">
                  <span className="bedStatValue bedTabular">
                    {data.opdPatientCount.toLocaleString('th-TH')}
                  </span>
                  <span className="bedStatUnit">ราย</span>
                </div>
                <p className="bedStatMeta">ผู้รับบริการแผนกผู้ป่วยนอกสะสมวันนี้</p>
              </article>
            </section>

            {/* Section 2: Ward Summary Matrix */}
            <section className="bedSection" aria-labelledby="ward-summary-heading">
              <div className="bedSectionHeader">
                <div className="bedSectionTitleGroup">
                  <h2 id="ward-summary-heading" className="bedSectionTitle">
                    ตารางสรุปรายหอผู้ป่วย
                  </h2>
                  <span className="bedCountMeta bedTabular">
                    {data.wards.length} หอผู้ป่วย · คลิกแถวเพื่อดูรายละเอียดคลินิก
                  </span>
                </div>
              </div>

              {/* Desktop & Tablet Table */}
              <div className="bedTableCard bedDesktopOnly">
                <div className="bedTableScroll">
                  <table className="bedTable">
                    <thead>
                      <tr>
                        <th scope="col">หอผู้ป่วย</th>
                        <th scope="col" className="bedThRight">
                          เตียง
                        </th>
                        <th scope="col" className="bedThRight">
                          ใช้แล้ว
                        </th>
                        <th scope="col" className="bedThRight">
                          ว่าง
                        </th>
                        <th scope="col" className="bedThRight">
                          สัดส่วนการใช้
                        </th>
                        <th scope="col" className="bedThRight">
                          ครองเตียงเดือนนี้
                        </th>
                        <th scope="col" className="bedThRight">
                          Admit
                        </th>
                        <th scope="col" className="bedThRight">
                          D/C
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bedSummaryRow">
                        <td className="bedTdStrong">
                          <div className="bedWardNameCell">
                            <span>การใช้เตียงรวม (เทียบกรอบมาตรฐาน)</span>
                          </div>
                        </td>
                        <td className="bedTdRight bedTabular">{data.totalBeds}</td>
                        <td className="bedTdRight bedTabular">{data.totalOccupied}</td>
                        <td className="bedTdRight bedTabular">{data.totalRemaining}</td>
                        <td className="bedTdRight">
                          <div className="bedUsageCell">
                            <BedCapacityBar
                              percent={data.totalUsagePercent}
                              tone={heroTone}
                              label={`การใช้เตียงรวม ${fmt2(data.totalUsagePercent)} เปอร์เซ็นต์`}
                            />
                            <UsageStatusBadge percent={data.totalUsagePercent} />
                          </div>
                        </td>
                        <td className="bedTdRight bedTabular bedTdStrong">
                          {fmt2(data.occupancyRate)}%
                        </td>
                        <td className="bedTdRight bedTabular">{data.totalAdmitToday}</td>
                        <td className="bedTdRight bedTabular">{data.totalDischargeToday}</td>
                      </tr>

                      {data.wards.map((ward) => {
                        const wardTone = getUsageMeta(ward.usagePercent).tone
                        return (
                          <React.Fragment key={ward.id}>
                            <tr
                              className="bedWardRow"
                              onClick={() => handleJumpToWard(ward.id)}
                            >
                              <td>
                                <div className="bedWardNameCell">
                                  <button
                                    type="button"
                                    className="bedWardRowLink"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleJumpToWard(ward.id)
                                    }}
                                  >
                                    {ward.name}
                                  </button>
                                  {ward.unclassifiedBeds.length > 0 && (
                                    <span className="bedInlineTag bedInlineTag--warning">
                                      รอระบุ ICNP {ward.unclassifiedBeds.length}
                                    </span>
                                  )}
                                  {ward.id === '05' && ward.extra && (
                                    <span className="bedInlineMeta bedTabular">
                                      On Ventilator {ward.extra.onVentilator ?? 0} · CI{' '}
                                      {ward.extra.ciCount ?? 0}
                                    </span>
                                  )}
                                  {ward.id === '04' && (
                                    <span className="bedInlineMeta">
                                      ห้องที่ใช้อาจไม่เท่าจำนวนผู้ป่วย (เช่น แม่-ลูกพักร่วมห้อง)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="bedTdRight bedTabular">{ward.totalBeds}</td>
                              <td className="bedTdRight bedTabular">
                                {ward.id === '04' && ward.extra?.vipPersons !== undefined ? (
                                  <span>
                                    {ward.occupiedBeds}{' '}
                                    <span className="bedSubCount">
                                      ({ward.extra.vipPersons} คน)
                                    </span>
                                  </span>
                                ) : (
                                  ward.occupiedBeds
                                )}
                              </td>
                              <td className="bedTdRight bedTabular">{ward.remainingBeds}</td>
                              <td className="bedTdRight">
                                <div className="bedUsageCell">
                                  <BedCapacityBar
                                    percent={ward.usagePercent}
                                    tone={wardTone}
                                    label={`${ward.name} ${fmt2(ward.usagePercent)} เปอร์เซ็นต์`}
                                  />
                                  <UsageStatusBadge percent={ward.usagePercent} />
                                </div>
                              </td>
                              <td className="bedTdRight bedTabular">
                                {ward.occupancyRate !== null ? `${fmt2(ward.occupancyRate)}%` : '-'}
                              </td>
                              <td className="bedTdRight bedTabular">
                                {ward.admitToday > 0 ? ward.admitToday : '-'}
                              </td>
                              <td className="bedTdRight bedTabular">
                                {ward.dischargeToday > 0 ? ward.dischargeToday : '-'}
                              </td>
                            </tr>

                            {/* Delivery Room Sub-rows */}
                            {ward.id === '02' &&
                              ward.extra?.preDelivery &&
                              ward.extra?.postDelivery && (
                                <>
                                  <tr className="bedSubRow">
                                    <td className="bedSubCellName">ห้องรอคลอด</td>
                                    <td className="bedTdRight bedTabular">
                                      {ward.extra.preDelivery.beds}
                                    </td>
                                    <td className="bedTdRight bedTabular">
                                      {ward.extra.preDelivery.occupied}
                                    </td>
                                    <td className="bedTdRight bedTabular">
                                      {ward.extra.preDelivery.remaining}
                                    </td>
                                    <td className="bedTdRight">
                                      <div className="bedUsageCell">
                                        <BedCapacityBar
                                          percent={ward.extra.preDelivery.usagePercent}
                                          tone={
                                            getUsageMeta(ward.extra.preDelivery.usagePercent).tone
                                          }
                                          label={`ห้องรอคลอด ${fmt2(
                                            ward.extra.preDelivery.usagePercent
                                          )} เปอร์เซ็นต์`}
                                        />
                                        <UsageStatusBadge
                                          percent={ward.extra.preDelivery.usagePercent}
                                        />
                                      </div>
                                    </td>
                                    <td className="bedTdRight">-</td>
                                    <td className="bedTdRight">-</td>
                                    <td className="bedTdRight">-</td>
                                  </tr>
                                  <tr className="bedSubRow">
                                    <td className="bedSubCellName">ห้องหลังคลอด</td>
                                    <td className="bedTdRight bedTabular">
                                      {ward.extra.postDelivery.beds}
                                    </td>
                                    <td className="bedTdRight bedTabular">
                                      {ward.extra.postDelivery.occupied}
                                    </td>
                                    <td className="bedTdRight bedTabular">
                                      {ward.extra.postDelivery.remaining}
                                    </td>
                                    <td className="bedTdRight">
                                      <div className="bedUsageCell">
                                        <BedCapacityBar
                                          percent={ward.extra.postDelivery.usagePercent}
                                          tone={
                                            getUsageMeta(ward.extra.postDelivery.usagePercent).tone
                                          }
                                          label={`ห้องหลังคลอด ${fmt2(
                                            ward.extra.postDelivery.usagePercent
                                          )} เปอร์เซ็นต์`}
                                        />
                                        <UsageStatusBadge
                                          percent={ward.extra.postDelivery.usagePercent}
                                        />
                                      </div>
                                    </td>
                                    <td className="bedTdRight">-</td>
                                    <td className="bedTdRight">-</td>
                                    <td className="bedTdRight">-</td>
                                  </tr>
                                </>
                              )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Compact Summary Cards */}
              <div className="bedMobileSummaryList bedMobileOnly">
                {data.wards.map((ward) => {
                  const wardTone = getUsageMeta(ward.usagePercent).tone
                  return (
                    <div key={ward.id} className="bedCard bedMobileWardSummary">
                      <div className="bedMobileWardTop">
                        <span className="bedTdStrong">{ward.name}</span>
                        <UsageStatusBadge percent={ward.usagePercent} />
                      </div>
                      <BedCapacityBar
                        percent={ward.usagePercent}
                        tone={wardTone}
                        label={`${ward.name} ${fmt2(ward.usagePercent)} เปอร์เซ็นต์`}
                      />
                      <div className="bedMobileWardMetrics bedTabular">
                        <span>
                          ใช้ {ward.occupiedBeds}/{ward.totalBeds} เตียง
                          {ward.id === '04' && ward.extra?.vipPersons !== undefined
                            ? ` (${ward.extra.vipPersons} คน)`
                            : ''}
                        </span>
                        <span>ว่าง {ward.remainingBeds}</span>
                        <span>
                          ครองเตียง{' '}
                          {ward.occupancyRate !== null ? `${fmt2(ward.occupancyRate)}%` : '-'}
                        </span>
                        <span>
                          Admit {ward.admitToday} · D/C {ward.dischargeToday}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Section 3: Clinical Breakdown per Ward */}
            <section className="bedSection" aria-labelledby="ward-clinical-heading">
              <div className="bedSectionHeader">
                <div className="bedSectionTitleGroup">
                  <h2 id="ward-clinical-heading" className="bedSectionTitle">
                    รายละเอียดทางคลินิกรายหอผู้ป่วย
                  </h2>
                  <span className="bedCountMeta">
                    แผนกการรักษา · ระดับอาการ ICNP · เตียงรอระบุอาการแรกรับ
                  </span>
                </div>

                <div className="bedFilterToolbar">
                  <div className="bedSegmentedGroup" role="group" aria-label="ตัวกรองหอผู้ป่วย">
                    <button
                      type="button"
                      className={`bedSegmentBtn ${filterMode === 'all' ? 'is-active' : ''}`}
                      onClick={() => setFilterMode('all')}
                      aria-pressed={filterMode === 'all'}
                    >
                      ทุกหอผู้ป่วย ({data.wards.length})
                    </button>
                    <button
                      type="button"
                      className={`bedSegmentBtn ${
                        filterMode === 'unclassified' ? 'is-active' : ''
                      }`}
                      onClick={() => setFilterMode('unclassified')}
                      aria-pressed={filterMode === 'unclassified'}
                    >
                      <span>รอระบุ ICNP</span>
                      <span className="bedSegmentCount bedTabular">
                        {totalUnclassifiedBeds > 0
                          ? `${wardsWithUnclassifiedCount} หอ · ${totalUnclassifiedBeds} เตียง`
                          : '0'}
                      </span>
                    </button>
                  </div>

                  {visibleWards.length > 0 && (
                    <button
                      type="button"
                      className="bedBtn bedBtnSecondary"
                      onClick={toggleAllWards}
                    >
                      {allCollapsed ? 'ขยายทั้งหมด' : 'ย่อทั้งหมด'}
                    </button>
                  )}
                </div>
              </div>

              {visibleWards.length === 0 ? (
                <div className="bedCard bedEmptyFilterState">
                  <CheckCircle2 size={24} strokeWidth={1.5} aria-hidden="true" />
                  <p className="bedEmptyFilterTitle">ระบุอาการแรกรับ (ICNP) ครบทุกหอผู้ป่วยแล้ว</p>
                  <p className="bedEmptyFilterDesc">
                    ไม่มีเตียงค้างบันทึกระดับความรุนแรงอาการในขณะนี้
                  </p>
                </div>
              ) : (
                <div className="bedWardCardsStack">
                  {visibleWards.map((ward) => (
                    <WardDetailCard
                      key={ward.id}
                      ward={ward}
                      isCollapsed={Boolean(collapsedWards[ward.id])}
                      onToggle={() => toggleWard(ward.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function WardDetailCard({
  ward,
  isCollapsed,
  onToggle,
}: {
  ward: WardOccupancy
  isCollapsed: boolean
  onToggle: () => void
}) {
  const maxSpecialtyCount = Math.max(...ward.specialties.map((s) => s.count), 1)
  const totalIcnpCount = ward.icnpClassifications.reduce((sum, item) => sum + item.count, 0)

  return (
    <article id={`ward-card-${ward.id}`} className="bedCard bedWardCard">
      <div className="bedWardCardHeader">
        <div className="bedWardCardTitleRow">
          <h3 className="bedWardCardTitle">{ward.name}</h3>
          <div className="bedWardMetaChips">
            <span className="bedMetaChip bedTabular">
              ใช้ {ward.occupiedBeds}/{ward.totalBeds} เตียง · ว่าง {ward.remainingBeds}
            </span>
            {ward.id === '04' && ward.extra?.vipPersons !== undefined && (
              <span className="bedMetaChip bedTabular">
                ผู้ป่วยพักจริง {ward.extra.vipPersons} คน
              </span>
            )}
            {ward.id === '05' && ward.extra && (
              <span className="bedMetaChip bedTabular">
                On Ventilator {ward.extra.onVentilator ?? 0} · CI {ward.extra.ciCount ?? 0}
              </span>
            )}
            {ward.unclassifiedBeds.length > 0 ? (
              <span className="bedInlineTag bedInlineTag--warning bedTabular">
                <AlertTriangle size={14} strokeWidth={1.5} aria-hidden="true" />
                <span>รอระบุ ICNP {ward.unclassifiedBeds.length} เตียง</span>
              </span>
            ) : (
              <span className="bedInlineTag bedInlineTag--neutral">
                <CheckCircle2 size={14} strokeWidth={1.5} aria-hidden="true" />
                <span>ICNP ครบ</span>
              </span>
            )}
          </div>
        </div>

        <div className="bedWardCardHeaderRight">
          <UsageStatusBadge percent={ward.usagePercent} />
          <button
            type="button"
            className="bedCollapseBtn"
            onClick={onToggle}
            aria-expanded={!isCollapsed}
            aria-controls={`ward-panel-${ward.id}`}
            aria-label={isCollapsed ? `ขยายรายละเอียด ${ward.name}` : `ย่อรายละเอียด ${ward.name}`}
          >
            {isCollapsed ? (
              <ChevronDown size={18} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <ChevronUp size={18} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div id={`ward-panel-${ward.id}`} className="bedWardCardBody">
          {/* Ward-specific clinical sub-panels (Delivery room split / VIP note) */}
          {ward.id === '02' && ward.extra?.preDelivery && ward.extra?.postDelivery && (
            <div className="bedDeliveryGrid">
              <div className="bedDeliverySlot">
                <div className="bedDeliverySlotTop">
                  <span className="bedDetailTitle">ห้องรอคลอด (Pre-delivery)</span>
                  <span className="bedTabular bedDeliveryCount">
                    ใช้ {ward.extra.preDelivery.occupied}/{ward.extra.preDelivery.beds} เตียง ·
                    ว่าง {ward.extra.preDelivery.remaining}
                  </span>
                </div>
                <BedCapacityBar
                  percent={ward.extra.preDelivery.usagePercent}
                  tone={getUsageMeta(ward.extra.preDelivery.usagePercent).tone}
                  label={`ห้องรอคลอด ${fmt2(ward.extra.preDelivery.usagePercent)} เปอร์เซ็นต์`}
                />
              </div>

              <div className="bedDeliverySlot">
                <div className="bedDeliverySlotTop">
                  <span className="bedDetailTitle">ห้องหลังคลอด (Post-delivery)</span>
                  <span className="bedTabular bedDeliveryCount">
                    ใช้ {ward.extra.postDelivery.occupied}/{ward.extra.postDelivery.beds} เตียง ·
                    ว่าง {ward.extra.postDelivery.remaining}
                  </span>
                </div>
                <BedCapacityBar
                  percent={ward.extra.postDelivery.usagePercent}
                  tone={getUsageMeta(ward.extra.postDelivery.usagePercent).tone}
                  label={`ห้องหลังคลอด ${fmt2(ward.extra.postDelivery.usagePercent)} เปอร์เซ็นต์`}
                />
              </div>
            </div>
          )}

          {ward.id === '04' && (
            <p className="bedWardNote">
              หมายเหตุ: จำนวนห้องพิเศษที่ใช้อาจไม่เท่ากับจำนวนผู้ป่วยในแผนก (เช่น กรณีมารดาและทารกพักรวมห้องเดียวกัน)
            </p>
          )}

          {/* 3-Column Clinical Breakdown */}
          <div className="bedDetailColumns">
            {/* Column 1: Specialty Breakdown */}
            <div className="bedDetailPanel">
              <div className="bedDetailHeader">
                <h4 className="bedDetailTitle">แผนกการรักษา (Specialty)</h4>
                <span className="bedDetailCountMeta bedTabular">
                  {ward.specialties.length} แผนก
                </span>
              </div>
              {ward.specialties.length > 0 ? (
                <ul className="bedRankedList">
                  {ward.specialties.map((spec, idx) => (
                    <li key={`${ward.id}-spec-${idx}`} className="bedRankedItem">
                      <div className="bedRankedRow">
                        <span className="bedRankedName">{spec.name}</span>
                        <span className="bedRankedValue bedTabular">{spec.count} ราย</span>
                      </div>
                      <div className="bedRankedBarTrack" aria-hidden="true">
                        <div
                          className="bedRankedBarFill"
                          style={{ width: `${(spec.count / maxSpecialtyCount) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="bedEmptyText">ไม่มีผู้ป่วยแยกตามแผนกในขณะนี้</p>
              )}
            </div>

            {/* Column 2: ICNP Classification */}
            <div className="bedDetailPanel">
              <div className="bedDetailHeader">
                <h4 className="bedDetailTitle">ระดับความรุนแรงอาการ (ICNP)</h4>
                <span className="bedDetailCountMeta bedTabular">{totalIcnpCount} ราย</span>
              </div>
              {ward.icnpClassifications.length > 0 ? (
                <ul className="bedIcnpList">
                  {ward.icnpClassifications.map((icnp, idx) => {
                    const tone = getIcnpTone(icnp.name)
                    return (
                      <li key={`${ward.id}-icnp-${idx}`} className="bedIcnpItem">
                        <span className="bedIcnpLabelGroup">
                          <span className={`bedIcnpDot bedIcnpDot--${tone}`} aria-hidden="true" />
                          <span className="bedIcnpName">{icnp.name}</span>
                        </span>
                        <span className="bedIcnpCount bedTabular">{icnp.count} ราย</span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="bedEmptyText">ไม่มีข้อมูลจำแนก ICNP</p>
              )}
            </div>

            {/* Column 3: Unclassified Beds */}
            <div
              className={`bedDetailPanel ${
                ward.unclassifiedBeds.length > 0 ? 'bedDetailPanel--warning' : ''
              }`}
            >
              <div className="bedDetailHeader">
                <h4 className="bedDetailTitle">เตียงยังไม่ระบุอาการแรกรับ</h4>
                <span className="bedDetailCountMeta bedTabular">
                  {ward.unclassifiedBeds.length} เตียง
                </span>
              </div>
              {ward.unclassifiedBeds.length > 0 ? (
                <div className="bedTagGrid">
                  {ward.unclassifiedBeds.map((bed, idx) => (
                    <span key={`${ward.id}-bed-${idx}`} className="bedCodeTag bedTabular">
                      {bed}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="bedAllClearBox">
                  <CheckCircle2 size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>ระบุอาการแรกรับครบทุกเตียงแล้ว</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
