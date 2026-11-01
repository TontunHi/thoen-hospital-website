'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Breadcrumb from '@/components/ui/Breadcrumb'
import {
  Users,
  User,
  Search,
  ChevronRight,
  Loader2,
  X,
  Network,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  MoveHorizontal,
  Building2,
  Crown,
  Layers
} from 'lucide-react'
import { getInitials } from '@/lib/formatters'
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

function countTotalMembersInGroup(node: PublicGroupNode): number {
  let count = node.members.length
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      count += countTotalMembersInGroup(child)
    }
  }
  return count
}

function countTotalSubUnits(node: PublicGroupNode): number {
  let count = node.children ? node.children.length : 0
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      count += countTotalSubUnits(child)
    }
  }
  return count
}

/**
 * Leaf Member Card in the Org Tree
 * Note: If badge === 'เจ้าหน้าที่', the tag is intentionally omitted per user specification.
 */
function OrgTreeMemberLeaf({
  member,
  badge
}: {
  member: PublicMember
  badge?: string
}) {
  const showBadge = Boolean(badge && badge !== 'เจ้าหน้าที่')
  const isDeputy = badge?.includes('รอง')

  return (
    <li>
      <div className="treeMemberCard">
        <div className="treeMemberAvatarWrap">
          {member.imagePath ? (
            <img src={member.imagePath} alt={member.name} className="treeMemberAvatar" />
          ) : (
            <div className="treeMemberAvatarFallback">{getInitials(member.name)}</div>
          )}
        </div>
        {showBadge && (
          <span className={`treeMemberBadge ${isDeputy ? 'deputy' : ''}`}>
            {badge}
          </span>
        )}
        <span className="treeMemberName" title={member.name}>
          {member.name}
        </span>
        <span className="treeMemberPosition" title={member.position}>
          {member.position}
        </span>
      </div>
    </li>
  )
}

/**
 * Recursive Tree Subnode for Org Chart Diagram View
 */
