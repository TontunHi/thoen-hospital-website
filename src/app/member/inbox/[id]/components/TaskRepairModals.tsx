'use client'

import React from 'react'
import { Clock, XCircle } from 'lucide-react'

export interface RepairProgressFormData {
  repairNature: string
  foundProblem: string
  solutionStep: string
  isExternalRepair: boolean
  externalVendorName: string
  externalReason: string
  costType: string
  costAmount: string
}

export interface TaskRepairModalsProps {
  // CoWorker Modal
  isCoWorkerModalOpen: boolean
  setIsCoWorkerModalOpen: (open: boolean) => void
  selectedCoWorkerId: string
  setSelectedCoWorkerId: (id: string) => void
  allMembers: any[]
  repairDetail: any
  actionLoading: boolean
  handleAddCoWorker: () => void

  // Repair Progress Modal
  isRepairProgressModalOpen: boolean
  setIsRepairProgressModalOpen: (open: boolean) => void
  repairProgressForm: RepairProgressFormData
  setRepairProgressForm: React.Dispatch<React.SetStateAction<RepairProgressFormData>>
  handleSaveRepairProgress: (e: React.FormEvent) => void

  // Cancel Job Modal
  isCancelModalOpen: boolean
  setIsCancelModalOpen: (open: boolean) => void
  cancelReason: string
  setCancelReason: (reason: string) => void
  handleCancelJob: () => void
}

