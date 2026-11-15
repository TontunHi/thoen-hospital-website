'use client'

import React, { useState } from 'react'
import { Plus, Trash2, X, Check } from 'lucide-react'
import {
  DM_OPTION_CATEGORY_META,
  type DmOptionCategory,
  type DmRemissionOptionRecord,
} from '@/lib/clinical/dmRemissionTypes'

interface DmRemissionSettingsModalProps {
  isOpen: boolean
  options: Record<DmOptionCategory, DmRemissionOptionRecord[]>
  onClose: () => void
  onChanged: () => Promise<void> | void
}

const CATEGORIES: DmOptionCategory[] = ['remission', 'diet', 'exercise', 'if_fasting', 'pcu']

export default function DmRemissionSettingsModal({
  isOpen,
  options,
  onClose,
  onChanged,
}: DmRemissionSettingsModalProps) {
  const [activeCategory, setActiveCategory] = useState<DmOptionCategory>('remission')
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingLabel, setEditingLabel] = useState('')

  if (!isOpen) return null

  const currentItems = options[activeCategory] || []
  const meta = DM_OPTION_CATEGORY_META[activeCategory]

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newLabel.trim()
    if (!trimmed) return

    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/service/dm-remission/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: activeCategory,
          label: trimmed,
          sortOrder: currentItems.length,
          isActive: true,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถเพิ่มตัวเลือกได้')
      }
      setNewLabel('')
      await onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเพิ่มตัวเลือก')
    } finally {
      setBusy(false)
    }
  }

  const handleToggleActive = async (opt: DmRemissionOptionRecord) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/service/dm-remission/options/${opt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !opt.isActive }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถปรับสถานะตัวเลือกได้')
      }
      await onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการแก้ไขตัวเลือก')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveRename = async (opt: DmRemissionOptionRecord) => {
    const trimmed = editingLabel.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/service/dm-remission/options/${opt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: trimmed }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถแก้ไขชื่อตัวเลือกได้')
      }
      setEditingId(null)
      await onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการแก้ไขตัวเลือก')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (opt: DmRemissionOptionRecord) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/service/dm-remission/options/${opt.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'ไม่สามารถลบตัวเลือกได้')
      }
      await onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบตัวเลือก')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dmrModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="dmr-settings-title">
      <div className="dmrModal dmrModalSm">
        <div className="dmrModalHeader">
          <h2 id="dmr-settings-title" className="dmrModalTitle">
            ตั้งค่าตัวเลือก Dropdown (Admin)
          </h2>
          <button type="button" className="dmrBtn dmrBtnSm" onClick={onClose} aria-label="ปิดหน้าต่างตั้งค่า">
            <X size={16} />
          </button>
        </div>

        <div className="dmrModalBody">
          <div className="dmrTabGroup dmrSettingsTabs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`dmrTabBtn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategory(cat)
                  setEditingId(null)
                  setError(null)
                }}
              >
                {DM_OPTION_CATEGORY_META[cat].label}
              </button>
            ))}
          </div>

          <div className="dmrModalDesc">
            {meta.description}
          </div>

          {error && <div className="dmrAlert dmrAlertError">{error}</div>}

          <form onSubmit={handleAdd} className="dmrHnRow">
            <input
              type="text"
              className="dmrInput"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={`เพิ่มตัวเลือกในหมวด ${meta.label}`}
              disabled={busy}
            />
            <button type="submit" className="dmrBtn dmrBtnPrimary" disabled={busy || !newLabel.trim()}>
              <Plus size={16} strokeWidth={1.5} />
              เพิ่ม
            </button>
          </form>

          {currentItems.length === 0 ? (
            <div className="dmrEmpty dmrEmptyCompact">
              ยังไม่มีตัวเลือกในหมวดนี้
            </div>
          ) : (
            <div className="dmrOptionList">
              {currentItems.map((opt) => (
                <div
                  key={opt.id}
                  className={`dmrOptionRow ${opt.isActive ? '' : 'dmrOptionRowInactive'}`}
                >
                  {editingId === opt.id ? (
                    <div className="dmrHnRow dmrFlex1">
                      <input
                        type="text"
                        className="dmrInput"
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        disabled={busy}
                      />
                      <button
                        type="button"
                        className="dmrBtn dmrBtnPrimary dmrBtnSm"
                        onClick={() => handleSaveRename(opt)}
                        disabled={busy}
                      >
                        <Check size={14} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        className="dmrBtn dmrBtnSm"
                        onClick={() => setEditingId(null)}
                        disabled={busy}
                      >
                        <X size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span
                        className={`dmrOptionLabel ${opt.isActive ? '' : 'dmrOptionLabelInactive'}`}
                      >
                        {opt.label}
                      </span>
                      <div className="dmrOptionActions">
                        <button
                          type="button"
                          className="dmrBtn dmrBtnSm"
                          onClick={() => {
                            setEditingId(opt.id)
                            setEditingLabel(opt.label)
                          }}
                          disabled={busy}
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          className="dmrBtn dmrBtnSm"
                          onClick={() => handleToggleActive(opt)}
                          disabled={busy}
                        >
                          {opt.isActive ? 'ซ่อน' : 'เปิดใช้'}
                        </button>
                        <button
                          type="button"
                          className="dmrBtn dmrBtnDanger dmrBtnSm"
                          onClick={() => handleDelete(opt)}
                          disabled={busy}
                          aria-label={`ลบตัวเลือก ${opt.label}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dmrModalFooter">
          <button type="button" className="dmrBtn" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}