function OrgTreeSubnode({ node }: { node: PublicGroupNode }) {
  const leader = node.members.find((m) => m.role === 'leader')
  const otherLeaders = node.members.filter((m) => m.role === 'leader' && m.id !== leader?.id)
  const staff = node.members.filter((m) => m.role !== 'leader')
  const children = node.children || []

  const hasChildBranches = children.length > 0 || otherLeaders.length > 0 || staff.length > 0

  return (
    <li>
      <div className="treeNodeCard subUnitNode">
        <span className="treeNodeGroupTag" title={node.name}>
          {node.name}
        </span>

        {leader ? (
          <>
            <div className="treeNodeAvatarWrap">
              {leader.imagePath ? (
                <img src={leader.imagePath} alt={leader.name} className="treeNodeAvatar" />
              ) : (
                <div className="treeNodeAvatarFallback">{getInitials(leader.name)}</div>
              )}
            </div>
            <span
              className="publicLeaderBadge"
              style={{ fontSize: '0.7rem', padding: '2px 9px', margin: '0 auto', width: 'fit-content' }}
            >
              หัวหน้างาน
            </span>
            <span className="treeNodeName" title={leader.name}>{leader.name}</span>
            <span className="treeNodePosition" title={leader.position}>{leader.position}</span>
          </>
        ) : (
          <>
            <div
              className="treeNodeAvatarFallback"
              style={{ background: '#f1f5f9', color: '#94a3b8' }}
            >
              <User size={24} />
            </div>
            <span className="treeNodeName" style={{ color: '#64748b', fontSize: '0.85rem' }}>
              เจ้าหน้าที่ผู้ปฏิบัติงาน
            </span>
          </>
        )}
      </div>

      {/* Recursive Child Branches (Subgroups + Deputy Leaders + Staff) */}
      {hasChildBranches && (
        <ul>
          {/* Sub-departments / Sub-units */}
          {children.map((child) => (
            <OrgTreeSubnode key={`group-${child.id}`} node={child} />
          ))}

          {/* Deputy Leaders (if any) */}
          {otherLeaders.map((deputy) => (
            <OrgTreeMemberLeaf
              key={`deputy-${deputy.id}`}
              member={deputy}
              badge="รองหัวหน้างาน"
            />
          ))}

          {/* Regular Staff Members (No tag "เจ้าหน้าที่" rendered) */}
          {staff.map((member) => (
            <OrgTreeMemberLeaf
              key={`staff-${member.id}`}
              member={member}
              badge="เจ้าหน้าที่"
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * Recursive Subgroup Block for Directory Cards View
 */
function PublicSubgroupView({ subgroup, depth = 0 }: { subgroup: PublicGroupNode; depth?: number }) {
  const primaryLeader = subgroup.members.find((m) => m.role === 'leader')
  const deputyLeaders = subgroup.members.filter((m) => m.role === 'leader' && m.id !== primaryLeader?.id)
  const subMembers = subgroup.members.filter((m) => m.role !== 'leader')

  return (
    <div
      key={subgroup.id}
      className="subgroupBlock"
      style={{ marginLeft: depth > 0 ? `${Math.min(depth * 16, 48)}px` : undefined }}
    >
      <div className="subgroupHeader">
        <div className="subgroupIconWrap">
          <Layers size={16} />
        </div>
        <h3>{subgroup.name}</h3>
        <span className="subgroupMemberCount">
          {subgroup.members.length} ท่าน
        </span>
      </div>

      {/* Subgroup Primary Leader */}
      {primaryLeader && (
        <div className="publicLeaderCard" style={{ padding: '16px 20px' }}>
          <div className="publicLeaderAvatarWrap">
            {primaryLeader.imagePath ? (
              <img
                src={primaryLeader.imagePath}
                alt={primaryLeader.name}
                className="publicLeaderAvatar"
                style={{ width: '68px', height: '68px' }}
              />
            ) : (
              <div className="publicAvatarFallback" style={{ width: '68px', height: '68px', fontSize: '1.4rem' }}>
                {getInitials(primaryLeader.name)}
              </div>
            )}
            <span className="publicLeaderCrown" title="หัวหน้างาน">
              <Crown size={12} />
            </span>
          </div>
          <div className="publicLeaderInfo">
            <span className="publicLeaderBadge">
              หัวหน้างาน
            </span>
            <span className="publicLeaderName" style={{ fontSize: '1.15rem' }}>
              {primaryLeader.name}
            </span>
            <span className="publicLeaderPosition">{primaryLeader.position}</span>
          </div>
        </div>
      )}

      {/* Subgroup Deputy Leaders (รองหัวหน้างาน) */}
      {deputyLeaders.map((deputy) => (
        <div key={deputy.id} className="publicLeaderCard publicDeputyCard" style={{ padding: '14px 18px' }}>
          <div className="publicLeaderAvatarWrap">
            {deputy.imagePath ? (
              <img
                src={deputy.imagePath}
                alt={deputy.name}
                className="publicLeaderAvatar"
                style={{ width: '60px', height: '60px' }}
              />
            ) : (
              <div className="publicAvatarFallback" style={{ width: '60px', height: '60px', fontSize: '1.25rem' }}>
                {getInitials(deputy.name)}
              </div>
            )}
          </div>
          <div className="publicLeaderInfo">
            <span className="publicLeaderBadge publicDeputyBadge">
              รองหัวหน้างาน
            </span>
            <span className="publicLeaderName" style={{ fontSize: '1.05rem' }}>
              {deputy.name}
            </span>
            <span className="publicLeaderPosition">{deputy.position}</span>
          </div>
        </div>
      ))}

      {/* Subgroup Regular Members (clean cards without 'เจ้าหน้าที่' tag) */}
      {subMembers.length > 0 && (
        <div className="publicMembersGrid">
          {subMembers.map((member) => (
            <div key={member.id} className="publicMemberCard">
              <div className="publicMemberAvatarWrap">
                {member.imagePath ? (
                  <img
                    src={member.imagePath}
                    alt={member.name}
                    className="publicMemberAvatar"
                  />
                ) : (
                  <div className="publicMemberAvatarFallback">
                    {getInitials(member.name)}
                  </div>
                )}
              </div>
              <div className="publicMemberInfo">
                <span className="publicMemberName" title={member.name}>
                  {member.name}
                </span>
                <span className="publicMemberPosition" title={member.position}>
                  {member.position}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recursive Nested Sub-groups (Depth 2, 3, etc.) */}
      {subgroup.children && subgroup.children.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
          {subgroup.children.map((child) => (
            <PublicSubgroupView key={child.id} subgroup={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrganizationPublicClient() {
  const [orgChart, setOrgChart] = useState<PublicGroupNode[]>([])
  const [selectedRootId, setSelectedRootId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // View mode: 'tree' (Org Chart Diagram) vs 'cards' (Directory Cards View)
  const [viewMode, setViewMode] = useState<'tree' | 'cards'>('tree')
  const [zoom, setZoom] = useState<number>(1)

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
  const rootLeader = selectedRoot ? selectedRoot.members.find((m) => m.role === 'leader') : null
  const otherRootLeaders = selectedRoot
    ? selectedRoot.members.filter((m) => m.role === 'leader' && m.id !== rootLeader?.id)
    : []
  const rootStaff = selectedRoot ? selectedRoot.members.filter((m) => m.role !== 'leader') : []
  const rootChildren = selectedRoot ? selectedRoot.children || [] : []

  const hasRootBranches =
    rootChildren.length > 0 || otherRootLeaders.length > 0 || rootStaff.length > 0

  // Computed totals for selected department
  const selectedDeptTotalMembers = useMemo(() => {
    if (!selectedRoot) return 0
    return countTotalMembersInGroup(selectedRoot)
  }, [selectedRoot])

  const selectedDeptTotalSubUnits = useMemo(() => {
    if (!selectedRoot) return 0
    return countTotalSubUnits(selectedRoot)
  }, [selectedRoot])

  return (
    <div className="publicOrgPage">
      {/* Hero Header without the badge */}
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
          <Search size={20} className="text-emerald-700" />
          <input
            type="text"
            className="orgSearchInput"
            placeholder="ค้นหาบุคลากรตามชื่อ-นามสกุล หรือตำแหน่ง..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clearSearchBtn"
              onClick={() => {
                setSearchQuery('')
                setSearchResults([])
              }}
              aria-label="ล้างคำค้นหา"
            >
              <X size={15} /> <span>ล้างคำค้นหา</span>
            </button>
          )}
          {searching && <Loader2 size={18} className="animate-spin text-emerald-700" />}
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
                <Loader2 size={32} className="animate-spin text-emerald-700" />
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
                    <div className="publicMemberAvatarWrap">
                      {member.imagePath ? (
                        <img
                          src={member.imagePath}
                          alt={member.name}
                          className="publicMemberAvatar"
                        />
                      ) : (
                        <div className="publicMemberAvatarFallback">
                          {getInitials(member.name)}
                        </div>
                      )}
                    </div>
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
                  <Loader2 size={36} className="animate-spin text-emerald-700" />
                  <span>กำลังโหลดโครงสร้างกลุ่มงาน...</span>
                </div>
              </div>
            ) : orgChart.length === 0 ? (
              <div className="deptDisplayCard">
                <div className="publicEmptyState">
                  <User size={48} className="text-slate-300" />
                  <h3>ยังไม่มีข้อมูลโครงสร้างกลุ่มงาน</h3>
                  <p>ระบบยังไม่ได้เพิ่มข้อมูลกลุ่มงานและบุคลากรในขณะนี้</p>
                </div>
              </div>
            ) : (
              <>
                {/* Department Selection Tabs */}
                <div className="deptTabsNav">
                  {orgChart.map((root) => {
                    const isActive = selectedRootId === root.id
                    return (
                      <button
                        key={root.id}
                        type="button"
                        className={`deptTabBtn ${isActive ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedRootId(root.id)
                          setZoom(1)
                        }}
                      >
                        <Building2 size={15} />
                        <span>{root.name}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Selected Department Display */}
                {selectedRoot && (
                  <div className="deptDisplayCard">
                    <div className="deptHeaderRow">
                      <div className="deptTitleBlock">
                        <div className="deptHeaderMain">
                          <h2>{selectedRoot.name}</h2>
                          <div className="deptBadgePillRow">
                            <span className="deptMetaChip">
                              <Users size={12} /> บุคลากรทั้งหมด <strong>{selectedDeptTotalMembers}</strong> ท่าน
                            </span>
                            {selectedDeptTotalSubUnits > 0 && (
                              <span className="deptMetaChip">
                                <Layers size={12} /> <strong>{selectedDeptTotalSubUnits}</strong> หน่วยงานย่อย
                              </span>
                            )}
                          </div>
                        </div>
                        <p>โครงสร้างคณะผู้บริหารและเจ้าหน้าที่ผู้ปฏิบัติงาน ประจำ{selectedRoot.name}</p>
                      </div>
                    </div>

                    {/* View Switcher Toolbar (Tree Diagram vs Directory Cards) */}
                    <div className="viewToggleBar">
                      <div className="viewModePills">
                        <button
                          type="button"
                          className={`viewModeBtn ${viewMode === 'tree' ? 'active' : ''}`}
                          onClick={() => setViewMode('tree')}
                        >
                          <Network size={16} />
                          <span>ผังโครงสร้างองค์กร</span>
                        </button>
                        <button
                          type="button"
                          className={`viewModeBtn ${viewMode === 'cards' ? 'active' : ''}`}
                          onClick={() => setViewMode('cards')}
                        >
                          <LayoutGrid size={16} />
                          <span>รายชื่อแบบการ์ด</span>
                        </button>
                      </div>

                      {viewMode === 'tree' && (
                        <div className="diagramToolbar">
                          <span className="diagramScrollHint">
                            <MoveHorizontal size={14} /> เลื่อนเพื่อดูผังเพิ่มเติม
                          </span>
                          <div className="zoomControls">
                            <button
                              type="button"
                              className="zoomBtn"
                              title="ย่อขนาด"
                              onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(1))))}
                              aria-label="ย่อขนาด"
                            >
                              <ZoomOut size={14} />
                            </button>
                            <button
                              type="button"
                              className="zoomLevelText"
                              title="รีเซ็ตขนาด 100%"
                              onClick={() => setZoom(1)}
                            >
                              {`${Math.round(zoom * 100)}%`}
                            </button>
                            <button
                              type="button"
                              className="zoomBtn"
                              title="ขยายขนาด"
                              onClick={() => setZoom((z) => Math.min(1.2, Number((z + 0.1).toFixed(1))))}
                              aria-label="ขยายขนาด"
                            >
                              <ZoomIn size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ==============================================================
                        VIEW MODE 1: VISUAL TREE DIAGRAM (CSS Tree with Connecting Lines)
                        ============================================================== */}
                    {viewMode === 'tree' ? (
                      <div className="orgDiagramScroll">
                        <div
                          className="orgDiagramCanvas"
                          style={{ transform: `scale(${zoom})` }}
                        >
                          <div className="orgTree">
                            {/* Root Node Card (Head of Department) */}
                            <div className="treeNodeCard rootNode">
                              <span className="treeNodeGroupTag">{selectedRoot.name}</span>

                              {rootLeader ? (
                                <>
                                  <div className="treeNodeAvatarWrap">
                                    {rootLeader.imagePath ? (
                                      <img
                                        src={rootLeader.imagePath}
                                        alt={rootLeader.name}
                                        className="treeNodeAvatar"
                                        style={{ width: '72px', height: '72px' }}
                                      />
                                    ) : (
                                      <div
                                        className="treeNodeAvatarFallback"
                                        style={{ width: '72px', height: '72px', fontSize: '1.5rem' }}
                                      >
                                        {getInitials(rootLeader.name)}
                                      </div>
                                    )}
                                    <span className="treeCrownBadge" title="หัวหน้ากลุ่มงาน">
                                      <Crown size={12} />
                                    </span>
                                  </div>
                                  <span
                                    className="publicLeaderBadge"
                                    style={{
                                      fontSize: '0.75rem',
                                      padding: '3px 12px',
                                      margin: '0 auto',
                                      width: 'fit-content'
                                    }}
                                  >
                                    หัวหน้ากลุ่มงาน
                                  </span>
                                  <span className="treeNodeName" style={{ fontSize: '1.05rem' }}>
                                    {rootLeader.name}
                                  </span>
                                  <span className="treeNodePosition">{rootLeader.position}</span>
                                </>
                              ) : (
                                <>
                                  <div
                                    className="treeNodeAvatarFallback"
                                    style={{ background: '#f1f5f9', color: '#94a3b8' }}
                                  >
                                    <User size={28} />
                                  </div>
                                  <span className="treeNodeName" style={{ color: '#64748b' }}>
                                    ยังไม่ระบุหัวหน้ากลุ่มงาน
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Root Connecting Branches */}
                            {hasRootBranches && (
                              <ul>
                                {/* Sub-departments / Sub-units */}
                                {rootChildren.map((child) => (
                                  <OrgTreeSubnode
                                    key={`group-${child.id}`}
                                    node={child}
                                  />
                                ))}

                                {/* Deputy Leaders (if any) */}
                                {otherRootLeaders.map((deputy) => (
                                  <OrgTreeMemberLeaf
                                    key={`deputy-${deputy.id}`}
                                    member={deputy}
                                    badge="รองหัวหน้ากลุ่มงาน"
                                  />
                                ))}

                                {/* Direct Staff Members of Root Group (No tag "เจ้าหน้าที่" rendered) */}
                                {rootStaff.map((member) => (
                                  <OrgTreeMemberLeaf
                                    key={`staff-${member.id}`}
                                    member={member}
                                    badge="เจ้าหน้าที่"
                                  />
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* ==============================================================
                         VIEW MODE 2: DIRECTORY CARDS (Grouped Lists)
                         ============================================================== */
                      <div className="directoryCardsWrap">
                        {/* Department Leader Highlight */}
                        {rootLeader && (
                          <div className="publicLeaderCard">
                            <div className="publicLeaderAvatarWrap">
                              {rootLeader.imagePath ? (
                                <img
                                  src={rootLeader.imagePath}
                                  alt={rootLeader.name}
                                  className="publicLeaderAvatar"
                                />
                              ) : (
                                <div className="publicAvatarFallback">
                                  {getInitials(rootLeader.name)}
                                </div>
                              )}
                              <span className="publicLeaderCrown" title="หัวหน้ากลุ่มงาน">
                                <Crown size={14} />
                              </span>
                            </div>
                            <div className="publicLeaderInfo">
                              <span className="publicLeaderBadge">
                                หัวหน้ากลุ่มงาน
                              </span>
                              <span className="publicLeaderName">{rootLeader.name}</span>
                              <span className="publicLeaderPosition">{rootLeader.position}</span>
                            </div>
                          </div>
                        )}

                        {/* Department Deputy Leaders (รองหัวหน้ากลุ่มงาน) */}
                        {otherRootLeaders.map((deputy) => (
                          <div key={deputy.id} className="publicLeaderCard publicDeputyCard">
                            <div className="publicLeaderAvatarWrap">
                              {deputy.imagePath ? (
                                <img
                                  src={deputy.imagePath}
                                  alt={deputy.name}
                                  className="publicLeaderAvatar"
                                  style={{ width: '70px', height: '70px' }}
                                />
                              ) : (
                                <div className="publicAvatarFallback" style={{ width: '70px', height: '70px', fontSize: '1.5rem' }}>
                                  {getInitials(deputy.name)}
                                </div>
                              )}
                            </div>
                            <div className="publicLeaderInfo">
                              <span className="publicLeaderBadge publicDeputyBadge">
                                รองหัวหน้ากลุ่มงาน
                              </span>
                              <span className="publicLeaderName">{deputy.name}</span>
                              <span className="publicLeaderPosition">{deputy.position}</span>
                            </div>
                          </div>
                        ))}

                        {/* Department Root Members (Regular) */}
                        {rootStaff.length > 0 && (
                          <div className="directoryMembersSection">
                            <div className="directorySectionTitle">
                              <Users size={16} />
                              <span>เจ้าหน้าที่ประจำกลุ่มงาน ({rootStaff.length} ท่าน)</span>
                            </div>
                            <div className="publicMembersGrid">
                              {rootStaff.map((member) => (
                                <div key={member.id} className="publicMemberCard">
                                  <div className="publicMemberAvatarWrap">
                                    {member.imagePath ? (
                                      <img
                                        src={member.imagePath}
                                        alt={member.name}
                                        className="publicMemberAvatar"
                                      />
                                    ) : (
                                      <div className="publicMemberAvatarFallback">
                                        {getInitials(member.name)}
                                      </div>
                                    )}
                                  </div>
                                  <div className="publicMemberInfo">
                                    <span className="publicMemberName" title={member.name}>
                                      {member.name}
                                    </span>
                                    <span className="publicMemberPosition" title={member.position}>
                                      {member.position}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sub-groups (Recursive Multi-level Tree) */}
                        {selectedRoot.children && selectedRoot.children.length > 0 && (
                          <div className="directorySubgroupsList">
                            {selectedRoot.children.map((subgroup) => (
                              <PublicSubgroupView key={subgroup.id} subgroup={subgroup} depth={0} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!rootLeader &&
                      (!selectedRoot.children || selectedRoot.children.length === 0) &&
                      rootStaff.length === 0 && (
                        <div className="publicEmptyState" style={{ padding: '30px' }}>
                          <Users size={36} className="text-slate-300" />
                          <p>ยังไม่มีข้อมูลในกลุ่มงานนี้</p>
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
