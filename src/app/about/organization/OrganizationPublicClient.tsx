'use client'

import React, { useState, useEffect } from 'react'
import Breadcrumb from '@/components/ui/Breadcrumb'
import {
  Users,
  User,
  Shield,
  Search,
  ChevronRight,
  Loader2,
  X,
  Network,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  MoveHorizontal
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

/**
 * Leaf Member Card in the Org Tree with its own connecting branch line
 */
function OrgTreeMemberLeaf({
  member,
  badge = 'เจ้าหน้าที่'
}: {
  member: PublicMember
  badge?: string
}) {
  return (
    <li>
      <div className="treeMemberCard">
        {member.imagePath ? (
          <img src={member.imagePath} alt={member.name} className="treeMemberAvatar" />
        ) : (
          <div className="treeMemberAvatarFallback">{member.name.slice(0, 1)}</div>
        )}
        <span className={`treeMemberBadge ${badge.includes('รอง') ? 'deputy' : ''}`}>
          {badge}
        </span>
        <span className="treeMemberName" title={member.name}>
          {member.name}
        </span>
        <span className="treeMemberPosition">{member.position}</span>
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

  const hasChildBranches = children.length > 0 || staff.length > 0 || otherLeaders.length > 0

  return (
    <li>
      <div className="treeNodeCard subUnitNode">
        <span className="treeNodeGroupTag" title={node.name}>
          {node.name}
        </span>

        {leader ? (
          <>
            {leader.imagePath ? (
              <img src={leader.imagePath} alt={leader.name} className="treeNodeAvatar" />
            ) : (
              <div className="treeNodeAvatarFallback">{leader.name.slice(0, 1)}</div>
            )}
            <span
              className="publicLeaderBadge"
              style={{ fontSize: '0.65rem', padding: '2px 8px', margin: '0 auto', width: 'fit-content' }}
            >
              <Shield size={10} /> หัวหน้างาน
            </span>
            <span className="treeNodeName">{leader.name}</span>
            <span className="treeNodePosition">{leader.position}</span>
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

      {/* Recursive Child Branches (Subgroups + Individual Staff with Connecting Lines) */}
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

          {/* Staff Members as Individual Leaf Cards with connecting lines */}
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
  const subLeaders = subgroup.members.filter((m) => m.role === 'leader')
  const subMembers = subgroup.members.filter((m) => m.role !== 'leader')

  return (
    <div
      key={subgroup.id}
      className="subgroupBlock"
      style={{ marginLeft: depth > 0 ? `${Math.min(depth * 18, 54)}px` : undefined }}
    >
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
        subLeaders.length === 0 && (!subgroup.children || subgroup.children.length === 0) && (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
            ยังไม่มีรายชื่อสมาชิกในหน่วยงานย่อยนี้
          </p>
        )
      )}

      {/* Recursive Nested Sub-groups (Depth 2, 3, etc.) */}
      {subgroup.children && subgroup.children.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
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
    rootChildren.length > 0 || rootStaff.length > 0 || otherRootLeaders.length > 0

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
                  <User size={48} className="text-slate-300" />
                  <h3>ยังไม่มีข้อมูลโครงสร้างกลุ่มงาน</h3>
                  <p>ระบบยังไม่ได้เพิ่มข้อมูลกลุ่มงานและบุคลากรในขณะนี้</p>
                </div>
              </div>
            ) : (
              <>
                {/* Department Selection Tabs (Clean without group icon) */}
                <div className="deptTabsNav">
                  {orgChart.map((root) => (
                    <button
                      key={root.id}
                      className={`deptTabBtn ${selectedRootId === root.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedRootId(root.id)
                        setZoom(1)
                      }}
                    >
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

                    {/* View Switcher Toolbar (Tree Diagram vs Directory Cards) */}
                    <div className="viewToggleBar">
                      <div className="viewModePills">
                        <button
                          type="button"
                          className={`viewModeBtn ${viewMode === 'tree' ? 'active' : ''}`}
                          onClick={() => setViewMode('tree')}
                        >
                          <Network size={16} />
                          ผังโครงสร้างองค์กร
                        </button>
                        <button
                          type="button"
                          className={`viewModeBtn ${viewMode === 'cards' ? 'active' : ''}`}
                          onClick={() => setViewMode('cards')}
                        >
                          <LayoutGrid size={16} />
                          รายชื่อแบบการ์ด
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
                            >
                              <ZoomOut size={14} />
                            </button>
                            <button
                              type="button"
                              className="zoomLevelText"
                              title="รีเซ็ตขนาด 100%"
                              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                              onClick={() => setZoom(1)}
                            >
                              {`${Math.round(zoom * 100)}%`}
                            </button>
                            <button
                              type="button"
                              className="zoomBtn"
                              title="ขยายขนาด"
                              onClick={() => setZoom((z) => Math.min(1.2, Number((z + 0.1).toFixed(1))))}
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
                                  {rootLeader.imagePath ? (
                                    <img
                                      src={rootLeader.imagePath}
                                      alt={rootLeader.name}
                                      className="treeNodeAvatar"
                                      style={{ width: '70px', height: '70px' }}
                                    />
                                  ) : (
                                    <div
                                      className="treeNodeAvatarFallback"
                                      style={{ width: '70px', height: '70px', fontSize: '1.5rem' }}
                                    >
                                      {rootLeader.name.slice(0, 1)}
                                    </div>
                                  )}
                                  <span
                                    className="publicLeaderBadge"
                                    style={{
                                      fontSize: '0.7rem',
                                      padding: '2px 8px',
                                      margin: '0 auto',
                                      width: 'fit-content'
                                    }}
                                  >
                                    <Shield size={10} /> หัวหน้ากลุ่มงาน
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

                            {/* Root Connecting Branches: โยงลงมายังงานย่อย และเจ้าหน้าที่ผู้ปฏิบัติงานแต่ละคน! */}
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

                                {/* Direct Staff Members of Root Group */}
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
                      <>
                        {/* Department Leader Highlight */}
                        {rootLeader && (
                          <div className="publicLeaderCard">
                            {rootLeader.imagePath ? (
                              <img
                                src={rootLeader.imagePath}
                                alt={rootLeader.name}
                                className="publicLeaderAvatar"
                              />
                            ) : (
                              <div className="publicAvatarFallback">
                                {rootLeader.name.slice(0, 1)}
                              </div>
                            )}
                            <div className="publicLeaderInfo">
                              <span className="publicLeaderBadge">
                                <Shield size={12} />
                                หัวหน้ากลุ่มงาน
                              </span>
                              <span className="publicLeaderName">{rootLeader.name}</span>
                              <span className="publicLeaderPosition">{rootLeader.position}</span>
                            </div>
                          </div>
                        )}

                        {/* Department Root Members (Regular) */}
                        {rootStaff.length > 0 && (
                          <div className="publicMembersGrid">
                            {rootStaff.map((member) => (
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

                        {/* Sub-groups (Recursive Multi-level Tree) */}
                        {selectedRoot.children && selectedRoot.children.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {selectedRoot.children.map((subgroup) => (
                              <PublicSubgroupView key={subgroup.id} subgroup={subgroup} depth={0} />
                            ))}
                          </div>
                        )}
                      </>
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
