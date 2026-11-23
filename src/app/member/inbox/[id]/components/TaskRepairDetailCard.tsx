'use client'

import React from 'react'
import {
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  Edit3,
  MapPin,
  Plus,
  Stethoscope,
  User,
  Wrench,
  XCircle,
} from 'lucide-react'
import { RepairPhotoItem } from './taskDetailConfig'

export interface TaskRepairDetailCardProps {
  task: any
  repairDetail: any
  currentUser: any
  canEdit: boolean
  actionLoading: boolean
  handleOpenEditModal: () => void
  setIsCoWorkerModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  handleRemoveCoWorker: (coworkerId: number) => void
  handleAcceptJob: () => void
  setIsCancelModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  setIsRepairProgressModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  handleCompleteRepair: () => void
}

export function TaskRepairDetailCard({
  task,
  repairDetail,
  currentUser,
  canEdit,
  actionLoading,
  handleOpenEditModal,
  setIsCoWorkerModalOpen,
  handleRemoveCoWorker,
  handleAcceptJob,
  setIsCancelModalOpen,
  setIsRepairProgressModalOpen,
  handleCompleteRepair,
}: TaskRepairDetailCardProps) {
  return (
    <div className="contentCard">
      <div className="contentCardHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="contentCardTitle" style={{ margin: 0 }}>
          <Wrench size={18} className="text-emerald-600" />
          <span>รายละเอียดงานแจ้งซ่อมบำรุง</span>
        </h3>
        {canEdit && (
          <button
            type="button"
            onClick={handleOpenEditModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Edit3 size={14} />
            <span>แก้ไขข้อมูลแจ้งซ่อม</span>
          </button>
        )}
      </div>

      <div className="repairBanner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="repairIconWrap">
            {repairDetail.repair_type === 'MEDICAL_REPAIR' ? <Stethoscope size={20} /> : <Wrench size={20} />}
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
              ประเภทงานแจ้งซ่อมบำรุง
            </span>
            <strong style={{ color: '#166534', fontSize: '1rem', fontWeight: 700 }}>
              {repairDetail.repair_type === 'IT_REPAIR'
                ? 'งานซ่อมระบบคอมพิวเตอร์ / สารสนเทศ'
                : repairDetail.repair_type === 'MEDICAL_REPAIR'
                  ? 'งานซ่อมเครื่องมือทางการแพทย์'
                  : 'งานซ่อมช่างทั่วไป / ซ่อมบำรุง'}
            </strong>
          </div>
        </div>

        <span
          className={`statusBadge ${
            repairDetail.repair_status === 'COMPLETED'
              ? 'statusApproved'
              : repairDetail.repair_status === 'IN_PROGRESS'
                ? 'statusInProgress'
                : repairDetail.repair_status === 'EXTERNAL_REPAIR'
                  ? 'statusExternal'
                  : 'statusPending'
          }`}
        >
          {repairDetail.repair_status === 'COMPLETED'
            ? 'ซ่อมเสร็จสิ้น'
            : repairDetail.repair_status === 'IN_PROGRESS'
              ? 'กำลังดำเนินการซ่อม'
              : repairDetail.repair_status === 'EXTERNAL_REPAIR'
                ? 'ส่งซ่อมภายนอก'
                : 'รอช่างรับงาน'}
        </span>
      </div>

      <div className="infoGrid2Col" style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.65rem', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
        <div>
          <span className="infoItemLabel">ประเภทรายการ</span>
          <span
            style={{
              display: 'inline-block',
              padding: '0.2rem 0.6rem',
              borderRadius: '0.35rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: repairDetail.item_category === 'EQUIPMENT' ? '#dbeafe' : '#f1f5f9',
              color: repairDetail.item_category === 'EQUIPMENT' ? '#1e40af' : '#475569',
            }}
          >
            {repairDetail.item_category === 'EQUIPMENT' ? 'ครุภัณฑ์โรงพยาบาล' : 'ไม่ใช่ครุภัณฑ์ / งานทั่วไป'}
          </span>
        </div>

        <div>
          <span className="infoItemLabel" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <MapPin size={13} className="text-emerald-600" />
            สถานที่ตั้ง / ห้อง / ตึก
          </span>
          <div className="infoItemValue" style={{ fontSize: '0.9rem' }}>
            {repairDetail.location_full_name || '-'}
          </div>
        </div>

        {repairDetail.item_category === 'EQUIPMENT' ? (
          <>
            <div>
              <span className="infoItemLabel">หมายเลขครุภัณฑ์</span>
              <span className="taskNoBadge" style={{ fontSize: '0.875rem' }}>
                {repairDetail.equipment_number || '-'}
              </span>
            </div>
            <div>
              <span className="infoItemLabel">ชื่อครุภัณฑ์</span>
              <div className="infoItemValue" style={{ fontSize: '0.9rem' }}>
                {repairDetail.equipment_name || '-'}
              </div>
            </div>
          </>
        ) : (
          <div style={{ gridColumn: '1 / -1' }}>
            <span className="infoItemLabel">รายการที่ชำรุดเสียหาย</span>
            <div className="infoItemValue" style={{ fontSize: '0.9rem' }}>
              {repairDetail.non_equipment_item || '-'}
            </div>
          </div>
        )}
      </div>

      <div className="symptomBox">
        <div className="symptomBoxTitle">
          <AlertCircle size={15} />
          <span>อาการชำรุด / ปัญหาที่ผู้ใช้แจ้ง</span>
        </div>
        <div className="symptomBoxContent">{repairDetail.symptom_detail || '-'}</div>
      </div>

      {Array.isArray(repairDetail.photos) && repairDetail.photos.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <span className="infoItemLabel">รูปภาพความเสียหายแนบ ({repairDetail.photos.length} รูป)</span>
          <div className="photoThumbList">
            {repairDetail.photos.map((photo: string, idx: number) => (
              <RepairPhotoItem key={idx} photo={photo} index={idx} />
            ))}
          </div>
        </div>
      )}

      <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '0.85rem', marginTop: '0.85rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#334155' }}>
            ทีมช่างผู้รับผิดชอบงาน
          </span>
          {(currentUser?.isCurrentAssignee || currentUser?.isCoWorker || currentUser?.isAdmin) && (
            <button
              type="button"
              onClick={() => setIsCoWorkerModalOpen(true)}
              style={{
                fontSize: '0.75rem',
                color: '#16a34a',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '0.25rem 0.65rem',
                borderRadius: '0.35rem',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <Plus size={12} />
              เพิ่มช่างร่วมงาน
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: '#dcfce7',
              color: '#166534',
              padding: '0.3rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: '1px solid #bbf7d0',
            }}
          >
            <User size={13} />
            ช่างหลัก: {repairDetail.assigned_technician_name || 'ยังไม่ได้ระบุ'}
          </span>

          {Array.isArray(repairDetail.co_workers) &&
            repairDetail.co_workers.map((cw: any) => (
              <span
                key={cw.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  padding: '0.3rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  border: '1px solid #e2e8f0',
                }}
              >
                <span>{cw.name}</span>
                {(currentUser?.isCurrentAssignee || currentUser?.isAdmin) && (
                  <button
                    type="button"
                    onClick={() => handleRemoveCoWorker(cw.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '1rem',
                      lineHeight: 1,
                      marginLeft: '0.2rem',
                    }}
                    title="ลบออก"
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
        </div>
      </div>

      {(Boolean(repairDetail.found_problem) ||
        Boolean(repairDetail.solution_step) ||
        Boolean(repairDetail.is_external_repair) ||
        repairDetail.cost_type === 'HAS_COST') && (
        <div
          style={{
            marginTop: '1rem',
            backgroundColor: '#f8fafc',
            padding: '1rem',
            borderRadius: '0.65rem',
            border: '1px solid #e2e8f0',
            fontSize: '0.85rem',
          }}
        >
          <strong style={{ color: '#0f172a', display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', borderBottom: '1px solid #edf2f7', paddingBottom: '0.35rem' }}>
            บันทึกผลการตรวจซ่อมและความคืบหน้า
          </strong>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <span style={{ color: '#64748b' }}>ลักษณะการส่งซ่อม: </span>
              <strong style={{ color: '#0f172a' }}>
                {repairDetail.repair_nature === 'RETROACTIVE' ? 'ส่งซ่อมย้อนหลัง' : 'ส่งซ่อมปกติ'}
              </strong>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>ค่าใช้จ่าย: </span>
              <strong style={{ color: repairDetail.cost_type === 'HAS_COST' ? '#b45309' : '#15803d' }}>
                {repairDetail.cost_type === 'HAS_COST'
                  ? `มีค่าใช้จ่าย (${Number(repairDetail.cost_amount || 0).toLocaleString()} บาท)`
                  : 'ไม่มีค่าใช้จ่าย'}
              </strong>
            </div>
          </div>

          {Boolean(repairDetail.is_external_repair) && (
            <div style={{ backgroundColor: '#fef3c7', padding: '0.5rem 0.75rem', borderRadius: '0.35rem', color: '#92400e', marginBottom: '0.5rem' }}>
              <strong>ส่งซ่อมภายนอก: </strong> ร้าน/บริษัท {repairDetail.external_vendor_name || '-'}
              {repairDetail.external_reason && <span> (เหตุผล: {repairDetail.external_reason})</span>}
            </div>
          )}

          {repairDetail.found_problem && (
            <div style={{ marginTop: '0.4rem' }}>
              <span style={{ color: '#64748b', display: 'block', fontWeight: 600 }}>สาเหตุ/ปัญหาที่ตรวจพบ:</span>
              <div style={{ color: '#1e293b', whiteSpace: 'pre-line' }}>{repairDetail.found_problem}</div>
            </div>
          )}

          {repairDetail.solution_step && (
            <div style={{ marginTop: '0.4rem' }}>
              <span style={{ color: '#64748b', display: 'block', fontWeight: 600 }}>แนวทาง/ผลการดำเนินการแก้ไข:</span>
              <div style={{ color: '#1e293b', whiteSpace: 'pre-line' }}>{repairDetail.solution_step}</div>
            </div>
          )}
        </div>
      )}

      {(currentUser?.isCurrentAssignee || currentUser?.isCoWorker || currentUser?.isAdmin) && (
        <div className="technicianActionBox">
          <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.65rem' }}>
            แผงควบคุมการดำเนินงานช่าง
          </span>
          <div className="actionButtonRow">
            {repairDetail.repair_status === 'WAITING' && (
              <>
                <button type="button" disabled={actionLoading} onClick={handleAcceptJob} className="btnAcceptJob">
                  <CheckCircle size={16} />
                  <span>กดรับงานซ่อม (Accept Job)</span>
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsCancelModalOpen(true)}
                  className="btnCancelJob"
                >
                  <XCircle size={16} />
                  <span>ปฏิเสธ / ยกเลิกงาน</span>
                </button>
              </>
            )}

            {(repairDetail.repair_status === 'IN_PROGRESS' || repairDetail.repair_status === 'EXTERNAL_REPAIR') && (
              <>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsRepairProgressModalOpen(true)}
                  className="btnProgressAction"
                >
                  <Edit3 size={15} />
                  <span>บันทึกผลการซ่อม / ส่งภายนอก</span>
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleCompleteRepair}
                  className="btnCompleteJob"
                >
                  <CheckCircle2 size={16} />
                  <span>ซ่อมเสร็จสิ้น (Complete Repair)</span>
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsCancelModalOpen(true)}
                  className="btnCancelJob"
                >
                  <XCircle size={16} />
                  <span>ยกเลิกงานซ่อม</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {currentUser?.isRequester &&
        task.status === 'PENDING' &&
        !currentUser?.isCurrentAssignee &&
        !currentUser?.isCoWorker &&
        !currentUser?.isAdmin && (
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => setIsCancelModalOpen(true)}
              className="btnCancelJob"
            >
              <XCircle size={16} />
              <span>ยกเลิกคำร้องแจ้งซ่อมนี้</span>
            </button>
          </div>
        )}
    </div>
  )
}
