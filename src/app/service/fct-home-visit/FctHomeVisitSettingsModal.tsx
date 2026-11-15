'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, X, Check } from 'lucide-react'
import {
  FCT_ALL_OPTION_CATEGORIES,
  FCT_OPTION_CATEGORY_META,
  type FctHomeVisitOptionRecord,
  type FctOptionCategory,
} from '@/lib/clinical/fctHomeVisitTypes'

interface FctHomeVisitSettingsModalProps {
  isOpen: boolean
  options: Record<FctOptionCategory, FctHomeVisitOptionRecord[]>
  onClose: () => void
  onChanged: () => Promise<void> | void
}

function getApiErrorMessage(json: unknown, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback
  const err = (json as { error?: unknown }).error
  if (typeof err === 'string' && err.trim()) return err
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return fallback
}

export default function FctHomeVisitSettingsModal({
  isOpen,
  options,
  onClose,
  onChanged,
}: FctHomeVisitSettingsModalProps) {
  const [activeCategory, setActiveCategory] = useState<FctOptionCategory>('pcu')
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingLabel, setEditingLabel] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, busy, onClose])

  if (!isOpen) return null

  const currentItems = options[activeCategory] || []
  const meta = FCT_OPTION_CATEGORY_META[activeCategory]

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newLabel.trim()
    if (!trimmed) return

    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/service/fct-home-visit/options', {
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
        throw new Error(getApiErrorMessage(json, 'ไม่สามารถเพิ่มตัวเลือกได้'))
      }
      setNewLabel('')
      await onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเพิ่มตัวเลือก')
    } finally {
      setBusy(false)
    }
  }

  const handleToggleActive = async (opt: FctHomeVisitOptionRecord) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/service/fct-home-visit/options/${opt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !opt.isActive }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(getApiErrorMessage(json, 'ไม่สามารถปรับสถานะตัวเลือกได้'))
      }
      await onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการแก้ไขตัวเลือก')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveRename = async (opt: FctHomeVisitOptionRecord) => {
    const trimmed = editingLabel.trim()
    if (!trimmed) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/service/fct-home-visit/options/${opt.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: trimmed }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(getApiErrorMessage(json, 'ไม่สามารถแก้ไขชื่อตัวเลือกได้'))
      }
      setEditingId(null)
      await onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการแก้ไขตัวเลือก')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (opt: FctHomeVisitOptionRecord) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/service/fct-home-visit/options/${opt.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(getApiErrorMessage(json, 'ไม่สามารถลบตัวเลือกได้'))
      }
      await onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการลบตัวเลือก')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fctModalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fct-settings-title"
    >
      <div className="fctModal fctModalSm">
        <div className="fctModalHeader">
          <h2 id="fct-settings-title" className="fctModalTitle">
            ตั้งค่าตัวเลือก Dropdown เยี่ยมบ้าน FCT (Admin)
          </h2>
          <button
            type="button"
            className="fctBtn fctBtnSm"
            onClick={onClose}
            aria-label="ปิดหน้าต่างตั้งค่า"
          >
            <X size={16} />
          </button>
        </div>

        <div className="fctModalBody">
          <div className="fctTabGroup fctSettingsTabs">
            {FCT_ALL_OPTION_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`fctTabBtn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => {
                  setActiveCategory(cat)
                  setEditingId(null)
                  setError(null)
                }}
              >
                {FCT_OPTION_CATEGORY_META[cat].label}
              </button>
            ))}
          </div>

          <p className="fctModalDesc">{meta.description}</p>

          {error && <div className="fctAlert fctAlertError">{error}</div>}

          <form onSubmit={handleAdd} className="fctHnRow">
            <input
              type="text"
              className="fctInput"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={`เพิ่มตัวเลือกในหมวด ${meta.label}`}
              disabled={busy}
            />
            <button
              type="submit"
              className="fctBtn fctBtnPrimary"
              disabled={busy || !newLabel.trim()}
            >
              <Plus size={16} strokeWidth={1.5} />
              เพิ่ม
            </button>
          </form>

          {currentItems.length === 0 ? (
            <div className="fctEmpty fctEmptyCompact">ยังไม่มีตัวเลือกในหมวดนี้</div>
          ) : (
            <div className="fctOptionList">
              {currentItems.map((opt) => (
                <div
                  key={opt.id}
                  className={`fctOptionRow ${opt.isActive ? '' : 'fctOptionRowInactive'}`}
                >
                  {editingId === opt.id ? (
                    <div className="fctHnRow fctFlex1">
                      <input
                        type="text"
                        className="fctInput"
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        disabled={busy}
                      />
                      <button
                        type="button"
                        className="fctBtn fctBtnPrimary fctBtnSm"
                        onClick={() => handleSaveRename(opt)}
                        disabled={busy}
                        aria-label="บันทึกชื่อตัวเลือก"
                      >
                        <Check size={14} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        className="fctBtn fctBtnSm"
                        onClick={() => setEditingId(null)}
                        disabled={busy}
                        aria-label="ยกเลิกการแก้ไข"
                      >
                        <X size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span
                        className={`fctOptionLabel ${opt.isActive ? '' : 'fctOptionLabelInactive'}`}
                      >
                        {opt.label}
                      </span>
                      <div className="fctOptionActions">
                        <button
                          type="button"
                          className="fctBtn fctBtnSm"
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
                          className="fctBtn fctBtnSm"
                          onClick={() => handleToggleActive(opt)}
                          disabled={busy}
                        >
                          {opt.isActive ? 'ซ่อน' : 'เปิดใช้'}
                        </button>
                        <button
                          type="button"
                          className="fctBtn fctBtnDanger fctBtnSm"
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

        <div className="fctModalFooter">
          <button type="button" className="fctBtn" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}
