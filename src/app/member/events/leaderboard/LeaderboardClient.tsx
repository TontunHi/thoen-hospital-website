'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { calculateThaiFiscalYear } from '@/lib/events/eventUtils'
import './leaderboard.css'

export interface IndividualRankItem {
  rank: number
  memberId: number
  name: string
  department: string | null
  position: string | null
  profilePath: string | null
  totalPoints: number
  eventCount: number
}

export interface DepartmentRankItem {
  rank: number
  department: string
  totalPoints: number
  memberCount: number
  avgPointsPerMember?: number
}

interface LeaderboardClientProps {
  initialIndividual: IndividualRankItem[]
  initialDepartment: DepartmentRankItem[]
  fiscalYears: string[]
  currentMemberId: number
}

export default function LeaderboardClient({
  initialIndividual,
  initialDepartment,
  fiscalYears,
  currentMemberId,
}: LeaderboardClientProps) {
  const [activeTab, setActiveTab] = useState<'individual' | 'department'>('individual')
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(
    fiscalYears[0] || calculateThaiFiscalYear()
  )
  const [individualList, setIndividualList] = useState<IndividualRankItem[]>(initialIndividual)
  const [departmentList, setDepartmentList] = useState<DepartmentRankItem[]>(initialDepartment)
  const [searchQuery, setSearchQuery] = useState('')
  const [, setLoading] = useState(false)

  const handleYearChange = async (year: string) => {
    setSelectedFiscalYear(year)
    setLoading(true)
    try {
      const res = await fetch(`/api/member/events/leaderboard?fiscalYear=${year}`)
      const json = await res.json()
      if (json.success && json.data) {
        setIndividualList(json.data.individual || [])
        setDepartmentList(json.data.department || [])
      }
    } catch (err) {
      console.error('Error fetching leaderboard for year:', err)
    } finally {
      setLoading(false)
    }
  }

  // Filter individual items by search
  const filteredIndividual = useMemo(() => {
    if (!searchQuery.trim()) return individualList
    const q = searchQuery.toLowerCase().trim()
    return individualList.filter(
      (it) =>
        it.name.toLowerCase().includes(q) ||
        (it.department && it.department.toLowerCase().includes(q)) ||
        (it.position && it.position.toLowerCase().includes(q))
    )
  }, [individualList, searchQuery])

  // Filter department items by search
  const filteredDepartment = useMemo(() => {
    if (!searchQuery.trim()) return departmentList
    const q = searchQuery.toLowerCase().trim()
    return departmentList.filter((dept) =>
      dept.department.toLowerCase().includes(q)
    )
  }, [departmentList, searchQuery])

  // Top 1 individuals (handles ties)
  const top1List = useMemo(() => {
    return individualList.filter((it) => it.rank === 1)
  }, [individualList])

  const top1Score = top1List.length > 0 ? top1List[0].totalPoints : 0

  // Current logged in member standing
  const myStanding = useMemo(() => {
    return individualList.find((it) => it.memberId === currentMemberId)
  }, [individualList, currentMemberId])

  return (
    <div className="lb-page">
      <div className="lb-container">
        {/* 1. ลิงก์กลับ */}
        <div>
          <Link href="/member/events" className="lb-back-link">
            ← กลับระบบกิจกรรม
          </Link>
        </div>

        {/* 2. หัวหน้า */}
        <header className="lb-header">
          <div className="lb-header-text">
            <h1 className="lb-title">กระดานคะแนนกิจกรรม</h1>
            <p className="lb-subtitle">
              บันทึกและเชิดชูเกียรติการเข้าร่วมกิจกรรมโรงพยาบาลเถินผ่าน ThaID
            </p>
          </div>

          <label htmlFor="lb-year-select" className="lb-year-control">
            <span className="lb-year-label">ปีงบประมาณ</span>
            <select
              id="lb-year-select"
              value={selectedFiscalYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="lb-year-select"
              aria-label="เลือกปีงบประมาณ"
            >
              {fiscalYears.map((yr) => (
                <option key={yr} value={yr}>
                  ปีงบประมาณ {yr}
                </option>
              ))}
              <option value="ALL">ตลอดกาล (All-time)</option>
            </select>
          </label>
        </header>

        {/* 3. แถวสรุป */}
        <section className="lb-summary-row" aria-label="สรุปภาพรวมกระดานคะแนน">
          {/* การ์ดอันดับ 1 */}
          <div className="lb-card-rank1">
            <div>
              <div className="lb-rank1-badge">
                {top1List.length > 1
                  ? `อันดับ 1 ร่วมกัน ${top1List.length} คน`
                  : 'อันดับ 1'}
              </div>
              <div className="lb-rank1-score">
                {top1Score} <span className="lb-rank1-unit">คะแนน</span>
              </div>
            </div>

            <div className="lb-rank1-members">
              {top1List.length > 0 ? (
                top1List.map((item) => (
                  <div key={item.memberId} className="lb-rank1-member-item">
                    <div className="lb-rank1-member-name">{item.name}</div>
                    <div className="lb-rank1-member-dept">
                      {item.department || 'โรงพยาบาลเถิน'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="lb-rank1-empty">
                  ยังไม่มีข้อมูลคะแนนในปีงบประมาณนี้
                </div>
              )}
            </div>
          </div>

          {/* สถิติฝั่งขวา */}
          <div className="lb-stats-grid">
            <div className="lb-stat-card">
              <span className="lb-stat-label">ผู้เข้าร่วม</span>
              <div className="lb-stat-value">
                {individualList.length} <span className="lb-stat-unit">คน</span>
              </div>
            </div>

            <div className="lb-stat-card">
              <span className="lb-stat-label">แผนก/กลุ่มงาน</span>
              <div className="lb-stat-value">
                {departmentList.length} <span className="lb-stat-unit">แห่ง</span>
              </div>
            </div>

            {/* สถานะของฉัน (เต็มแถวล่างของกริด) */}
            <div className="lb-stat-card lb-stat-card-wide">
              <span className="lb-stat-label">สถานะของฉัน</span>
              {myStanding && myStanding.totalPoints > 0 ? (
                <div className="lb-my-standing-text">
                  อันดับของคุณ: {myStanding.rank} · คะแนน: {myStanding.totalPoints}
                </div>
              ) : (
                <div className="lb-my-standing-empty">
                  <span className="lb-my-standing-empty-msg">
                    คุณยังไม่มีคะแนนสะสมในปีงบประมาณ{' '}
                    {selectedFiscalYear === 'ALL' ? 'ที่ผ่านมา' : selectedFiscalYear}
                  </span>
                  <Link href="/member/events" className="lb-btn-cta">
                    ดูกิจกรรมที่เปิดรับ
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 4. การ์ดข้อมูลรายการ */}
        <section className="lb-data-card" aria-label="ตารางอันดับคะแนน">
          {/* แถบเครื่องมือ */}
          <div className="lb-toolbar">
            <div className="lb-segmented-control" role="tablist" aria-label="ประเภทกระดานอันดับ">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'individual'}
                aria-pressed={activeTab === 'individual'}
                onClick={() => setActiveTab('individual')}
                className={`lb-tab-btn ${activeTab === 'individual' ? 'lb-tab-active' : ''}`}
              >
                รายบุคคล · {individualList.length}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'department'}
                aria-pressed={activeTab === 'department'}
                onClick={() => setActiveTab('department')}
                className={`lb-tab-btn ${activeTab === 'department' ? 'lb-tab-active' : ''}`}
              >
                ระดับแผนก · {departmentList.length}
              </button>
            </div>

            <div className="lb-search-wrap">
              <input
                type="search"
                aria-label="ค้นหาชื่อ หรือแผนก"
                placeholder="ค้นหาชื่อ หรือแผนก"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="lb-search-input"
              />
            </div>
          </div>

          {/* ตารางแสดงผล */}
          <div className="lb-table-container">
            {activeTab === 'individual' ? (
              <table className="lb-table lb-table-individual">
                <thead>
                  <tr>
                    <th className="lb-th-rank">อันดับ</th>
                    <th className="lb-th-name">ชื่อ-สกุล</th>
                    <th className="lb-th-dept">แผนก/กลุ่มงาน</th>
                    <th className="lb-th-events">กิจกรรม</th>
                    <th className="lb-th-points">คะแนน</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIndividual.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="lb-empty-cell">
                        ไม่พบรายการที่ตรงกับคำค้นหา
                      </td>
                    </tr>
                  ) : (
                    filteredIndividual.map((item) => {
                      const isRank1 = item.rank === 1
                      const isMe = item.memberId === currentMemberId
                      return (
                        <tr
                          key={item.memberId}
                          className={`${isRank1 ? 'lb-row-rank1' : ''}`}
                        >
                          <td className="lb-td-rank">
                            {isRank1 ? (
                              <span className="lb-rank-badge-1">1</span>
                            ) : (
                              <span className="lb-rank-num">{item.rank}</span>
                            )}
                          </td>
                          <td className="lb-td-name">
                            <div className="lb-name-row">
                              <span className="lb-name-text">{item.name}</span>
                              {isMe && <span className="lb-me-pill">คุณ</span>}
                            </div>
                            {item.position && (
                              <div className="lb-position-text">{item.position}</div>
                            )}
                          </td>
                          <td className="lb-td-dept">
                            {item.department || '-'}
                          </td>
                          <td className="lb-td-events">{item.eventCount}</td>
                          <td className="lb-td-points">{item.totalPoints}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table className="lb-table lb-table-department">
                <thead>
                  <tr>
                    <th className="lb-th-rank">อันดับ</th>
                    <th className="lb-th-dept-name">แผนก/กลุ่มงาน</th>
                    <th className="lb-th-members">ผู้เข้าร่วม</th>
                    <th className="lb-th-points">คะแนน</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDepartment.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="lb-empty-cell">
                        ไม่พบรายการที่ตรงกับคำค้นหา
                      </td>
                    </tr>
                  ) : (
                    filteredDepartment.map((dept) => {
                      const isRank1 = dept.rank === 1
                      return (
                        <tr
                          key={dept.department}
                          className={`${isRank1 ? 'lb-row-rank1' : ''}`}
                        >
                          <td className="lb-td-rank">
                            {isRank1 ? (
                              <span className="lb-rank-badge-1">1</span>
                            ) : (
                              <span className="lb-rank-num">{dept.rank}</span>
                            )}
                          </td>
                          <td className="lb-td-dept-name">{dept.department}</td>
                          <td className="lb-td-members">{dept.memberCount}</td>
                          <td className="lb-td-points">{dept.totalPoints}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
