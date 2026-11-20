'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Edit2,
  Layers,
  LayoutGrid,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  buildBuildingSummaries,
  filterInternalPhones,
  splitPhoneNumbers,
} from '@/lib/internalPhones/internalPhoneDomain'
import type {
  InternalPhoneListResult,
  InternalPhoneRecord,
} from '@/lib/internalPhones/internalPhoneTypes'

export interface InternalPhonesClientProps {
  initialData: InternalPhoneListResult
  initialError?: string | null
  canManage: boolean
}

type DirectoryStage = 'building' | 'floor' | 'list'

interface PhoneFormState {
  id: number | null
  building: string
  customBuilding: string
  isCustomBuilding: boolean
  floor: string
  room: string
  phone: string
  note: string
  displayOrder: number
}

const EMPTY_FORM: PhoneFormState = {
  id: null,
  building: 'อาคารร่มฉัตร',
  customBuilding: '',
  isCustomBuilding: false,
  floor: '',
  room: '',
  phone: '',
  note: '',
  displayOrder: 0,
}

export default function InternalPhonesClient({
  initialData,
  initialError = null,
  canManage,
}: InternalPhonesClientProps) {
  const [directory, setDirectory] = useState<InternalPhoneListResult>(initialData)
  const [searchQuery, setSearchQuery] = useState('')
  const [stage, setStage] = useState<DirectoryStage>('building')
  const [buildingFilter, setBuildingFilter] = useState<string>('ALL')
  const [floorFilter, setFloorFilter] = useState<string>('ALL')

  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(initialError)
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Modal state for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [formState, setFormState] = useState<PhoneFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<InternalPhoneRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  // Global "/" search shortcut & Escape to close open modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen && !saving) setIsModalOpen(false)
        if (deleteTarget && !deleting) setDeleteTarget(null)
        return
      }

      if (e.key === '/' && !isModalOpen && !deleteTarget) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
          return
        }
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen, deleteTarget, saving, deleting])

  const refreshDirectory = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/member/internal-phones', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถโหลดข้อมูลเบอร์โทรภายในได้')
      }
      setDirectory(json.data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล'
      setFetchError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  const buildingSummaries = useMemo(
    () => buildBuildingSummaries(directory.items),
    [directory.items]
  )

  const selectedBuildingSummary = useMemo(
    () => buildingSummaries.find((b) => b.building === buildingFilter) ?? null,
    [buildingSummaries, buildingFilter]
  )

  const isSearching = searchQuery.trim().length > 0

  const filteredItems = useMemo(() => {
    if (isSearching) {
      return filterInternalPhones(directory.items, {
        search: searchQuery,
      })
    }
    return filterInternalPhones(directory.items, {
      building: buildingFilter,
      floor: floorFilter,
    })
  }, [directory.items, buildingFilter, floorFilter, searchQuery, isSearching])

  const handleSelectBuilding = (building: string) => {
    if (building === 'ALL') {
      setBuildingFilter('ALL')
      setFloorFilter('ALL')
      setStage('list')
      return
    }

    const summary = buildingSummaries.find((b) => b.building === building)
    setBuildingFilter(building)
    setFloorFilter('ALL')

    // Skip floor selection automatically if building has <= 1 floor choice
    if (summary && summary.requiresFloorSelection) {
      setStage('floor')
    } else {
      setStage('list')
    }
  }

  const handleSelectFloor = (floorKey: string) => {
    setFloorFilter(floorKey)
    setStage('list')
  }

  const handleClearFilters = () => {
    setSearchQuery('')
    setBuildingFilter('ALL')
    setFloorFilter('ALL')
    setStage('building')
  }

  const handleBackToFloors = () => {
    setSearchQuery('')
    setFloorFilter('ALL')
    if (selectedBuildingSummary?.requiresFloorSelection) {
      setStage('floor')
    } else {
      setBuildingFilter('ALL')
      setStage('building')
    }
  }

  const openCreateModal = () => {
    const defaultBuilding =
      buildingFilter !== 'ALL'
        ? buildingFilter
        : directory.buildings[0] || 'อาคารร่มฉัตร'
    const nextOrder =
      directory.items.length > 0
        ? Math.max(...directory.items.map((item) => item.displayOrder)) + 1
        : 1

    setModalMode('create')
    setFormError(null)
    setFormState({
      id: null,
      building: defaultBuilding,
      customBuilding: '',
      isCustomBuilding: directory.buildings.length === 0,
      floor: floorFilter !== 'ALL' && floorFilter !== 'NONE' ? floorFilter : '',
      room: '',
      phone: '',
      note: '',
      displayOrder: nextOrder,
    })
    setIsModalOpen(true)
  }

  const openEditModal = (record: InternalPhoneRecord) => {
    const isKnownBuilding = directory.buildings.includes(record.building)
    setModalMode('edit')
    setFormError(null)
    setFormState({
      id: record.id,
      building: isKnownBuilding ? record.building : '__CUSTOM__',
      customBuilding: isKnownBuilding ? '' : record.building,
      isCustomBuilding: !isKnownBuilding,
      floor: record.floor ?? '',
      room: record.room,
      phone: record.phone,
      note: record.note ?? '',
      displayOrder: record.displayOrder,
    })
    setIsModalOpen(true)
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const resolvedBuilding = formState.isCustomBuilding
      ? formState.customBuilding.trim()
      : formState.building.trim()

    if (!resolvedBuilding || resolvedBuilding === '__CUSTOM__') {
      setFormError('กรุณาระบุชื่ออาคาร')
      return
    }
    if (!formState.room.trim()) {
      setFormError('กรุณาระบุชื่อห้องหรือหน่วยงาน')
      return
    }

    const payload = {
      building: resolvedBuilding,
      floor: formState.floor.trim() || null,
      room: formState.room.trim(),
      phone: formState.phone.trim(),
      note: formState.note.trim() || null,
      displayOrder: Number.isFinite(formState.displayOrder) ? formState.displayOrder : 0,
    }

    setSaving(true)
    try {
      const isEdit = modalMode === 'edit' && formState.id !== null
      const url = isEdit
        ? `/api/member/internal-phones/${formState.id}`
        : '/api/member/internal-phones'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถบันทึกข้อมูลได้')
      }

      setIsModalOpen(false)
      showToast(
        isEdit ? 'แก้ไขข้อมูลเบอร์โทรภายในสำเร็จ' : 'เพิ่มข้อมูลเบอร์โทรภายในสำเร็จ',
        'success'
      )
      await refreshDirectory()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/member/internal-phones/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถลบข้อมูลได้')
      }
      setDeleteTarget(null)
      showToast('ลบรายการเบอร์โทรภายในเรียบร้อยแล้ว', 'success')
      await refreshDirectory()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบข้อมูล', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const currentFloorLabel =
    floorFilter === 'ALL'
      ? 'ทุกชั้น'
      : floorFilter === 'NONE'
        ? 'ไม่ระบุชั้น'
        : `ชั้น ${floorFilter}`

  const effectiveView: DirectoryStage = isSearching ? 'list' : stage

  return (
    <>
      <div
        className={`ipToast ${toast ? 'ipToastVisible' : ''} ${
          toast?.type === 'error' ? 'ipToastError' : 'ipToastSuccess'
        }`}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{toast.text}</span>
          </>
        )}
      </div>

      {/* Top Back Navigation */}
      <div className="ipTopBar">
        <Link href="/member" className="ipBackLink">
          <ArrowLeft size={16} />
          <span>กลับพอร์ทัลสมาชิก</span>
        </Link>
      </div>

      {/* Header */}
      <header className="ipHeader">
        <div className="ipHeaderLeft">
          <h1 className="ipTitle">สมุดเบอร์โทรศัพท์ภายในโรงพยาบาล</h1>
          <p className="ipSubtitle">
            เลือกอาคารและชั้นเพื่อดูเบอร์ต่อภายใน หรือค้นหาชื่อห้อง/เลขเบอร์ได้ทันที
          </p>
        </div>

        <div className="ipHeaderRight">
          <div className="ipSummaryStrip" aria-label="สรุปข้อมูลสมุดโทรศัพท์">
            <div className="ipSummaryItem">
              <span className="ipSummaryValue ipTabular">{directory.stats.totalCount}</span>
              <span className="ipSummaryLabel">จุดบริการ</span>
            </div>
            <span className="ipSummaryDivider" aria-hidden="true" />
            <div className="ipSummaryItem">
              <span className="ipSummaryValue ipTabular">{directory.stats.extensionCount}</span>
              <span className="ipSummaryLabel">เบอร์ต่อ</span>
            </div>
            <span className="ipSummaryDivider" aria-hidden="true" />
            <div className="ipSummaryItem">
              <span className="ipSummaryValue ipTabular">{directory.stats.buildingCount}</span>
              <span className="ipSummaryLabel">อาคาร</span>
            </div>
          </div>

          <div className="ipHeaderActions">
            <button
              type="button"
              className="ipBtn"
              onClick={refreshDirectory}
              disabled={loading}
              aria-label="รีเฟรชข้อมูลเบอร์โทรภายใน"
            >
              <RefreshCw size={16} className={loading ? 'ipSpin' : ''} />
              <span>รีเฟรช</span>
            </button>
            {canManage && (
              <button type="button" className="ipBtn ipBtnPrimary" onClick={openCreateModal}>
                <Plus size={16} />
                <span>เพิ่มเบอร์โทรภายใน</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {fetchError && (
        <div className="ipAlertError" role="alert">
          <AlertTriangle size={18} />
          <span className="ipAlertMessage">{fetchError}</span>
        </div>
      )}

      {/* Search Bar */}
      <section className="ipFilterCard" aria-label="ค้นหาด่วน">
        <div className="ipSearchRow">
          <div className="ipSearchBar">
            <Search size={18} className="ipSearchIcon" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchQuery) {
                  e.stopPropagation()
                  setSearchQuery('')
                }
              }}
              placeholder="ค้นหาด่วน: พิมพ์ชื่อห้อง หน่วยงาน หรือเบอร์ต่อ (เช่น ER, 1100, การเงิน)..."
              aria-label="ค้นหาเบอร์โทรภายใน"
              className="ipSearchInput"
            />
            {searchQuery ? (
              <button
                type="button"
                className="ipClearSearchBtn"
                onClick={() => setSearchQuery('')}
                aria-label="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="ipSearchShortcut" aria-hidden="true">
                /
              </kbd>
            )}
          </div>

          {(isSearching || effectiveView === 'list') && (
            <div className="ipSearchMeta">
              <span className="ipResultCount">
                แสดง <strong className="ipTabular">{filteredItems.length}</strong> จาก{' '}
                <span className="ipTabular">{directory.items.length}</span> รายการ
              </span>
              <button type="button" className="ipClearAllBtn" onClick={handleClearFilters}>
                ล้างตัวกรอง
              </button>
            </div>
          )}
        </div>
      </section>

      {/* STAGE 1: Building Selector (Game-like big cards) */}
      {effectiveView === 'building' && (
        <section className="ipStageSection" aria-label="เลือกอาคาร">
          <div className="ipStageHeader">
            <span className="ipStageStepBadge">ขั้นตอนที่ 1</span>
            <div>
              <h2 className="ipStageTitle">เลือกอาคารที่ต้องการติดต่อ</h2>
              <p className="ipStageSubtitle">
                กดเลือกอาคารด้านล่างเพื่อเข้าดูเบอร์โทรภายใน หากอาคารใดมีชั้นเดียวระบบจะเปิดรายชื่อให้ทันที
              </p>
            </div>
          </div>

          {buildingSummaries.length === 0 ? (
            <div className="ipEmptyState">
              <Building2 size={36} className="ipEmptyIcon" aria-hidden="true" />
              <h3>ยังไม่มีข้อมูลเบอร์โทรภายใน</h3>
              <p>เริ่มต้นด้วยการเพิ่มรายการเบอร์โทรภายในใหม่</p>
            </div>
          ) : (
            <>
              <div className="ipGameGrid ipBuildingGrid">
                {buildingSummaries.map((b) => (
                  <button
                    key={b.building}
                    type="button"
                    className="ipGameCard"
                    onClick={() => handleSelectBuilding(b.building)}
                  >
                    <div className="ipGameCardTop">
                      <div className="ipGameCardIcon" aria-hidden="true">
                        <Building2 size={26} />
                      </div>
                      <span className="ipGamePill">
                        {b.requiresFloorSelection
                          ? `${b.namedFloorCount > 0 ? b.namedFloorCount : b.floorChoices.length} ชั้น`
                          : b.namedFloorCount === 1
                            ? `ชั้น ${b.floorChoices[0].key}`
                            : 'เปิดดูทันที'}
                      </span>
                    </div>

                    <div className="ipGameCardBody">
                      <h3 className="ipGameCardTitle">{b.building}</h3>
                      <p className="ipGameCardMeta">
                        <span className="ipTabular">{b.roomCount}</span> จุดบริการ ·{' '}
                        <span className="ipTabular">{b.extensionCount}</span> เบอร์ต่อ
                      </p>
                    </div>

                    <div className="ipGameCardFooter">
                      <span>{b.requiresFloorSelection ? 'เลือกชั้นถัดไป' : 'ดูเบอร์โทร'}</span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="ipStageFooterAction">
                <button
                  type="button"
                  className="ipBtn"
                  onClick={() => handleSelectBuilding('ALL')}
                >
                  <LayoutGrid size={16} />
                  <span>ดูเบอร์โทรทั้งหมดทุกอาคาร ({directory.stats.totalCount})</span>
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* STAGE 2: Floor Selector (Skipped automatically when <= 1 floor) */}
      {effectiveView === 'floor' && selectedBuildingSummary && (
        <section className="ipStageSection" aria-label="เลือกชั้น">
          <div className="ipStageTopBar">
            <div className="ipStageNavRow">
              <button type="button" className="ipBtn ipBtnSm" onClick={handleClearFilters}>
                <ArrowLeft size={14} />
                <span>เปลี่ยนอาคาร</span>
              </button>
              <div className="ipStageCrumb">
                <span>เลือกอาคาร</span>
                <ChevronRight size={14} aria-hidden="true" />
                <strong>{selectedBuildingSummary.building}</strong>
              </div>
            </div>
          </div>

          <div className="ipStageHeader">
            <span className="ipStageStepBadge">ขั้นตอนที่ 2</span>
            <div>
              <h2 className="ipStageTitle">{selectedBuildingSummary.building} — เลือกชั้น</h2>
              <p className="ipStageSubtitle">กดเลือกชั้นที่ต้องการติดต่อ หรือเลือกดูทุกชั้นในอาคารนี้</p>
            </div>
          </div>

          <div className="ipGameGrid ipFloorGrid">
            {selectedBuildingSummary.floorChoices.map((fc) => (
              <button
                key={fc.key}
                type="button"
                className="ipGameCard"
                onClick={() => handleSelectFloor(fc.key)}
              >
                <div className="ipGameCardTop">
                  <div className="ipFloorNumberBadge" aria-hidden="true">
                    {fc.key === 'NONE' ? <Layers size={22} /> : fc.key}
                  </div>
                  <span className="ipGamePill">
                    <span className="ipTabular">{fc.roomCount}</span> ห้อง/จุด
                  </span>
                </div>

                <div className="ipGameCardBody">
                  <h3 className="ipGameCardTitle">{fc.label}</h3>
                  <p className="ipGameCardPreview">
                    {fc.previewRooms.join(' · ')}
                    {fc.roomCount > fc.previewRooms.length ? ' ...' : ''}
                  </p>
                </div>

                <div className="ipGameCardFooter">
                  <span>ดูเบอร์โทร ({fc.extensionCount} เบอร์)</span>
                  <ChevronRight size={18} aria-hidden="true" />
                </div>
              </button>
            ))}

            <button
              type="button"
              className="ipGameCard ipFloorCardAll"
              onClick={() => handleSelectFloor('ALL')}
            >
              <div className="ipGameCardTop">
                <div className="ipFloorNumberBadge ipFloorAllBadge" aria-hidden="true">
                  <LayoutGrid size={22} />
                </div>
                <span className="ipGamePill">
                  <span className="ipTabular">{selectedBuildingSummary.roomCount}</span> ห้อง/จุด
                </span>
              </div>

              <div className="ipGameCardBody">
                <h3 className="ipGameCardTitle">ดูทุกชั้นในอาคารนี้</h3>
                <p className="ipGameCardPreview">
                  แสดงเบอร์โทรทั้งหมดใน {selectedBuildingSummary.building}
                </p>
              </div>

              <div className="ipGameCardFooter">
                <span>ดูทั้งหมด</span>
                <ChevronRight size={18} aria-hidden="true" />
              </div>
            </button>
          </div>
        </section>
      )}

      {/* STAGE 3: Directory List (or Live Search Results) */}
      {effectiveView === 'list' && (
        <section className="ipStageSection" aria-label="รายการเบอร์โทรภายใน">
          <div className="ipStageTopBar">
            <div className="ipStageNavRow">
              <button type="button" className="ipBtn ipBtnSm" onClick={handleClearFilters}>
                <ArrowLeft size={14} />
                <span>เลือกอาคารใหม่</span>
              </button>
              {!isSearching && selectedBuildingSummary?.requiresFloorSelection && (
                <button type="button" className="ipBtn ipBtnSm" onClick={handleBackToFloors}>
                  <Layers size={14} />
                  <span>เปลี่ยนชั้น</span>
                </button>
              )}
              <div className="ipStageCrumb">
                {isSearching ? (
                  <strong>ผลการค้นหา &ldquo;{searchQuery.trim()}&rdquo;</strong>
                ) : (
                  <>
                    <span>{buildingFilter === 'ALL' ? 'ทุกอาคาร' : buildingFilter}</span>
                    {buildingFilter !== 'ALL' && selectedBuildingSummary?.requiresFloorSelection && (
                      <>
                        <ChevronRight size={14} aria-hidden="true" />
                        <strong>{currentFloorLabel}</strong>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="ipEmptyState">
              <Phone size={36} className="ipEmptyIcon" aria-hidden="true" />
              <h3>ไม่พบข้อมูลเบอร์โทรภายในที่ตรงกับเงื่อนไข</h3>
              <p>ลองเปลี่ยนคำค้นหา หรือกลับไปเลือกอาคารและชั้นใหม่</p>
              <button type="button" className="ipBtn" onClick={handleClearFilters}>
                ล้างตัวกรอง
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="ipTableCard">
                <table className="ipTable">
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>อาคาร</th>
                      <th style={{ width: '9%' }}>ชั้น</th>
                      <th style={{ width: '31%' }}>ห้อง / หน่วยงาน</th>
                      <th style={{ width: canManage ? '20%' : '24%' }}>เบอร์โทรภายใน</th>
                      <th style={{ width: canManage ? '10%' : '16%' }}>หมายเหตุ</th>
                      {canManage && (
                        <th className="ipThRight" style={{ width: '10%' }}>
                          จัดการ
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const extensions = splitPhoneNumbers(item.phone)
                      return (
                        <tr key={item.id}>
                          <td>
                            <span className="ipBuildingTag">{item.building}</span>
                          </td>
                          <td className="ipFloorCell">
                            {item.floor ? `ชั้น ${item.floor}` : <span className="ipMutedText">-</span>}
                          </td>
                          <td className="ipRoomCell">{item.room}</td>
                          <td>
                            {extensions.length > 0 ? (
                              <div className="ipExtList">
                                {extensions.map((ext) => (
                                  <span key={ext} className="ipExtTag">
                                    {ext}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="ipPendingTag">รอระบุเบอร์</span>
                            )}
                          </td>
                          <td className="ipNoteCell">
                            {item.note || <span className="ipMutedText">-</span>}
                          </td>
                          {canManage && (
                            <td>
                              <div className="ipRowActions">
                                <button
                                  type="button"
                                  className="ipActionBtn"
                                  onClick={() => openEditModal(item)}
                                  aria-label={`แก้ไข ${item.room}`}
                                  title="แก้ไขรายการ"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="ipActionBtn ipActionDelete"
                                  onClick={() => setDeleteTarget(item)}
                                  aria-label={`ลบ ${item.room}`}
                                  title="ลบรายการ"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="ipMobileList">
                {filteredItems.map((item) => {
                  const extensions = splitPhoneNumbers(item.phone)
                  return (
                    <article key={item.id} className="ipMobileCard">
                      <div className="ipMobileCardTop">
                        <div className="ipMobileMeta">
                          <span className="ipBuildingTag">{item.building}</span>
                          {item.floor && <span className="ipMobileFloor">ชั้น {item.floor}</span>}
                        </div>
                        {canManage && (
                          <div className="ipRowActions">
                            <button
                              type="button"
                              className="ipActionBtn"
                              onClick={() => openEditModal(item)}
                              aria-label={`แก้ไข ${item.room}`}
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              className="ipActionBtn ipActionDelete"
                              onClick={() => setDeleteTarget(item)}
                              aria-label={`ลบ ${item.room}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                      <h3 className="ipMobileRoom">{item.room}</h3>
                      {item.note && <p className="ipMobileNote">หมายเหตุ: {item.note}</p>}
                      <div className="ipExtList">
                        {extensions.length > 0 ? (
                          extensions.map((ext) => (
                            <span key={ext} className="ipExtTag">
                              {ext}
                            </span>
                          ))
                        ) : (
                          <span className="ipPendingTag">รอระบุเบอร์</span>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          className="ipModalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ip-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) setIsModalOpen(false)
          }}
        >
          <div className="ipModalCard">
            <div className="ipModalHeader">
              <h2 id="ip-modal-title">
                {modalMode === 'create' ? 'เพิ่มเบอร์โทรภายในใหม่' : 'แก้ไขข้อมูลเบอร์โทรภายใน'}
              </h2>
              <button
                type="button"
                className="ipModalCloseBtn"
                onClick={() => !saving && setIsModalOpen(false)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="ipModalForm">
              {formError && (
                <div className="ipAlertError" role="alert">
                  <AlertCircle size={16} />
                  <span className="ipAlertMessage">{formError}</span>
                </div>
              )}

              <div className="ipFormGroup">
                <label htmlFor="ip-building-select">
                  อาคาร <span className="ipRequired">*</span>
                </label>
                <select
                  id="ip-building-select"
                  value={formState.isCustomBuilding ? '__CUSTOM__' : formState.building}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '__CUSTOM__') {
                      setFormState((prev) => ({
                        ...prev,
                        building: '__CUSTOM__',
                        isCustomBuilding: true,
                      }))
                    } else {
                      setFormState((prev) => ({
                        ...prev,
                        building: val,
                        isCustomBuilding: false,
                        customBuilding: '',
                      }))
                    }
                  }}
                >
                  {directory.buildings.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                  <option value="__CUSTOM__">+ ระบุชื่ออาคารใหม่...</option>
                </select>
              </div>

              {formState.isCustomBuilding && (
                <div className="ipFormGroup">
                  <label htmlFor="ip-building-custom">
                    ชื่ออาคารใหม่ <span className="ipRequired">*</span>
                  </label>
                  <input
                    id="ip-building-custom"
                    type="text"
                    value={formState.customBuilding}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, customBuilding: e.target.value }))
                    }
                    placeholder="เช่น อาคารผู้ป่วยนอก, อาคารพัสดุ"
                    required
                  />
                </div>
              )}

              <div className="ipFormRow">
                <div className="ipFormGroup">
                  <label htmlFor="ip-floor">ชั้น</label>
                  <input
                    id="ip-floor"
                    type="text"
                    value={formState.floor}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, floor: e.target.value }))
                    }
                    placeholder="เช่น 1, 2, 3 (เว้นว่างได้)"
                  />
                </div>
                <div className="ipFormGroup">
                  <label htmlFor="ip-order">ลำดับการแสดงผล</label>
                  <input
                    id="ip-order"
                    type="number"
                    min={0}
                    max={99999}
                    value={formState.displayOrder}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        displayOrder: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="ipFormGroup">
                <label htmlFor="ip-room">
                  ห้อง / หน่วยงาน <span className="ipRequired">*</span>
                </label>
                <input
                  id="ip-room"
                  type="text"
                  value={formState.room}
                  onChange={(e) => setFormState((prev) => ({ ...prev, room: e.target.value }))}
                  placeholder="เช่น ER / ฉุกเฉิน, งานยุทธศาสตร์ งาน IT"
                  required
                />
              </div>

              <div className="ipFormGroup">
                <label htmlFor="ip-phone">เบอร์โทรภายใน</label>
                <input
                  id="ip-phone"
                  type="text"
                  value={formState.phone}
                  onChange={(e) => setFormState((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="เช่น 1100 หรือ 1100, 1101 (คั่นด้วยจุลภาค)"
                />
              </div>

              <div className="ipFormGroup">
                <label htmlFor="ip-note">หมายเหตุ</label>
                <input
                  id="ip-note"
                  type="text"
                  value={formState.note}
                  onChange={(e) => setFormState((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="เช่น ซักประวัติ, เครื่อง FAX, ผู้ประสานงาน"
                />
              </div>

              <div className="ipModalFooter">
                <button
                  type="button"
                  className="ipBtn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  ยกเลิก
                </button>
                <button type="submit" className="ipBtn ipBtnPrimary" disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : modalMode === 'create' ? 'เพิ่มรายการ' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="ipModalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ip-delete-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) setDeleteTarget(null)
          }}
        >
          <div className="ipModalCard ipModalSmall">
            <div className="ipModalHeader">
              <h2 id="ip-delete-title">ยืนยันการลบข้อมูล</h2>
              <button
                type="button"
                className="ipModalCloseBtn"
                onClick={() => !deleting && setDeleteTarget(null)}
                aria-label="ปิดหน้าต่าง"
              >
                <X size={20} />
              </button>
            </div>
            <div className="ipDeleteBody">
              <div className="ipDeleteIcon" aria-hidden="true">
                <AlertTriangle size={26} />
              </div>
              <p>
                ต้องการลบรายการ <strong>{deleteTarget.room}</strong> (
                {deleteTarget.building}
                {deleteTarget.floor ? ` ชั้น ${deleteTarget.floor}` : ''})
                {deleteTarget.phone ? ` เบอร์ ${deleteTarget.phone}` : ''} ออกจากสมุดโทรศัพท์ใช่หรือไม่?
              </p>
            </div>
            <div className="ipModalFooter">
              <button
                type="button"
                className="ipBtn"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="ipBtn ipBtnDanger"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
