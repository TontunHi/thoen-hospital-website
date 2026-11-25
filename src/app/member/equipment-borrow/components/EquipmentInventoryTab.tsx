'use client'

import React from 'react'
import {
  Package,
  Building2,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Power,
  Trash2,
  ImagePlus,
} from 'lucide-react'
import type { MaterialRecord, LoanableAssetRecord } from './equipmentBorrowTypes'
import { EquipmentItemThumbnail } from './EquipmentItemThumbnail'
import type { PreviewableEquipmentItem } from './ItemImageLightboxModal'

interface EquipmentInventoryTabProps {
  inventoryType: 'materials' | 'assets'
  onInventoryTypeChange: (type: 'materials' | 'assets') => void
  inventorySearch: string
  onInventorySearchChange: (val: string) => void
  loading: boolean
  materials: MaterialRecord[]
  loanableAssets: LoanableAssetRecord[]
  onRefresh: () => void
  onOpenCreateMaterialModal: () => void
  onOpenEditMaterialModal: (material: MaterialRecord) => void
  onPreviewItem: (item: PreviewableEquipmentItem) => void
  onToggleMaterialActive: (id: number, isActive: boolean, name: string) => void
  onDeleteMaterial: (id: number, name: string) => void
  onOpenAssetImageModal: (asset: LoanableAssetRecord) => void
  onToggleAssetLoanable: (id: number, isLoanable: boolean) => void
}

