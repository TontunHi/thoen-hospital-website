'use client'

import React, { useState, useEffect } from 'react'
import Breadcrumb from '@/components/ui/Breadcrumb'
import {
  Users,
  Shield,
  Search,
  Building2,
  ChevronRight,
  Loader2,
  X
} from 'lucide-react'
import './page.css'

interface PublicMember {
  id: number
  groupId: number
  name: string
  position: string
  role: 'leader' | 'member'
  orderIndex: number
  imagePath: string | null
  groupName?: string
}

interface PublicGroupNode {
  id: number
  name: string
  parentId: number | null
  orderIndex: number
  members: PublicMember[]
  children: PublicGroupNode[]
}

export default function OrganizationPublicClient() {
  const [orgChart, setOrgChart] = useState<PublicGroupNode[]>([])
  const [selectedRootId, setSelectedRootId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PublicMember[]>([])
  const [searching, setSearching] = useState(false)

  // Fetch full org chart
  useEffect(() => {
    const fetchOrgChart = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/departments/public')
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setOrgChart(json.data)
          if (json.data.length > 0) {
            setSelectedRootId(json.data[0].id)
          }
        }
      } catch (err) {
        console.error('Failed to load public org chart:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchOrgChart()
  }, [])

  // Debounced search
  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed || trimmed.length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true)
        const res = await fetch(`/api/departments/public/search?q=${encodeURIComponent(trimmed)}`)
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setSearchResults(json.data)
        }
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setSearching(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const selectedRoot = orgChart.find((g) => g.id === selectedRootId) || orgChart[0]

  return (
    <div className="publicOrgPage">
      {/* Hero Header */}
      <section className="orgHero">
        <div className="orgHeroContainer">
          <Breadcrumb
            variant="light"
            items={[
              { label: 'เกี่ยวกับเรา', href: '/about' },
              { label: 'โครงสร้างกลุ่มงานและบุคลากร' }
            ]}
          />
          <h1 className="orgHeroTitle">โครงสร้างกลุ่มงานและบุคลากร</h1>
          <p className="orgHeroDesc">
            คณะผู้บริหาร หัวหน้ากลุ่มงาน และบุคลากรผู้ปฏิบัติงาน โรงพยาบาลเถิน
            มุ่งมั่นให้บริการดูแลสุขภาพประชาชนอย่างมีมาตรฐาน ปลอดภัย และโปร่งใส
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="orgContentContainer">
        {/* Instant Search Bar */}
        <div className="orgSearchCard">
          <Search size={20} className="text-emerald-600" />
          <input
            type="text"
            className="orgSearchInput"
            placeholder="ค้นหาบุคลากรตามชื่อ-นามสกุล หรือตำแหน่ง..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="clearSearchBtn"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={() => {
                setSearchQuery('')
                setSearchResults([])
              }}
            >
              <X size={16} /> ล้างคำค้นหา
            </button>
          )}
          {searching && <Loader2 size={18} className="animate-spin text-emerald-600" />}
        </div>

        {/* If Search Active: Show Search Results */}
        {searchQuery.trim().length >= 2 ? (
          <div className="searchResultsBlock">
            <div className="searchResultsHeader">
              <span>
                ผลการค้นหาสำหรับ &quot;<strong>{searchQuery}</strong>&quot; ({searchResults.length} ท่าน)
              </span>
            </div>

            {searching ? (
              <div className="publicEmptyState">
                <Loader2 size={32} className="animate-spin text-emerald-600" />
                <span>กำลังค้นหาข้อมูล...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="publicEmptyState">
                <Users size={48} className="text-slate-300" />
                <p>ไม่พบบุคลากรที่ตรงกับคำค้นหา &quot;{searchQuery}&quot;</p>
              </div>
            ) : (
              <div className="publicMembersGrid">
                {searchResults.map((member) => (
                  <div key={member.id} className="publicMemberCard">
                    {member.imagePath ? (
                      <img
                        src={member.imagePath}
                        alt={member.name}
                        className="publicMemberAvatar"
                      />
                    ) : (
                      <div className="publicMemberAvatarFallback">
                        {member.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="publicMemberInfo">
                      <span className="publicMemberName" title={member.name}>
                        {member.name}
                      </span>
                      <span className="publicMemberPosition">
                        {member.position}
                      </span>
                      {member.groupName && (
                        <span className="publicMemberDeptBadge">
                          {member.groupName}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Normal Directory Browsing */
          <>
            {loading ? (
              <div className="deptDisplayCard">
                <div className="publicEmptyState">
                  <Loader2 size={36} className="animate-spin text-emerald-600" />
                  <span>กำลังโหลดโครงสร้างกลุ่มงาน...</span>
                </div>
              </div>
            ) : orgChart.length === 0 ? (
              <div className="deptDisplayCard">
                <div className="publicEmptyState">
                  <Building2 size={48} className="text-slate-300" />
                  <h3>ยังไม่มีข้อมูลโครงสร้างกลุ่มงาน</h3>
                  <p>ระบบยังไม่ได้เพิ่มข้อมูลกลุ่มงานและบุคลากรในขณะนี้</p>
                </div>
              </div>
            ) : (
              <>
                {/* Department Selection Tabs */}
                <div className="deptTabsNav">
                  {orgChart.map((root) => (
                    <button
                      key={root.id}
                      className={`deptTabBtn ${selectedRootId === root.id ? 'active' : ''}`}
                      onClick={() => setSelectedRootId(root.id)}
                    >
                      <Building2 size={16} />
                      {root.name}
                    </button>
                  ))}
                </div>

                {/* Selected Department Display */}
                {selectedRoot && (
                  <div className="deptDisplayCard">
                    <div className="deptHeaderRow">
                      <div className="deptTitleBlock">
                        <h2>{selectedRoot.name}</h2>
                        <p>โครงสร้างคณะผู้บริหารและเจ้าหน้าที่ผู้ปฏิบัติงาน</p>
                      </div>
                    </div>

                    {/* Department Leader Highlight */}
                    {selectedRoot.members.filter((m) => m.role === 'leader').map((leader) => (
                      <div key={leader.id} className="publicLeaderCard">
                        {leader.imagePath ? (
                          <img
                            src={leader.imagePath}
                            alt={leader.name}
                            className="publicLeaderAvatar"
                          />
                        ) : (
                          <div className="publicAvatarFallback">
                            {leader.name.slice(0, 1)}
                          </div>
                        )}
                        <div className="publicLeaderInfo">
                          <span className="publicLeaderBadge">
                            <Shield size={12} />
                            หัวหน้ากลุ่มงาน
                          </span>
                          <span className="publicLeaderName">{leader.name}</span>
                          <span className="publicLeaderPosition">{leader.position}</span>
                        </div>
                      </div>
                    ))}

                    {/* Department Root Members (Regular) */}
                    {selectedRoot.members.filter((m) => m.role !== 'leader').length > 0 && (
                      <div className="publicMembersGrid">
                        {selectedRoot.members
                          .filter((m) => m.role !== 'leader')
                          .map((member) => (
                            <div key={member.id} className="publicMemberCard">
                              {member.imagePath ? (
                                <img
                                  src={member.imagePath}
                                  alt={member.name}
                                  className="publicMemberAvatar"
                                />
                              ) : (
                                <div className="publicMemberAvatarFallback">
                                  {member.name.slice(0, 1)}
                                </div>
                              )}
                              <div className="publicMemberInfo">
                                <span className="publicMemberName" title={member.name}>
                                  {member.name}
                                </span>
                                <span className="publicMemberPosition">
                                  {member.position}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Sub-groups (งานย่อย / หน่วยงานย่อย) */}
                    {selectedRoot.children && selectedRoot.children.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {selectedRoot.children.map((subgroup) => {
                          const subLeaders = subgroup.members.filter((m) => m.role === 'leader')
                          const subMembers = subgroup.members.filter((m) => m.role !== 'leader')

                          return (
                            <div key={subgroup.id} className="subgroupBlock">
                              <div className="subgroupHeader">
                                <ChevronRight size={18} className="text-emerald-600" />
                                <h3>{subgroup.name}</h3>
                              </div>

                              {/* Subgroup Leader */}
                              {subLeaders.map((leader) => (
                                <div key={leader.id} className="publicLeaderCard" style={{ padding: '16px 20px' }}>
                                  {leader.imagePath ? (
                                    <img
                                      src={leader.imagePath}
                                      alt={leader.name}
                                      className="publicLeaderAvatar"
                                      style={{ width: '72px', height: '72px' }}
                                    />
                                  ) : (
                                    <div className="publicAvatarFallback" style={{ width: '72px', height: '72px', fontSize: '1.5rem' }}>
                                      {leader.name.slice(0, 1)}
                                    </div>
                                  )}
                                  <div className="publicLeaderInfo">
                                    <span className="publicLeaderBadge">
                                      <Shield size={11} />
                                      หัวหน้างาน
                                    </span>
                                    <span className="publicLeaderName" style={{ fontSize: '1.15rem' }}>
                                      {leader.name}
                                    </span>
                                    <span className="publicLeaderPosition">{leader.position}</span>
                                  </div>
                                </div>
                              ))}

                              {/* Subgroup Regular Members */}
                              {subMembers.length > 0 ? (
                                <div className="publicMembersGrid">
                                  {subMembers.map((member) => (
                                    <div key={member.id} className="publicMemberCard">
                                      {member.imagePath ? (
                                        <img
                                          src={member.imagePath}
                                          alt={member.name}
                                          className="publicMemberAvatar"
                                        />
                                      ) : (
                                        <div className="publicMemberAvatarFallback">
                                          {member.name.slice(0, 1)}
                                        </div>
                                      )}
                                      <div className="publicMemberInfo">
                                        <span className="publicMemberName" title={member.name}>
                                          {member.name}
                                        </span>
                                        <span className="publicMemberPosition">
                                          {member.position}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                subLeaders.length === 0 && (
                                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
                                    ยังไม่มีรายชื่อสมาชิกในหน่วยงานย่อยนี้
                                  </p>
                                )
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {selectedRoot.members.length === 0 &&
                      (!selectedRoot.children || selectedRoot.children.length === 0) && (
                        <div className="publicEmptyState" style={{ padding: '30px' }}>
                          <Users size={36} className="text-slate-300" />
                          <p>ยังไม่มีรายชื่อบุคลากรในกลุ่มงานนี้</p>
                        </div>
                      )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
