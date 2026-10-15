'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Trophy,
  Users,
  Building2,
  Search,
  ArrowLeft,
  Sparkles,
  Award,
  Crown,
  Calendar,
  ChevronRight,
  X,
  TrendingUp,
} from 'lucide-react'
import { calculateThaiFiscalYear } from '@/lib/events/eventUtils'
import { getInitials } from '@/lib/formatters'
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

  // Max department points for progress bar visualization
  const maxDeptPoints = useMemo(() => {
    return Math.max(...departmentList.map((d) => d.totalPoints), 1)
  }, [departmentList])

  // Current user's standing in this fiscal year
  const myStanding = useMemo(() => {
    return individualList.find((it) => it.memberId === currentMemberId)
  }, [individualList, currentMemberId])

  // Top 3 Podium items for individual
  const top1 = individualList.find((it) => it.rank === 1)
  const top2 = individualList.find((it) => it.rank === 2)
  const top3 = individualList.find((it) => it.rank === 3)

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="rankBadge rankBadgeGold" title="อันดับ 1 (ชนะเลิศ)">
          🥇 1
        </span>
      )
    }
    if (rank === 2) {
      return (
        <span className="rankBadge rankBadgeSilver" title="อันดับ 2 (รองชนะเลิศอันดับ 1)">
          🥈 2
        </span>
      )
    }
    if (rank === 3) {
      return (
        <span className="rankBadge rankBadgeBronze" title="อันดับ 3 (รองชนะเลิศอันดับ 2)">
          🥉 3
        </span>
      )
    }
    return <span className="rankBadge rankBadgeDefault">#{rank}</span>
  }

  return (
    <div className="eventsPageContainer">
      {/* Back Navigation */}
      <div className="backNavRow">
        <Link href="/member/events" className="eventsBackLink">
          <ArrowLeft size={16} /> กลับสู่ระบบกิจกรรม
        </Link>
      </div>

      {/* Hero Header & Podium */}
      <div className="leaderboardHero">
        <div className="leaderboardHeroTop">
          <div className="leaderboardHeroTitleCol">
            <div className="leaderboardHeroTag">
              <Trophy size={14} style={{ color: '#fde68a' }} />
              <span>กระดานเกียรติยศการมีส่วนร่วม • โรงพยาบาลเถิน</span>
            </div>
            <h1 className="leaderboardHeroTitle">กระดานคะแนนกิจกรรม</h1>
            <p className="leaderboardHeroSubtitle">
              บันทึกและเชิดชูเกียรติการเข้าร่วมกิจกรรมโรงพยาบาลเถินผ่าน ThaID (คะแนนเท่ากันครองอันดับร่วมกัน)
            </p>
          </div>

          {/* Fiscal Year Selector */}
          <div className="leaderboardYearControl">
            <label className="leaderboardYearLabel">
              <Calendar size={13} style={{ color: '#fde68a' }} />
              <span>ปีงบประมาณ</span>
            </label>
            <select
              value={selectedFiscalYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="leaderboardYearSelect"
              aria-label="เลือกปีงบประมาณ"
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
            {/* Rank 1 (Gold) - Desktop Center, Mobile Top */}
            <div className="podiumCard podiumGold">
              <div className="podiumCrownBadge">
                <Crown size={12} />
                <span>อันดับ 1 (ยอดเยี่ยม)</span>
              </div>
              <div>
                <div className="podiumAvatarWrap">
                  {top1.profilePath ? (
                    <img
                      src={`/api/member/profile/image?userId=${top1.memberId}`}
                      alt={top1.name}
                      className="podiumAvatarImg"
                    />
                  ) : (
                    <span className="podiumAvatarInitials">{getInitials(top1.name)}</span>
                  )}
                </div>
                <div className="podiumRankLabel">🥇 ชนะเลิศอันดับ 1</div>
                <div className="podiumName" title={top1.name}>
                  {top1.name}
                </div>
                <div className="podiumDept">{top1.department || 'โรงพยาบาลเถิน'}</div>
              </div>
              <div className="podiumScoreSection">
                <div className="podiumScoreValue">
                  {top1.totalPoints}
                  <span className="podiumScoreUnit">คะแนน</span>
                </div>
                <div className="podiumEventCount">{top1.eventCount} กิจกรรม</div>
              </div>
            </div>

            {/* Rank 2 (Silver) - Desktop Left, Mobile Second */}
            <div className="podiumCard podiumSilver">
              <div>
                <div className="podiumAvatarWrap">
                  {top2?.profilePath ? (
                    <img
                      src={`/api/member/profile/image?userId=${top2.memberId}`}
                      alt={top2.name}
                      className="podiumAvatarImg"
                    />
                  ) : (
                    <span className="podiumAvatarInitials">{top2 ? getInitials(top2.name) : '-'}</span>
                  )}
                </div>
                <div className="podiumRankLabel">🥈 รองชนะเลิศอันดับ 1</div>
                <div className="podiumName" title={top2?.name || '-'}>
                  {top2 ? top2.name : '-'}
                </div>
                <div className="podiumDept">{top2?.department || ''}</div>
              </div>
              <div className="podiumScoreSection">
                <div className="podiumScoreValue">
                  {top2 ? top2.totalPoints : 0}
                  <span className="podiumScoreUnit">คะแนน</span>
                </div>
                <div className="podiumEventCount">{top2 ? `${top2.eventCount} กิจกรรม` : '-'}</div>
              </div>
            </div>

            {/* Rank 3 (Bronze) - Desktop Right, Mobile Third */}
            <div className="podiumCard podiumBronze">
              <div>
                <div className="podiumAvatarWrap">
                  {top3?.profilePath ? (
                    <img
                      src={`/api/member/profile/image?userId=${top3.memberId}`}
                      alt={top3.name}
                      className="podiumAvatarImg"
                    />
                  ) : (
                    <span className="podiumAvatarInitials">{top3 ? getInitials(top3.name) : '-'}</span>
                  )}
                </div>
                <div className="podiumRankLabel">🥉 รองชนะเลิศอันดับ 2</div>
                <div className="podiumName" title={top3?.name || '-'}>
                  {top3 ? top3.name : '-'}
                </div>
                <div className="podiumDept">{top3?.department || ''}</div>
              </div>
              <div className="podiumScoreSection">
                <div className="podiumScoreValue">
                  {top3 ? top3.totalPoints : 0}
                  <span className="podiumScoreUnit">คะแนน</span>
                </div>
                <div className="podiumEventCount">{top3 ? `${top3.eventCount} กิจกรรม` : '-'}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* My Standing Card (Only on Individual tab) */}
      {activeTab === 'individual' && (
        myStanding ? (
          <div className="myStandingCard">
            <div className="myStandingLeft">
              <div className="myStandingBadge">สถานะของฉัน</div>
              <div className="myStandingRank">
                #{myStanding.rank}
                <span className="myStandingTotal">/ ทั้งหมด {individualList.length} คน</span>
              </div>
            </div>
            <div className="myStandingDivider" />
            <div className="myStandingStats">
              <div className="myStandingStatItem">
                <span className="myStandingStatLabel">คะแนนสะสม</span>
                <span className="myStandingStatValue highlight">{myStanding.totalPoints} คะแนน</span>
              </div>
              <div className="myStandingStatItem">
                <span className="myStandingStatLabel">กิจกรรมที่เข้าร่วม</span>
                <span className="myStandingStatValue">{myStanding.eventCount} งาน</span>
              </div>
            </div>
            {myStanding.rank <= 3 && (
              <div className="myStandingHonorBadge">
                <Sparkles size={14} />
                <span>Top 3 เกียรติยศ</span>
              </div>
            )}
          </div>
        ) : (
          <div className="myStandingCard empty">
            <div className="myStandingEmptyInfo">
              <Award size={24} className="myStandingIcon" />
              <div>
                <div className="myStandingEmptyTitle">
                  คุณยังไม่มีคะแนนสะสมในปีงบประมาณ {selectedFiscalYear === 'ALL' ? 'ที่ผ่านมา' : selectedFiscalYear}
                </div>
                <div className="myStandingEmptyDesc">
                  เข้าร่วมกิจกรรมของโรงพยาบาลและสแกนเช็คอิน ThaID หน้างานเพื่อเริ่มสะสมคะแนน
                </div>
              </div>
            </div>
            <Link href="/member/events" className="myStandingCta">
              <span>ดูกิจกรรมที่เปิดรับ</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        )
      )}

      {/* Tab Selector & Search Header */}
      <div className="eventsFilterBar">
        <div className="eventsTabsGroup" role="tablist" aria-label="ประเภทกระดานอันดับ">
          <button
            role="tab"
            aria-selected={activeTab === 'individual'}
            onClick={() => setActiveTab('individual')}
            className={`eventsTabButton ${activeTab === 'individual' ? 'active' : ''}`}
          >
            <Users size={15} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: '-2px' }} />
            อันดับรายบุคคล ({individualList.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'department'}
            onClick={() => setActiveTab('department')}
            className={`eventsTabButton ${activeTab === 'department' ? 'active' : ''}`}
          >
            <Building2 size={15} style={{ display: 'inline', marginRight: '0.35rem', verticalAlign: '-2px' }} />
            อันดับระดับแผนก ({departmentList.length})
          </button>
        </div>

        <div className="eventsSearchWrap" style={{ maxWidth: 300 }}>
          <Search className="eventsSearchIcon" size={16} />
          <input
            type="text"
            placeholder={
              activeTab === 'individual'
                ? 'ค้นหาชื่อ หรือแผนก...'
                : 'ค้นหากลุ่มงาน หรือแผนก...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="eventsSearchInput"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="btnClearSearch"
              title="ล้างคำค้นหา"
            >
              <X size={14} />
            </button>
          )}
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
            <div className="eventsEmptyState" style={{ border: 'none' }}>
              <Trophy size={42} className="eventsEmptyIcon" />
              <h3 className="eventsEmptyTitle">ไม่พบข้อมูลคะแนนรายบุคคล</h3>
              <p className="eventsEmptyDesc">
                {searchQuery.trim()
                  ? 'ไม่พบบุคลากรที่ตรงกับคำค้นหา ลองตรวจสอบชื่อหรือแผนกอีกครั้ง'
                  : 'ยังไม่มีข้อมูลการเข้าร่วมกิจกรรมในปีงบประมาณนี้'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="btnSecondary"
                >
                  ล้างคำค้นหา
                </button>
              )}
            </div>
          ) : (
            <div className="tableResponsiveWrap">
              <table className="styledTable">
                <thead>
                  <tr>
                    <th style={{ width: 75, textAlign: 'center' }}>อันดับ</th>
                    <th>ชื่อ-สกุล บุคลากร</th>
                    <th>แผนก / กลุ่มงาน</th>
                    <th>ตำแหน่ง</th>
                    <th style={{ textAlign: 'center', width: 120 }}>จำนวนกิจกรรม</th>
                    <th style={{ textAlign: 'right', width: 130 }}>คะแนนสะสม</th>
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
                          <div className="tableMemberCell">
                            <div className="tableAvatarWrap">
                              {item.profilePath ? (
                                <img
                                  src={`/api/member/profile/image?userId=${item.memberId}`}
                                  alt={item.name}
                                  className="tableAvatarImg"
                                />
                              ) : (
                                <span className="tableAvatarInitials">
                                  {getInitials(item.name)}
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="tableMemberNameText">{item.name}</span>
                              {isMe && <span className="mePillBadge">คุณ</span>}
                            </div>
                          </div>
                        </td>
                        <td>{item.department || 'ไม่ระบุแผนก'}</td>
                        <td>{item.position || '-'}</td>
                        <td style={{ textAlign: 'center', color: '#475569' }}>
                          {item.eventCount} งาน
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="pointsPill">
                            <Sparkles size={12} />
                            <span>{item.totalPoints} คะแนน</span>
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
            <div className="eventsEmptyState" style={{ border: 'none' }}>
              <Building2 size={42} className="eventsEmptyIcon" />
              <h3 className="eventsEmptyTitle">ไม่พบข้อมูลคะแนนระดับแผนก</h3>
              <p className="eventsEmptyDesc">
                {searchQuery.trim()
                  ? 'ไม่พบแผนกที่ตรงกับคำค้นหา ลองตรวจสอบคำค้นหาอีกครั้ง'
                  : 'ยังไม่มีข้อมูลคะแนนของแผนกในปีงบประมาณนี้'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="btnSecondary"
                >
                  ล้างคำค้นหา
                </button>
              )}
            </div>
          ) : (
            <div className="tableResponsiveWrap">
              <table className="styledTable">
                <thead>
                  <tr>
                    <th style={{ width: 75, textAlign: 'center' }}>อันดับ</th>
                    <th>กลุ่มงาน / แผนก</th>
                    <th style={{ textAlign: 'center', width: 130 }}>บุคลากรในแผนก</th>
                    <th style={{ minWidth: 160 }}>คะแนนรวมทั้งหมด</th>
                    <th style={{ textAlign: 'right', width: 140 }}>คะแนนเฉลี่ยต่อคน</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDepartment.map((dept) => {
                    const percentOfMax = Math.min(
                      100,
                      Math.round((dept.totalPoints / maxDeptPoints) * 100)
                    )
                    return (
                      <tr key={dept.department}>
                        <td style={{ textAlign: 'center' }}>
                          {getRankBadge(dept.rank)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <Building2 size={15} style={{ color: '#059669', flexShrink: 0 }} />
                            <strong style={{ color: '#0f172a' }}>{dept.department}</strong>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', color: '#475569' }}>
                          {dept.memberCount} คน
                        </td>
                        <td>
                          <div className="deptPointsCell">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.775rem' }}>
                              <span style={{ fontWeight: 800, color: '#065f46' }}>
                                {dept.totalPoints} แต้ม
                              </span>
                              <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                                {percentOfMax}%
                              </span>
                            </div>
                            <div className="deptPointsBarWrap" title={`${dept.totalPoints} แต้ม`}>
                              <div
                                className="deptPointsBarFill"
                                style={{ width: `${percentOfMax}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="pointsPill">
                            <TrendingUp size={12} />
                            <span>{dept.avgPointsPerMember} แต้ม/คน</span>
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
      )}
    </div>
  )
}
