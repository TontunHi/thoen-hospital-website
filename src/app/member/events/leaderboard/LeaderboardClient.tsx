'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Trophy,
  Medal,
  Users,
  Building2,
  Calendar,
  Search,
  ArrowLeft,
  Sparkles,
  Award,
  TrendingUp,
} from 'lucide-react'

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
    fiscalYears[0] || '2569'
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
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-amber-950 font-bold text-xs shadow-xs">
          🥇 1
        </span>
      )
    }
    if (rank === 2) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-900 font-bold text-xs shadow-xs">
          🥈 2
        </span>
      )
    }
    if (rank === 3) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-amber-50 font-bold text-xs shadow-xs">
          🥉 3
        </span>
      )
    }
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">
        #{rank}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/70 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/member/events"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>กลับหน้ารายการกิจกรรม</span>
          </Link>
        </div>

        {/* Hero Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-emerald-900 text-white rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/20 text-white border border-white/20">
                  <Trophy size={13} className="text-amber-300" />
                  กระดานเกียรติยศการมีส่วนร่วม
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                กระดานอันดับคะแนน (Leaderboard)
              </h1>
              <p className="text-xs sm:text-sm text-amber-100 mt-1 max-w-xl">
                คะแนนสะสมจากการเข้าร่วมกิจกรรมโรงพยาบาลเถินผ่าน ThaID (คะแนนเท่ากันครองอันดับร่วมกัน)
              </p>
            </div>

            {/* Fiscal Year Selector */}
            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/20">
              <label className="text-[10px] text-amber-200 block mb-1 font-medium">
                เลือกปีงบประมาณ พ.ศ.
              </label>
              <select
                value={selectedFiscalYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="bg-white text-slate-800 text-xs sm:text-sm font-semibold py-1.5 px-3 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-amber-300"
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/20">
              {/* Rank 2 */}
              <div className="order-2 sm:order-1 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 text-center flex flex-col justify-between">
                <div>
                  <span className="text-2xl mb-1 block">🥈</span>
                  <span className="text-xs text-amber-200 block">อันดับ 2</span>
                  <span className="font-bold text-white text-sm block truncate mt-1">
                    {top2 ? top2.name : '-'}
                  </span>
                  <span className="text-[11px] text-amber-100 block truncate">
                    {top2?.department || ''}
                  </span>
                </div>
                <div className="mt-3 font-extrabold text-white text-lg">
                  {top2 ? `${top2.totalPoints} คะแนน` : '-'}
                </div>
              </div>

              {/* Rank 1 (Gold / Middle elevated) */}
              <div className="order-1 sm:order-2 bg-gradient-to-b from-amber-400/30 to-amber-500/20 backdrop-blur-sm rounded-xl p-4 border-2 border-amber-300/60 text-center flex flex-col justify-between transform sm:-translate-y-2 shadow-lg">
                <div>
                  <span className="text-3xl mb-1 block">🥇</span>
                  <span className="text-xs font-bold text-amber-200 uppercase tracking-wider block">
                    อันดับ 1 (ยอดเยี่ยม)
                  </span>
                  <span className="font-extrabold text-white text-base block truncate mt-1">
                    {top1.name}
                  </span>
                  <span className="text-xs text-amber-100 block truncate">
                    {top1.department || ''}
                  </span>
                </div>
                <div className="mt-3 font-black text-amber-200 text-2xl">
                  {top1.totalPoints} <span className="text-xs font-normal text-white">คะแนน</span>
                </div>
              </div>

              {/* Rank 3 */}
              <div className="order-3 bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 text-center flex flex-col justify-between">
                <div>
                  <span className="text-2xl mb-1 block">🥉</span>
                  <span className="text-xs text-amber-200 block">อันดับ 3</span>
                  <span className="font-bold text-white text-sm block truncate mt-1">
                    {top3 ? top3.name : '-'}
                  </span>
                  <span className="text-[11px] text-amber-100 block truncate">
                    {top3?.department || ''}
                  </span>
                </div>
                <div className="mt-3 font-extrabold text-white text-lg">
                  {top3 ? `${top3.totalPoints} คะแนน` : '-'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab Selector & Search Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl">
              <button
                onClick={() => setActiveTab('individual')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'individual'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users size={15} className="inline mr-1.5" />
                อันดับรายบุคคล ({individualList.length})
              </button>
              <button
                onClick={() => setActiveTab('department')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'department'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 size={15} className="inline mr-1.5" />
                อันดับระดับแผนก ({departmentList.length})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือแผนก..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        ) : activeTab === 'individual' ? (
          /* Individual Leaderboard Table */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            {filteredIndividual.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                ยังไม่มีข้อมูลการเข้าร่วมกิจกรรมในปีงบประมาณนี้
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5 w-16 text-center">อันดับ</th>
                      <th className="p-3.5">ชื่อ-สกุล</th>
                      <th className="p-3.5">แผนก/กลุ่มงาน</th>
                      <th className="p-3.5">ตำแหน่ง</th>
                      <th className="p-3.5 text-center">จำนวนกิจกรรม</th>
                      <th className="p-3.5 text-right font-bold">คะแนนสะสม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredIndividual.map((item) => {
                      const isMe = item.memberId === currentMemberId
                      return (
                        <tr
                          key={item.memberId}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isMe ? 'bg-emerald-50/60 font-semibold' : ''
                          }`}
                        >
                          <td className="p-3.5 text-center">
                            {getRankBadge(item.rank)}
                          </td>
                          <td className="p-3.5">
                            <span className="font-semibold text-slate-900 block">
                              {item.name} {isMe && <span className="text-[10px] text-emerald-700 ml-1">(คุณ)</span>}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600">
                            {item.department || 'ไม่ระบุแผนก'}
                          </td>
                          <td className="p-3.5 text-slate-500">
                            {item.position || '-'}
                          </td>
                          <td className="p-3.5 text-center text-slate-600 font-mono">
                            {item.eventCount} งาน
                          </td>
                          <td className="p-3.5 text-right">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-900">
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
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            {filteredDepartment.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                ยังไม่มีข้อมูลคะแนนของแผนกในปีงบประมาณนี้
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5 w-16 text-center">อันดับ</th>
                      <th className="p-3.5">กลุ่มงาน / แผนก</th>
                      <th className="p-3.5 text-center">บุคลากรในแผนก</th>
                      <th className="p-3.5 text-center">คะแนนรวมทั้งหมด</th>
                      <th className="p-3.5 text-right font-bold">คะแนนเฉลี่ยต่อคน</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDepartment.map((dept) => (
                      <tr key={dept.department} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5 text-center">
                          {getRankBadge(dept.rank)}
                        </td>
                        <td className="p-3.5 font-bold text-slate-900">
                          {dept.department}
                        </td>
                        <td className="p-3.5 text-center text-slate-600 font-mono">
                          {dept.memberCount} คน
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
                            {dept.totalPoints} แต้ม
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-900">
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
    </div>
  )
}