export default function TaskRepairModals({
  isCoWorkerModalOpen,
  setIsCoWorkerModalOpen,
  selectedCoWorkerId,
  setSelectedCoWorkerId,
  allMembers,
  repairDetail,
  actionLoading,
  handleAddCoWorker,

  isRepairProgressModalOpen,
  setIsRepairProgressModalOpen,
  repairProgressForm,
  setRepairProgressForm,
  handleSaveRepairProgress,

  isCancelModalOpen,
  setIsCancelModalOpen,
  cancelReason,
  setCancelReason,
  handleCancelJob,
}: TaskRepairModalsProps) {
  return (
    <>
      {/* ── Modal 1: Add Co-Worker ── */}
      {isCoWorkerModalOpen && (
        <div className="modalBackdrop">
          <div className="modalContent">
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
              เพิ่มผู้ร่วมงานซ่อมบำรุง
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              เลือกบุคลากร/ช่างเพื่อเข้าร่วมรับผิดชอบและลงนามในใบแจ้งซ่อมนี้
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                เลือกเจ้าหน้าที่ / ช่าง
              </label>
              <select
                value={selectedCoWorkerId}
                onChange={(e) => setSelectedCoWorkerId(e.target.value)}
                style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
              >
                <option value="">-- กรุณาเลือก --</option>
                {allMembers
                  .filter((m) => m.id !== repairDetail?.assigned_technician_id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.position || m.department || 'เจ้าหน้าที่'})
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsCoWorkerModalOpen(false)}
                className="backBtn"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!selectedCoWorkerId || actionLoading}
                onClick={handleAddCoWorker}
                className="btnApprove"
              >
                เพิ่มผู้ร่วมงาน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Save Repair Progress / External Repair / Costs ── */}
      {isRepairProgressModalOpen && (
        <div className="modalBackdrop">
          <div className="modalContent" style={{ maxWidth: '560px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
              บันทึกผลการตรวจซ่อม / รายงานความคืบหน้า
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>
              ข้อมูลนี้จะปรากฏในใบแจ้งซ่อมพิมพ์ขนาด A4 และบันทึกลงฐานข้อมูล
            </p>

            <form onSubmit={handleSaveRepairProgress}>
              {/* ส่งซ่อมปกติ หรือ ส่งซ่อมย้อนหลัง */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  ลักษณะการส่งซ่อม (ตรงตามแบบฟอร์มเอกสาร)
                </label>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="repairNature"
                      checked={repairProgressForm.repairNature === 'NORMAL'}
                      onChange={() => setRepairProgressForm(prev => ({ ...prev, repairNature: 'NORMAL' }))}
                    />
                    ส่งซ่อมปกติ
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="repairNature"
                      checked={repairProgressForm.repairNature === 'RETROACTIVE'}
                      onChange={() => setRepairProgressForm(prev => ({ ...prev, repairNature: 'RETROACTIVE' }))}
                    />
                    ส่งซ่อมย้อนหลัง
                  </label>
                </div>
              </div>

              {/* ปัญหาที่พบ */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  ปัญหา / สาเหตุที่ตรวจพบ
                </label>
                <textarea
                  rows={2}
                  value={repairProgressForm.foundProblem}
                  onChange={(e) => setRepairProgressForm(prev => ({ ...prev, foundProblem: e.target.value }))}
                  placeholder="เช่น สายแพร์จอภาพขาด, Power Supply เสีย, ชุดซีลยางเสื่อมสภาพ..."
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              {/* แนวทางแก้ไข */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  แนวทางการแก้ไข / ขั้นตอนที่ดำเนินการ
                </label>
                <textarea
                  rows={2}
                  value={repairProgressForm.solutionStep}
                  onChange={(e) => setRepairProgressForm(prev => ({ ...prev, solutionStep: e.target.value }))}
                  placeholder="เช่น ทำการเปลี่ยนอะไหล่ Power Supply ตัวใหม่ และทดสอบการทำงาน..."
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                />
              </div>

              {/* ส่งซ่อมภายนอก หรือไม่ */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
                  <input
                    type="checkbox"
                    checked={repairProgressForm.isExternalRepair}
                    onChange={(e) => setRepairProgressForm(prev => ({ ...prev, isExternalRepair: e.target.checked }))}
                  />
                  จำเป็นต้องส่งซ่อมภายนอก (ร้านค้า / บริษัทภายนอก)
                </label>

                {repairProgressForm.isExternalRepair && (
                  <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem' }}>
                        ชื่อร้าน / บริษัทผู้รับซ่อม
                      </label>
                      <input
                        type="text"
                        value={repairProgressForm.externalVendorName}
                        onChange={(e) => setRepairProgressForm(prev => ({ ...prev, externalVendorName: e.target.value }))}
                        placeholder="เช่น บจก. เทคโนเมดิคอล"
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem' }}>
                        เหตุผลที่ต้องส่งภายนอก
                      </label>
                      <input
                        type="text"
                        value={repairProgressForm.externalReason}
                        onChange={(e) => setRepairProgressForm(prev => ({ ...prev, externalReason: e.target.value }))}
                        placeholder="เช่น ต้องใช้เครื่องมือเทียบมาตรฐานเฉพาะ"
                        style={{ width: '100%', padding: '0.45rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ค่าใช้จ่าย */}
              <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  ค่าใช้จ่ายในการซ่อม
                </label>
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: repairProgressForm.costType === 'HAS_COST' ? '0.5rem' : 0 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="costType"
                      checked={repairProgressForm.costType === 'NO_COST'}
                      onChange={() => setRepairProgressForm(prev => ({ ...prev, costType: 'NO_COST', costAmount: '' }))}
                    />
                    ไม่มีค่าใช้จ่าย
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="costType"
                      checked={repairProgressForm.costType === 'HAS_COST'}
                      onChange={() => setRepairProgressForm(prev => ({ ...prev, costType: 'HAS_COST' }))}
                    />
                    มีค่าใช้จ่าย
                  </label>
                </div>

                {repairProgressForm.costType === 'HAS_COST' && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.2rem' }}>
                      จำนวนเงิน (บาท)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={repairProgressForm.costAmount}
                      onChange={(e) => setRepairProgressForm(prev => ({ ...prev, costAmount: e.target.value }))}
                      placeholder="เช่น 1500.00"
                      style={{ width: '200px', padding: '0.45rem', borderRadius: '0.35rem', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsRepairProgressModalOpen(false)}
                  className="backBtn"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btnProgressAction"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Cancel / Reject Job Confirmation ── */}
      {isCancelModalOpen && (
        <div className="modalBackdrop" onClick={() => setIsCancelModalOpen(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #fee2e2', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#dc2626', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #fecaca' }}>
                  <XCircle size={18} className="text-red-600" />
                </div>
                <span>ยืนยันการยกเลิก / ปฏิเสธงาน</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
                title="ปิดหน้าต่าง"
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.15rem', lineHeight: 1.5 }}>
              เมื่อยืนยันยกเลิก สถานะงานจะถูกปรับเป็น <strong style={{ color: '#dc2626' }}>&ldquo;ไม่อนุมัติ / ยกเลิก&rdquo;</strong> และระบบจะส่งการแจ้งเตือนพร้อมเหตุผลไปยังผู้เกี่ยวข้องทันที
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                ระบุเหตุผลในการยกเลิกหรือปฏิเสธ <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                rows={3}
                autoFocus
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="เช่น อุปกรณ์ไม่อยู่ในเงื่อนไขการซ่อม, มอบหมายผิดแผนก, ข้อมูลไม่ครบถ้วน, ผู้ใช้ขอยกเลิกเอง ฯลฯ"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="backBtn"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                disabled={actionLoading || !cancelReason.trim()}
                onClick={handleCancelJob}
                style={{
                  backgroundColor: !cancelReason.trim() ? '#fca5a5' : '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.6rem 1.35rem',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: !cancelReason.trim() ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)',
                  transition: 'all 0.15s ease',
                }}
              >
                {actionLoading ? <Clock size={16} className="animate-spin" /> : <XCircle size={16} />}
                <span>ยืนยันยกเลิกงาน</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
