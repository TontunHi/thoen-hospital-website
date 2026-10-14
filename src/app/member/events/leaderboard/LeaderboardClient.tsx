'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Trophy,
  Users,
  Building2,
  Search,
  ArrowLeft,
} from 'lucide-react'
import { calculateThaiFiscalYear } from '@/lib/events/eventUtils'
import '../events.css'

interface IndividualRankItem {
  rank: number
  memberId: number
  name: string
  department: string | null
  position: string | null
  profilePath: string | null
  totalPoints: number
  eventCount: number
}

interface DepartmentRankItem {
  rank: number
  department: string
  totalPoints: number
  memberCount: number
  avgPointsPerMember: number
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
  const [loading, setLoading] = useState(false)

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
  const filteredIndividual = individualList.filter((it) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase().trim()
    return (
      it.name.toLowerCase().includes(q) ||
      (it.department && it.department.toLowerCase().includes(q))
    )
  })

  // Filter department items by search
  const filteredDepartment = departmentList.filter((dept) => {
    if (!searchQuery.trim()) return true
    return dept.department.toLowerCase().includes(searchQuery.toLowerCase().trim())
  })

  // Top 3 Podium items for individual
  const top1 = individualList.find((it) => it.rank === 1)
  const top2 = individualList.find((it) => it.rank === 2)
  const top3 = individualList.find((it) => it.rank === 3)

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return <span className="rankBadge rankBadgeGold">🥇 1</span>
    }
    if (rank === 2) {
      return <span className="rankBadge rankBadgeSilver">🥈 2</span>
    }
    if (rank === 3) {
      return <span className="rankBadge rankBadgeBronze">🥉 3</span>
    }
    return <span className="rankBadge rankBadgeDefault">#{rank}</span>
  }

  return (
    <div className="eventsPageContainer">
      {/* Navigation */}
      <div className="backNavRow">
        <Link href="/member/events" className="btnBack">
          <ArrowLeft size={16} />
          <span>กลับหน้ารายการกิจกรรม</span>
        </Link>
      </div>

      {/* Hero Header & Podium */}
      <div className="leaderboardHero">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div
                className="eventsPillTag"
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                }}
              >
                <Trophy size={13} style={{ color: '#fde68a' }} />
                <span>กระดานเกียรติยศการมีส่วนร่วม</span>
              </div>
              <h1 className="eventsHeaderTitle" style={{ margin: '0.25rem 0' }}>
                กระดานคะแนน
              </h1>
              <p className="eventsHeaderSubtitle" style={{ color: '#fef3c7' }}>
                คะแนนสะสมจากการเข้าร่วมกิจกรรมโรงพยาบาลเถินผ่าน ThaID (คะแนนเท่ากันครองอันดับร่วมกัน)
              </p>
            </div>

            {/* Fiscal Year Selector */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                backdropFilter: 'blur(8px)',
              }}
            >
              <label style={{ fontSize: '0.7rem', color: '#fef3c7', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>
                เลือกปีงบประมาณ พ.ศ.
              </label>
              <select
                value={selectedFiscalYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="eventsYearSelect"
                style={{ background: '#ffffff', fontWeight: 700 }}
              >
                {fiscalYears.map((yr) => (
                  <option key={yr} value={yr}>
                    ปีงบประมาณ {yr}
                  </option>
                ))}
                <option value="ALL">ตลอดกาล (All-time)</option>
              </select>
            </div>
          </div>

          {/* Podium Top 3 (Individual) */}
          {activeTab === 'individual' && top1 && (
            <div className="leaderboardPodium">
              {/* Rank 2 */}
              <div className="podiumCard" style={{ order: 2 }}>
                <div>
                  <div className="podiumMedalIcon">🥈</div>
                  <div className="podiumRankLabel">อันดับ 2</div>
                  <div className="podiumName">{top2 ? top2.name : '-'}</div>
                  <div className="podiumDept">{top2?.department || ''}</div>
                </div>
                <div className="podiumScore">
                  {top2 ? `${top2.totalPoints} คะแนน` : '-'}
                </div>
              </div>

              {/* Rank 1 (Gold / Elevated) */}
              <div className="podiumCard podiumGold" style={{ order: 1 }}>
                <div>
                  <div className="podiumMedalIcon">🥇</div>
                  <div className="podiumRankLabel" style={{ color: '#fef08a' }}>
                    อันดับ 1 (ยอดเยี่ยม)
                  </div>
                  <div className="podiumName" style={{ fontSize: '1.15rem' }}>
                    {top1.name}
                  </div>
                  <div className="podiumDept">{top1.department || ''}</div>
                </div>
                <div className="podiumScore podiumScoreGold">
                  {top1.totalPoints}{' '}
                  <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#ffffff' }}>
                    คะแนน
                  </span>
                </div>
              </div>

              {/* Rank 3 */}
              <div className="podiumCard" style={{ order: 3 }}>
                <div>
                  <div className="podiumMedalIcon">🥉</div>
                  <div className="podiumRankLabel">อันดับ 3</div>
                  <div className="podiumName">{top3 ? top3.name : '-'}</div>
                  <div className="podiumDept">{top3?.department || ''}</div>
                </div>
                <div className="podiumScore">
                  {top3 ? `${top3.totalPoints} คะแนน` : '-'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab Selector & Search Header */}
      <div className="eventsFilterBar">
        <div className="eventsTabsGroup">
          <button
            onClick={() => setActiveTab('individual')}
            className={`eventsTabButton ${activeTab === 'individual' ? 'active' : ''}`}
          >
            <Users size={15} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: '-2px' }} />
            อันดับรายบุคคล ({individualList.length})
          </button>
          <button
            onClick={() => setActiveTab('department')}
            className={`eventsTabButton ${activeTab === 'department' ? 'active' : ''}`}
          >
            <Building2 size={15} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: '-2px' }} />
            อันดับระดับแผนก ({departmentList.length})
          </button>
        </div>

        <div className="eventsSearchWrap" style={{ maxWidth: 280 }}>
          <Search className="eventsSearchIcon" size={16} />
          <input
            type="text"
            placeholder="ค้นหาชื่อ หรือแผนก..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="eventsSearchInput"
          />
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="eventsLoadingSpinner">
          <div className="spinnerCircle" />
        </div>
      ) : activeTab === 'individual' ? (
        /* Individual Leaderboard Table */
        <div className="tableCard">
          {filteredIndividual.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              ยังไม่มีข้อมูลการเข้าร่วมกิจกรรมในปีงบประมาณนี้
            </div>
          ) : (
            <div className="tableResponsiveWrap">
              <table className="styledTable">
                <thead>
                  <tr>
                    <th style={{ width: 65, textAlign: 'center' }}>อันดับ</th>
                    <th>ชื่อ-สกุล</th>
                    <th>แผนก/กลุ่มงาน</th>
                    <th>ตำแหน่ง</th>
                    <th style={{ textAlign: 'center' }}>จำนวนกิจกรรม</th>
                    <th style={{ textAlign: 'right' }}>คะแนนสะสม</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIndividual.map((item) => {
                    const isMe = item.memberId === currentMemberId
                    return (
                      <tr
                        key={item.memberId}
                        className={isMe ? 'highlightMe' : ''}
                      >
                        <td style={{ textAlign: 'center' }}>
                          {getRankBadge(item.rank)}
                        </td>
                        <td>
                          <strong>{item.name}</strong>
                          {isMe && (
                            <span style={{ fontSize: '0.7rem', color: '#047857', marginLeft: '0.35rem' }}>
                              (คุณ)
                            </span>
                          )}
                        </td>
                        <td>{item.department || 'ไม่ระบุแผนก'}</td>
                        <td>{item.position || '-'}</td>
                        <td style={{ textAlign: 'center', color: '#475569' }}>
                          {item.eventCount} งาน
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="pointsPill">
                            {item.totalPoints} คะแนน
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Department Leaderboard Table */
        <div className="tableCard">
          {filteredDepartment.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
              ยังไม่มีข้อมูลคะแนนของแผนกในปีงบประมาณนี้
            </div>
          ) : (
            <div className="tableResponsiveWrap">
              <table className="styledTable">
                <thead>
                  <tr>
                    <th style={{ width: 65, textAlign: 'center' }}>อันดับ</th>
                    <th>กลุ่มงาน / แผนก</th>
                    <th style={{ textAlign: 'center' }}>บุคลากรในแผนก</th>
                    <th style={{ textAlign: 'center' }}>คะแนนรวมทั้งหมด</th>
                    <th style={{ textAlign: 'right' }}>คะแนนเฉลี่ยต่อคน</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDepartment.map((dept) => (
                    <tr key={dept.department}>
                      <td style={{ textAlign: 'center' }}>
                        {getRankBadge(dept.rank)}
                      </td>
                      <td>
                        <strong>{dept.department}</strong>
                      </td>
                      <td style={{ textAlign: 'center', color: '#475569' }}>
                        {dept.memberCount} คน
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="eventStatusBadge">
                          {dept.totalPoints} แต้ม
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="pointsPill">
                          {dept.avgPointsPerMember} แต้ม/คน
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
