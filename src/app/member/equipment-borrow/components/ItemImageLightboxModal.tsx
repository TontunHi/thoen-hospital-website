'use client'

import React, { useEffect } from 'react'
import { Layers, MapPin, Plus, X } from 'lucide-react'
import { EquipmentItemThumbnail } from './EquipmentItemThumbnail'

export interface PreviewableEquipmentItem {
  id: number
  itemType: 'ASSET' | 'MATERIAL'
  name: string
  code?: string | null
  category?: string
  subType?: string
  availableQty?: number
  unit?: string
  location?: string | null
  imageUrl?: string | null
}

export function ItemImageLightboxModal({
  item,
  onClose,
  onAddToBasket,
}: {
  item: PreviewableEquipmentItem | null
  onClose: () => void
  onAddToBasket?: () => void
}) {
  useEffect(() => {
    if (!item) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [item, onClose])

  if (!item) return null

  const canBorrow = Boolean(onAddToBasket && (item.availableQty ?? 0) > 0)

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div
        className="modalContent lightboxModalContent"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-preview-title"
      >
        <div className="modalHeader">
          <div>
            <h2 id="item-preview-title">{item.name}</h2>
            {item.code && <div className="lightboxSubCode">รหัส: {item.code}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modalCloseBtn"
            aria-label="ปิดหน้าต่าง"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="modalBody">
          <EquipmentItemThumbnail
            imageUrl={item.imageUrl}
            name={item.name}
            category={item.category}
            variant="preview"
          />

          <div className="lightboxMetaRow">
            <span className={`categoryPill ${item.itemType === 'ASSET' ? 'pillAsset' : 'pillReusable'}`}>
              {item.subType || (item.itemType === 'ASSET' ? 'ครุภัณฑ์' : 'วัสดุ')}
            </span>

            {item.category && (
              <span className="lightboxMetaTag">
                <Layers size={15} strokeWidth={1.5} aria-hidden="true" />
                หมวดหมู่: {item.category}
              </span>
            )}

            {item.location && (
              <span className="lightboxMetaTag">
                <MapPin size={15} strokeWidth={1.5} aria-hidden="true" />
                {item.location}
              </span>
            )}

            {item.availableQty !== undefined && (
              <span className={`stockBadge ${item.availableQty > 0 ? 'stockAvail' : 'stockZero'}`}>
                {item.availableQty > 0
                  ? `พร้อมยืม ${item.availableQty} ${item.unit || 'ชิ้น'}`
                  : 'ถูกยืมหมดแล้ว'}
              </span>
            )}
          </div>
        </div>

        <div className="modalFooter">
          <button type="button" onClick={onClose} className="secondaryButton">
            ปิดหน้าต่าง
          </button>
          {canBorrow && (
            <button
              type="button"
              onClick={() => {
                onAddToBasket?.()
                onClose()
              }}
              className="primaryButton"
            >
              <Plus size={16} strokeWidth={1.5} />
              หยิบใส่รายการขอยืม
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
