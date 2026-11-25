'use client'

import React from 'react'
import {
  Search,
  X,
  RefreshCw,
  FolderOpen,
  MapPin,
  Layers,
  Plus,
} from 'lucide-react'
import type { CatalogItem } from './equipmentBorrowTypes'
import { EquipmentItemThumbnail } from './EquipmentItemThumbnail'
import type { PreviewableEquipmentItem } from './ItemImageLightboxModal'

interface EquipmentCatalogTabProps {
  catalogSearch: string
  onCatalogSearchChange: (val: string) => void
  catalogType: 'ALL' | 'ASSET' | 'MATERIAL'
  onCatalogTypeChange: (val: 'ALL' | 'ASSET' | 'MATERIAL') => void
  catalogCategory: string
  onCatalogCategoryChange: (val: string) => void
  loading: boolean
  catalogItems: CatalogItem[]
  onRefresh: () => void
  onPreviewItem: (item: PreviewableEquipmentItem) => void
  onAddToBasket: (item: CatalogItem) => void
}

export function EquipmentCatalogTab({
  catalogSearch,
  onCatalogSearchChange,
  catalogType,
  onCatalogTypeChange,
  catalogCategory,
  onCatalogCategoryChange,
  loading,
  catalogItems,
  onRefresh,
  onPreviewItem,
  onAddToBasket,
}: EquipmentCatalogTabProps) {
  return (
    <section>
      {/* Toolbar & Filters */}
      <div className="toolbarRow">
        <div className="searchBox">
          <Search size={18} strokeWidth={1.5} className="searchIconMuted" />
          <input
            type="text"
            placeholder="ค้นหาชื่ออุปกรณ์, รหัสครุภัณฑ์, สถานที่…"
            value={catalogSearch}
            onChange={(e) => onCatalogSearchChange(e.target.value)}
          />
          {catalogSearch && (
            <button
              type="button"
              onClick={() => onCatalogSearchChange('')}
              className="modalCloseBtn"
              aria-label="ล้างคำค้นหา"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div className="filterSelectGroup">
          <select
            className="filterSelect"
            value={catalogType}
            onChange={(e) => onCatalogTypeChange(e.target.value as 'ALL' | 'ASSET' | 'MATERIAL')}
          >
            <option value="ALL">ทุกประเภท (ครุภัณฑ์ & วัสดุ)</option>
            <option value="ASSET">เฉพาะ ครุภัณฑ์</option>
            <option value="MATERIAL">เฉพาะ วัสดุ</option>
          </select>

          <select
            className="filterSelect"
            value={catalogCategory}
            onChange={(e) => onCatalogCategoryChange(e.target.value)}
          >
            <option value="ALL">ทุกหมวดหมู่</option>
            <option value="IT">ไอที / คอมพิวเตอร์</option>
            <option value="ELECTRICAL">ไฟฟ้า / โสตทัศนูปกรณ์</option>
            <option value="MEDICAL">เครื่องมือแพทย์</option>
            <option value="GENERAL">ทั่วไป / อุปกรณ์สำนักงาน</option>
          </select>

          <button type="button" onClick={onRefresh} className="secondaryButton" title="รีเฟรชข้อมูล" aria-label="รีเฟรชข้อมูล">
            <RefreshCw size={16} strokeWidth={1.5} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="emptyState">
          <RefreshCw size={32} strokeWidth={1.5} className="animate-spin emptyStateSpinner" />
          <p>กำลังโหลดข้อมูลอุปกรณ์พร้อมยืม…</p>
        </div>
      ) : catalogItems.length === 0 ? (
        <div className="emptyState">
          <FolderOpen size={44} strokeWidth={1.5} className="emptyStateIcon" />
          <p>ไม่พบรายการอุปกรณ์ที่พร้อมให้ยืมในขณะนี้</p>
        </div>
      ) : (
        <div className="catalogGrid">
          {catalogItems.map((item) => (
            <div key={`${item.itemType}-${item.id}`} className="catalogCard">
              <div className="catalogCardBody">
                <EquipmentItemThumbnail
                  imageUrl={item.imageUrl}
                  name={item.name}
                  category={item.category}
                  variant="card"
                  onClick={() => onPreviewItem(item)}
                  ariaLabel={`ดูรูปภาพและรายละเอียด ${item.name}`}
                />

                <div className="catalogCardTop">
                  <span
                    className={`categoryPill ${
                      item.itemType === 'ASSET'
                        ? 'pillAsset'
                        : item.subType === 'วัสดุสิ้นเปลือง'
                        ? 'pillConsumable'
                        : 'pillReusable'
                    }`}
                  >
                    {item.subType || (item.itemType === 'ASSET' ? 'ครุภัณฑ์' : 'วัสดุ')}
                  </span>
                  <span className={`stockBadge ${item.availableQty > 0 ? 'stockAvail' : 'stockZero'}`}>
                    {item.availableQty > 0 ? `พร้อมยืม ${item.availableQty} ${item.unit}` : 'ถูกยืมหมดแล้ว'}
                  </span>
                </div>

                <h3 className="catalogCardTitle">{item.name}</h3>
                <div className="catalogCardCode">รหัส: {item.code}</div>

                <div className="catalogCardMeta">
                  {item.location && (
                    <div className="catalogMetaLine">
                      <MapPin size={14} strokeWidth={1.5} className="metaIconMuted" />
                      <span>{item.location}</span>
                    </div>
                  )}
                  <div className="catalogMetaLine">
                    <Layers size={14} strokeWidth={1.5} className="metaIconMuted" />
                    <span>หมวดหมู่: {item.category}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onAddToBasket(item)}
                className="addToBasketBtn"
                disabled={item.availableQty <= 0}
              >
                <Plus size={16} strokeWidth={1.5} />
                {item.availableQty > 0 ? 'หยิบใส่รายการขอยืม' : 'อยู่ระหว่างถูกยืม'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
