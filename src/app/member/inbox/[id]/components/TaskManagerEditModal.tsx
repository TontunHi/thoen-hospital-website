'use client'

import React from 'react'
import {
  Edit3,
  Calendar,
  Layers,
  Share2,
  FileCheck,
  Loader2,
  Plus,
  Trash2,
  FileSpreadsheet,
  Wrench,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import {
  WORK_TYPES_CONFIG,
  CHANNELS_CONFIG,
  formatFileSize,
  getFileIcon,
} from './taskDetailConfig'

export interface EditTaskFormState {
  title: string
  description: string
  urgency: string
  deliveryDate: string
  costType: string
  estimatedBudget: string
  phone: string
  driveLink: string
  selectedWorkTypes: Record<string, { selected: boolean; customDetail: string }>
  selectedChannels: Record<string, { selected: boolean; customDetail: string }>
  attachments: Array<{
    fileName: string
    filePath: string
    fileType?: string
    fileSize?: number
  }>
  quotations: Array<{
    fileName: string
    filePath: string
    fileType?: string
    fileSize?: number
  }>
  objectives: string
  mediaDetails: string
  itemCategory: string
  equipmentNumber: string
  equipmentName: string
  nonEquipmentItem: string
  locationFullName: string
  symptomDetail: string
}

export function TaskManagerEditModal(props: {
  isEditTaskModalOpen: boolean
  setIsEditTaskModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  task: any
  editTaskForm: EditTaskFormState
  setEditTaskForm: React.Dispatch<React.SetStateAction<EditTaskFormState>>
  handleSaveTaskEdit: (e: React.FormEvent) => Promise<void>
  toggleEditWorkType: (key: string) => void
  setEditWorkTypeDetail: (key: string, detail: string) => void
  toggleEditChannel: (key: string) => void
  setEditChannelDetail: (key: string, detail: string) => void
  isUploadingEditFiles: boolean
  handleEditFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  handleRemoveEditAttachment: (index: number) => void
  isUploadingEditQuotations: boolean
  handleEditQuotationUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  handleRemoveEditQuotation: (index: number) => void
  actionLoading: boolean
}) {
  const {
    isEditTaskModalOpen,
    setIsEditTaskModalOpen,
    task,
    editTaskForm,
    setEditTaskForm,
    handleSaveTaskEdit,
    toggleEditWorkType,
    setEditWorkTypeDetail,
    toggleEditChannel,
    setEditChannelDetail,
    isUploadingEditFiles,
    handleEditFileUpload,
    handleRemoveEditAttachment,
    isUploadingEditQuotations,
    handleEditQuotationUpload,
    handleRemoveEditQuotation,
    actionLoading,
  } = props

  return (
    <>
      {/* ── Modal 4: Manager Edit Task Details Modal ── */}
      {isEditTaskModalOpen && (
        <div className="modalBackdrop" onClick={() => setIsEditTaskModalOpen(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '760px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10 }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Edit3 size={18} className="text-teal-600" />
                  <span>แก้ไขข้อมูลคำขอ</span>
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  สำหรับผู้ดูแลระบบและผู้มีสิทธิ์จัดการงาน ({task.task_no})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditTaskModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
                title="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTaskEdit}>
              {/* ชื่องาน / หัวข้องาน */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  หัวข้องาน / รายการคำขอ <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editTaskForm.title}
                  onChange={(e) => setEditTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              {/* ความเร่งด่วน */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  ระดับความเร่งด่วน
                </label>
                <select
                  value={editTaskForm.urgency}
                  onChange={(e) => setEditTaskForm(prev => ({ ...prev, urgency: e.target.value }))}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem', backgroundColor: 'white' }}
                >
                  <option value="NORMAL">● {task.task_type === 'MEDIA_REQUEST' ? 'ไม่ด่วน' : 'ปกติ'}</option>
                  <option value="URGENT">● ด่วน</option>
                  <option value="VERY_URGENT">● ด่วนที่สุด</option>
                </select>
              </div>

              {/* Media Request Specific Fields */}
              {task.task_type === 'MEDIA_REQUEST' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1rem' }}>
                  {/* กำหนดการ & รูปแบบค่าใช้จ่าย */}
                  <div style={{ backgroundColor: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '0.65rem', padding: '1rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f766e', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Calendar size={16} />
                      <span>กำหนดส่งมอบและรูปแบบค่าใช้จ่าย</span>
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '0.85rem' }}>
                      {/* Delivery Date */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#134e4a', marginBottom: '0.25rem' }}>
                          ขอรับงานภายในวันที่ / กำหนดส่งมอบ
                        </label>
                        <input
                          type="date"
                          value={editTaskForm.deliveryDate}
                          onChange={(e) => setEditTaskForm(prev => ({ ...prev, deliveryDate: e.target.value }))}
                          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #99f6e4', fontSize: '0.85rem', backgroundColor: '#ffffff' }}
                        />
                      </div>

                      {/* Cost Type Radio */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#134e4a', marginBottom: '0.25rem' }}>
                          รูปแบบค่าใช้จ่าย
                        </label>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', minHeight: '38px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', color: '#0f766e' }}>
                            <input
                              type="radio"
                              name="editCostType"
                              value="NO_COST"
                              checked={editTaskForm.costType === 'NO_COST'}
                              onChange={() => setEditTaskForm(prev => ({ ...prev, costType: 'NO_COST', estimatedBudget: '' }))}
                            />
                            <span className="costBullet costBulletNoCost" aria-hidden="true" />
                            <span>ไม่มีค่าใช้จ่าย</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', color: '#b91c1c' }}>
                            <input
                              type="radio"
                              name="editCostType"
                              value="HAS_COST"
                              checked={editTaskForm.costType === 'HAS_COST'}
                              onChange={() => setEditTaskForm(prev => ({ ...prev, costType: 'HAS_COST' }))}
                            />
                            <span className="costBullet costBulletHasCost" aria-hidden="true" />
                            <span>มีค่าใช้จ่าย</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Estimated Budget if HAS_COST */}
                    {editTaskForm.costType === 'HAS_COST' && (
                      <div style={{ borderTop: '1px dashed #99f6e4', paddingTop: '0.75rem' }}>
                        <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#134e4a', marginBottom: '0.25rem' }}>
                          ประมาณการงบประมาณ (บาท) <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="เช่น 2500"
                          value={editTaskForm.estimatedBudget}
                          onChange={(e) => setEditTaskForm(prev => ({ ...prev, estimatedBudget: e.target.value }))}
                          style={{ width: '100%', maxWidth: '300px', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #99f6e4', fontSize: '0.85rem', backgroundColor: '#ffffff' }}
                        />
                      </div>
                    )}
                  </div>

                  {/* ลักษณะงานที่ขอรับบริการ (Work Types) */}
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Layers size={16} className="text-teal-600" />
                      <span>ลักษณะงานที่ขอรับบริการ (เลือกลักษณะงานที่ต้องการ)</span>
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
                      {WORK_TYPES_CONFIG.map((cfg) => {
                        const isSelected = !!editTaskForm.selectedWorkTypes[cfg.key]?.selected
                        return (
                          <div
                            key={cfg.key}
                            onClick={() => toggleEditWorkType(cfg.key)}
                            style={{
                              padding: '0.6rem 0.75rem',
                              borderRadius: '0.5rem',
                              border: isSelected ? '1.5px solid #0d9488' : '1px solid #cbd5e1',
                              backgroundColor: isSelected ? '#f0fdfa' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              transition: 'all 0.15s ease',
                              userSelect: 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Handled by div onClick
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#0f766e' : '#334155' }}>
                              {cfg.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Inputs for Work Types with custom details */}
                    {WORK_TYPES_CONFIG.filter((cfg) => cfg.hasCustomInput && editTaskForm.selectedWorkTypes[cfg.key]?.selected).map((cfg) => (
                      <div key={cfg.key} style={{ marginTop: '0.5rem', padding: '0.65rem', backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0f766e', marginBottom: '0.3rem' }}>
                          รายละเอียด/ขนาดสำหรับ {cfg.label}:
                        </label>
                        <input
                          type="text"
                          placeholder={cfg.placeholder}
                          value={editTaskForm.selectedWorkTypes[cfg.key]?.customDetail || ''}
                          onChange={(e) => setEditWorkTypeDetail(cfg.key, e.target.value)}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.825rem', marginBottom: '0.4rem' }}
                        />
                        {cfg.quickTags && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {cfg.quickTags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => setEditWorkTypeDetail(cfg.key, tag)}
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '0.3rem',
                                  cursor: 'pointer',
                                  color: '#475569',
                                }}
                              >
                                + {tag}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* ช่องทางเผยแพร่ (Channels) */}
                  <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Share2 size={16} className="text-teal-600" />
                      <span>ช่องทางที่ต้องการเผยแพร่</span>
                    </h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
                      {CHANNELS_CONFIG.map((cfg) => {
                        const isSelected = !!editTaskForm.selectedChannels[cfg.key]?.selected
                        return (
                          <div
                            key={cfg.key}
                            onClick={() => toggleEditChannel(cfg.key)}
                            style={{
                              padding: '0.6rem 0.75rem',
                              borderRadius: '0.5rem',
                              border: isSelected ? '1.5px solid #0d9488' : '1px solid #cbd5e1',
                              backgroundColor: isSelected ? '#f0fdfa' : '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              transition: 'all 0.15s ease',
                              userSelect: 'none',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // Handled by div onClick
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#0f766e' : '#334155' }}>
                              {cfg.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Inputs for Channels with custom details */}
                    {CHANNELS_CONFIG.filter((cfg) => cfg.hasCustomInput && editTaskForm.selectedChannels[cfg.key]?.selected).map((cfg) => (
                      <div key={cfg.key} style={{ marginTop: '0.5rem', padding: '0.65rem', backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px dashed #cbd5e1' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#0f766e', marginBottom: '0.3rem' }}>
                          จุด/บริเวณ สำหรับ {cfg.label}:
                        </label>
                        <input
                          type="text"
                          placeholder={cfg.placeholder}
                          value={editTaskForm.selectedChannels[cfg.key]?.customDetail || ''}
                          onChange={(e) => setEditChannelDetail(cfg.key, e.target.value)}
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.825rem', marginBottom: '0.4rem' }}
                        />
                        {cfg.quickTags && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {cfg.quickTags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => setEditChannelDetail(cfg.key, tag)}
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  fontSize: '0.75rem',
                                  backgroundColor: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '0.3rem',
                                  cursor: 'pointer',
                                  color: '#475569',
                                }}
                              >
                                + {tag}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* รายละเอียดเนื้อหาในสื่อ */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      รายละเอียดและข้อความที่ต้องการให้ใส่ในสื่อ
                    </label>
                    <textarea
                      rows={3}
                      value={editTaskForm.description}
                      onChange={(e) => setEditTaskForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="ระบุข้อความ กำหนดการ หรือเนื้อหาที่ต้องการให้ออกแบบในสื่อ"
                      style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                    />
                  </div>

                  {/* เบอร์โทร & ลิงก์ Cloud */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                        เบอร์โทรติดต่อ
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น 081-234-5678"
                        value={editTaskForm.phone}
                        onChange={(e) => setEditTaskForm(prev => ({ ...prev, phone: e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                        ลิงก์ Google Drive / Cloud
                      </label>
                      <input
                        type="url"
                        placeholder="https://drive.google.com/..."
                        value={editTaskForm.driveLink}
                        onChange={(e) => setEditTaskForm(prev => ({ ...prev, driveLink: e.target.value }))}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  {/* รายการไฟล์แนบ (Attachments) */}
                  <div style={{ backgroundColor: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '0.65rem', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f766e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <FileCheck size={16} />
                        ไฟล์แนบประกอบ ({editTaskForm.attachments.length} ไฟล์)
                      </span>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          backgroundColor: '#ffffff',
                          color: '#0f766e',
                          border: '1px solid #99f6e4',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.4rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: isUploadingEditFiles ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isUploadingEditFiles ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        <span>{isUploadingEditFiles ? 'กำลังอัปโหลด...' : 'แนบไฟล์เพิ่ม'}</span>
                        <input
                          type="file"
                          multiple
                          onChange={handleEditFileUpload}
                          disabled={isUploadingEditFiles}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>

                    {editTaskForm.attachments.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {editTaskForm.attachments.map((att, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: '#ffffff',
                              padding: '0.45rem 0.75rem',
                              borderRadius: '0.4rem',
                              border: '1px solid #ccfbf1',
                              fontSize: '0.825rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {getFileIcon(att.fileName)}
                              <a
                                href={att.filePath}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#0f766e', textDecoration: 'none', fontWeight: 600 }}
                              >
                                {att.fileName}
                              </a>
                              {att.fileSize ? (
                                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>({formatFileSize(att.fileSize)})</span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveEditAttachment(idx)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0.2rem' }}
                              title="ลบไฟล์แนบนี้"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', padding: '0.75rem 0' }}>
                        ไม่มีไฟล์แนบ (สามารถคลิกปุ่ม &quot;แนบไฟล์เพิ่ม&quot; ด้านบนเพื่อเพิ่มไฟล์ได้)
                      </div>
                    )}

                    {/* Quotations Edit Section (Only when HAS_COST) */}
                    {editTaskForm.costType === 'HAS_COST' && (
                      <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px dashed #cbd5e1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <FileSpreadsheet size={15} className="text-emerald-600" />
                            <span>เอกสารใบเสนอราคา (Quotation) ({editTaskForm.quotations.length})</span>
                          </span>
                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              backgroundColor: '#ecfdf5',
                              color: '#047857',
                              border: '1px solid #a7f3d0',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '0.4rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: isUploadingEditQuotations ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {isUploadingEditQuotations ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            <span>{isUploadingEditQuotations ? 'กำลังอัปโหลด...' : 'เพิ่มใบเสนอราคา'}</span>
                            <input
                              type="file"
                              multiple
                              accept=".pdf,.jpg,.jpeg,.png,.webp"
                              onChange={handleEditQuotationUpload}
                              disabled={isUploadingEditQuotations}
                              style={{ display: 'none' }}
                            />
                          </label>
                        </div>

                        {editTaskForm.quotations.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {editTaskForm.quotations.map((q, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  backgroundColor: '#ffffff',
                                  padding: '0.45rem 0.75rem',
                                  borderRadius: '0.4rem',
                                  border: '1px solid #a7f3d0',
                                  fontSize: '0.825rem',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {getFileIcon(q.fileName)}
                                  <a
                                    href={q.filePath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#047857', textDecoration: 'none', fontWeight: 600 }}
                                  >
                                    {q.fileName}
                                  </a>
                                  {q.fileSize ? (
                                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>({formatFileSize(q.fileSize)})</span>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditQuotation(idx)}
                                  style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '0.2rem' }}
                                  title="ลบไฟล์ใบเสนอราคานี้"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', padding: '0.5rem 0', backgroundColor: '#f0fdf4', borderRadius: '0.4rem', border: '1px dashed #a7f3d0' }}>
                            ยังไม่มีเอกสารใบเสนอราคา (คลิกปุ่ม &quot;เพิ่มใบเสนอราคา&quot; เพื่ออัปโหลดไฟล์ PDF หรือรูปภาพ)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Repair Tasks Specific Fields */}
              {['IT_REPAIR', 'GENERAL_REPAIR', 'MEDICAL_REPAIR'].includes(task.task_type) && (
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.65rem', padding: '1rem', marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Wrench size={16} />
                    <span>ข้อมูลรายการซ่อม</span>
                  </h4>

                  {/* Item Category */}
                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                      ประเภทรายการ
                    </label>
                    <div style={{ display: 'flex', gap: '1.25rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="editItemCategory"
                          value="EQUIPMENT"
                          checked={editTaskForm.itemCategory === 'EQUIPMENT'}
                          onChange={() => setEditTaskForm(prev => ({ ...prev, itemCategory: 'EQUIPMENT' }))}
                        />
                        <span>ครุภัณฑ์ (มีหมายเลขครุภัณฑ์)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="editItemCategory"
                          value="NON_EQUIPMENT"
                          checked={editTaskForm.itemCategory === 'NON_EQUIPMENT'}
                          onChange={() => setEditTaskForm(prev => ({ ...prev, itemCategory: 'NON_EQUIPMENT' }))}
                        />
                        <span>งานซ่อมทั่วไป / สถานที่ (ไม่มีหมายเลข)</span>
                      </label>
                    </div>
                  </div>

                  {editTaskForm.itemCategory === 'EQUIPMENT' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          หมายเลขครุภัณฑ์
                        </label>
                        <input
                          type="text"
                          value={editTaskForm.equipmentNumber}
                          onChange={(e) => setEditTaskForm(prev => ({ ...prev, equipmentNumber: e.target.value }))}
                          placeholder="เช่น 7440-001-0001"
                          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                          ชื่ออุปกรณ์ / รายการครุภัณฑ์
                        </label>
                        <input
                          type="text"
                          value={editTaskForm.equipmentName}
                          onChange={(e) => setEditTaskForm(prev => ({ ...prev, equipmentName: e.target.value }))}
                          placeholder="เช่น เครื่องคอมพิวเตอร์ All-in-One"
                          style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginBottom: '0.85rem' }}>
                      <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                        รายการสิ่งของ / รายการซ่อม
                      </label>
                      <input
                        type="text"
                        value={editTaskForm.nonEquipmentItem}
                        onChange={(e) => setEditTaskForm(prev => ({ ...prev, nonEquipmentItem: e.target.value }))}
                        placeholder="เช่น ซ่อมก๊อกน้ำห้องน้ำผู้ป่วย, หลอดไฟทางเดินดับ"
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>
                  )}

                  {/* Location */}
                  <div style={{ marginBottom: '0.85rem' }}>
                    <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      สถานที่ตั้ง / หน่วยงาน / ห้อง
                    </label>
                    <input
                      type="text"
                      value={editTaskForm.locationFullName}
                      onChange={(e) => setEditTaskForm(prev => ({ ...prev, locationFullName: e.target.value }))}
                      placeholder="เช่น อาคารผู้ป่วยนอก ชั้น 1 ห้องตรวจ 3"
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Symptom Detail */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      อาการชำรุด / ปัญหาที่พบ
                    </label>
                    <textarea
                      rows={2}
                      value={editTaskForm.symptomDetail}
                      onChange={(e) => setEditTaskForm(prev => ({ ...prev, symptomDetail: e.target.value }))}
                      placeholder="ระบุอาการชำรุด หรือรายละเอียดปัญหาที่แจ้งซ่อม"
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              )}

              {/* General task description (if not Media or Repair) */}
              {task.task_type !== 'MEDIA_REQUEST' && !['IT_REPAIR', 'GENERAL_REPAIR', 'MEDICAL_REPAIR'].includes(task.task_type) && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                    รายละเอียดคำขอ
                  </label>
                  <textarea
                    rows={3}
                    value={editTaskForm.description}
                    onChange={(e) => setEditTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsEditTaskModalOpen(false)}
                  className="backBtn"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  style={{
                    backgroundColor: '#0f766e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.6rem 1.35rem',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 2px 4px rgba(15, 118, 110, 0.2)',
                  }}
                >
                  {actionLoading ? <Clock size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  <span>บันทึกการแก้ไข</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