export function EquipmentInventoryTab({
  inventoryType,
  onInventoryTypeChange,
  inventorySearch,
  onInventorySearchChange,
  loading,
  materials,
  loanableAssets,
  onRefresh,
  onOpenCreateMaterialModal,
  onOpenEditMaterialModal,
  onPreviewItem,
  onToggleMaterialActive,
  onDeleteMaterial,
  onOpenAssetImageModal,
  onToggleAssetLoanable,
}: EquipmentInventoryTabProps) {
  return (
    <section>
      {/* Subtab Bar */}
      <div className="inventorySubtabsRow">
        <div className="inventoryNavPills">
          <button
            type="button"
            onClick={() => onInventoryTypeChange('materials')}
            className={`inventoryNavPill ${inventoryType === 'materials' ? 'active' : ''}`}
          >
            <Package size={15} />
            <span>คลังพัสดุและวัสดุ (Materials)</span>
          </button>
          <button
            type="button"
            onClick={() => onInventoryTypeChange('assets')}
            className={`inventoryNavPill ${inventoryType === 'assets' ? 'active' : ''}`}
          >
            <Building2 size={15} />
            <span>ครุภัณฑ์พร้อมให้ยืม (Assets)</span>
          </button>
        </div>

        {inventoryType === 'materials' && (
          <button
            type="button"
            onClick={onOpenCreateMaterialModal}
            className="primaryButton"
          >
            <Plus size={16} strokeWidth={1.5} /> เพิ่มวัสดุใหม่
          </button>
        )}
      </div>

      <div className="toolbarRow">
        <div className="searchBox">
          <Search size={18} strokeWidth={1.5} className="searchIconMuted" />
          <input
            type="text"
            placeholder={inventoryType === 'materials' ? 'ค้นหาชื่อวัสดุ, ที่เก็บ…' : 'ค้นหาเลขครุภัณฑ์, ชื่อ…'}
            value={inventorySearch}
            onChange={(e) => onInventorySearchChange(e.target.value)}
          />
        </div>
        <button type="button" onClick={onRefresh} className="secondaryButton">
          <RefreshCw size={16} strokeWidth={1.5} className={loading ? 'animate-spin' : ''} /> รีเฟรช
        </button>
      </div>

      <div className="tableContainer">
        {inventoryType === 'materials' ? (
          <table className="styledTable">
            <thead>
              <tr>
                <th className="colThumb">รูปภาพ</th>
                <th>ชื่อวัสดุ</th>
                <th>หมวดหมู่</th>
                <th>ประเภทการใช้งาน</th>
                <th>จำนวนรวม</th>
                <th>พร้อมยืม</th>
                <th>สถานที่จัดเก็บ</th>
                <th>สถานะ</th>
                <th className="textRight">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id}>
                  <td>
                    <EquipmentItemThumbnail
                      imageUrl={m.imageUrl}
                      name={m.name}
                      category={m.category}
                      variant="thumb"
                      onClick={() => {
                        if (m.imageUrl) {
                          onPreviewItem({
                            id: m.id,
                            itemType: 'MATERIAL',
                            name: m.name,
                            code: `MAT-${m.id.toString().padStart(4, '0')}`,
                            category: m.category,
                            subType: m.materialType === 'REUSABLE' ? 'วัสดุยืม-คืน' : 'วัสดุสิ้นเปลือง',
                            availableQty: m.availableQty,
                            unit: m.unit,
                            location: m.location,
                            imageUrl: m.imageUrl,
                          })
                        } else {
                          onOpenEditMaterialModal(m)
                        }
                      }}
                      ariaLabel={m.imageUrl ? `ดูรูปภาพ ${m.name}` : `แนบรูปภาพ ${m.name}`}
                    />
                  </td>
                  <td className="fontSemibold textPrimary">{m.name}</td>
                  <td>{m.category}</td>
                  <td>
                    <span className={`categoryPill ${m.materialType === 'REUSABLE' ? 'pillReusable' : 'pillConsumable'}`}>
                      {m.materialType === 'REUSABLE' ? 'ยืม-คืน' : 'สิ้นเปลือง (ตัดยอด)'}
                    </span>
                  </td>
                  <td className="tabularNums">{m.totalQty} {m.unit}</td>
                  <td className={`fontSemibold tabularNums ${m.availableQty > 0 ? 'textSuccess' : 'textDanger'}`}>
                    {m.availableQty} {m.unit}
                  </td>
                  <td>{m.location || '-'}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => onToggleMaterialActive(m.id, m.isActive, m.name)}
                      className={`statusTogglePill ${m.isActive ? 'statusToggleActive' : 'statusToggleInactive'}`}
                      title={m.isActive ? 'คลิกเพื่อปิดใช้งาน' : 'คลิกเพื่อเปิดใช้งาน'}
                    >
                      <span className={`statusToggleDot ${m.isActive ? 'dotActive' : 'dotInactive'}`} />
                      {m.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </button>
                  </td>
                  <td className="textRight">
                    <div className="inlineActions">
                      <button
                        type="button"
                        onClick={() => onOpenEditMaterialModal(m)}
                        className="secondaryButton iconActionBtn"
                        title="แก้ไขและแนบรูปภาพ"
                        aria-label={`แก้ไข ${m.name}`}
                      >
                        <Edit2 size={14} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleMaterialActive(m.id, m.isActive, m.name)}
                        className={`secondaryButton iconActionBtn ${m.isActive ? 'textWarning' : 'textSuccess'}`}
                        title={m.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        aria-label={m.isActive ? `ปิดใช้งาน ${m.name}` : `เปิดใช้งาน ${m.name}`}
                      >
                        <Power size={14} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMaterial(m.id, m.name)}
                        className="secondaryButton iconActionBtn textDanger"
                        title="ลบ"
                        aria-label={`ลบ ${m.name}`}
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="styledTable">
            <thead>
              <tr>
                <th className="colThumb">รูปภาพ</th>
                <th>เลขครุภัณฑ์</th>
                <th>ชื่อครุภัณฑ์</th>
                <th>ยี่ห้อ</th>
                <th>หมวดหมู่</th>
                <th>สถานที่ติดตั้ง</th>
                <th>สถานะเปิดให้ยืม</th>
                <th className="textRight">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loanableAssets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <EquipmentItemThumbnail
                      imageUrl={asset.imageUrl}
                      name={asset.name}
                      category={asset.category}
                      variant="thumb"
                      onClick={() => onOpenAssetImageModal(asset)}
                      ariaLabel={`แนบหรือแก้ไขรูปภาพ ${asset.name}`}
                    />
                  </td>
                  <td className="fontSemibold textInfo tabularNums">{asset.articleNum}</td>
                  <td className="fontMedium textPrimary">{asset.name}</td>
                  <td>{asset.brand || '-'}</td>
                  <td>{asset.category}</td>
                  <td>{asset.locationFullName || '-'}</td>
                  <td>
                    {asset.isLoanable ? (
                      <span className="statusBadge statusReturned">เปิดให้ยืมแล้ว</span>
                    ) : (
                      <span className="statusBadge statusNeutral">ไม่ได้เปิดให้ยืม</span>
                    )}
                  </td>
                  <td className="textRight">
                    <div className="inlineActions">
                      <button
                        type="button"
                        onClick={() => onOpenAssetImageModal(asset)}
                        className="secondaryButton compactActionBtn"
                        title={asset.imageUrl ? 'เปลี่ยนรูปภาพ' : 'แนบรูปภาพ'}
                      >
                        <ImagePlus size={14} strokeWidth={1.5} />
                        {asset.imageUrl ? 'แก้ไขรูป' : 'แนบรูป'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleAssetLoanable(asset.id, asset.isLoanable)}
                        className={asset.isLoanable ? 'actionBtn actionBtnReject' : 'actionBtn actionBtnApprove'}
                      >
                        {asset.isLoanable ? 'ปิดการให้ยืม' : 'เปิดให้ยืม'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
