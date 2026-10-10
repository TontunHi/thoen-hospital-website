'use client'

import React from 'react'
import {
  FileText,
  UserCheck,
  Building2,
  KeyRound,
  Home,
  ShieldCheck,
  Edit3,
  UserX,
  X,
} from 'lucide-react'
import type { RegistrationRecord } from '@/lib/registration/RegistrationService'
import type { VehicleItem } from '@/lib/registration/registrationSchema'

interface RegistrationDetailModalProps {
  item: RegistrationRecord | null
  isOpen: boolean
  onClose: () => void
  onOpenEdit: (item: RegistrationRecord) => void
  onApprove: (id: number) => void
  onReject: (id: number) => void
  getStatusBadge: (status: string) => React.ReactNode
}

export function RegistrationDetailModal({
  item,
  isOpen,
  onClose,
  onOpenEdit,
  onApprove,
  onReject,
  getStatusBadge,
}: RegistrationDetailModalProps) {
  if (!isOpen || !item) return null

  return (
    <div
      className="modalBackdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modalCard modalWide" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div className="modalHeaderLeft">
            <div className="modalHeaderIcon">
              <FileText size={20} className="text-emerald-700" />
            </div>
            <div className="modalHeaderTitleBox">
              <div className="modalHeaderTitleRow">
                <span className="reqIdPill">#{item.id}</span>
                <h3 className="modalTitle">
                  {item.title}
                  {item.firstNameTh} {item.lastNameTh}
                </h3>
                {getStatusBadge(item.status)}
              </div>
              <p className="modalSubtitle">
                ยื่นคำขอเมื่อ{' '}
                {new Date(item.createdAt).toLocaleDateString('th-TH', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                น. &bull; {item.department}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modalCloseBtn"
            onClick={onClose}
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        <div className="modalBody">
          {/* Section 1: ข้อมูลส่วนตัว */}
          <div className="detailSection">
            <h4 className="detailSectionTitle">
              <UserCheck size={16} className="text-emerald-700" />
              <span>1. ข้อมูลส่วนบุคคล</span>
            </h4>
            <div className="detailGrid">
              <div className="detailItem">
                <span className="detailLabel">เลขบัตรประชาชน:</span>
                <span className="detailVal tabularNums font-mono font-semibold text-slate-800">
                  {item.citizenId}
                </span>
              </div>
              <div className="detailItem">
                <span className="detailLabel">ชื่อ-นามสกุล (ไทย):</span>
                <span className="detailVal font-semibold text-slate-900">
                  {item.title}
                  {item.firstNameTh} {item.lastNameTh}
                </span>
              </div>
              <div className="detailItem">
                <span className="detailLabel">ชื่อ-นามสกุล (อังกฤษ):</span>
                <span className="detailVal">
                  {item.firstNameEn || item.lastNameEn
                    ? `${item.firstNameEn || ''} ${item.lastNameEn || ''}`.trim()
                    : '-'}
                </span>
              </div>
              <div className="detailItem">
                <span className="detailLabel">ชื่อเล่น:</span>
                <span className="detailVal">{item.nickname || '-'}</span>
              </div>
              <div className="detailItem">
                <span className="detailLabel">วันเกิด (พ.ศ.):</span>
                <span className="detailVal">{item.birthDate}</span>
              </div>
              <div className="detailItem">
                <span className="detailLabel">เลขที่ใบประกอบวิชาชีพ:</span>
                <span className="detailVal">{item.licenseNo || '-'}</span>
              </div>
            </div>
          </div>

          {/* Section 2: ข้อมูลตำแหน่ง */}
          <div className="detailSection">
            <h4 className="detailSectionTitle">
              <Building2 size={16} className="text-emerald-700" />
              <span>2. ข้อมูลตำแหน่งและกลุ่มงาน</span>
            </h4>
            <div className="detailGrid">
              <div className="detailItem">
                <span className="detailLabel">กลุ่มงาน / แผนก:</span>
                <span className="detailVal font-medium text-emerald-800">{item.department}</span>
              </div>
              <div className="detailItem">
                <span className="detailLabel">ตำแหน่ง:</span>
                <span className="detailVal font-medium text-slate-800">{item.position}</span>
              </div>
              <div className="detailItem">
                <span className="detailLabel">ระดับงาน:</span>
                <span className="detailVal">{item.level}</span>
              </div>
              <div className="detailItem">
                <span className="detailLabel">กลุ่มบุคคล:</span>
                <span className="detailVal">
                  {item.personnelGroup}
                  {item.personnelGroupOther ? ` (${item.personnelGroupOther})` : ''}
                </span>
              </div>
              <div className="detailItem">
                <span className="detailLabel">วันที่เริ่มปฏิบัติงาน:</span>
                <span className="detailVal">{item.startDate}</span>
              </div>
              <div className="detailItem">
                <span className="detailLabel">วันที่บรรจุ:</span>
                <span className="detailVal">{item.containDate || '-'}</span>
              </div>
            </div>
          </div>

          {/* Section 3: ติดต่อ & HOSxP */}
          <div className="detailSection">
            <h4 className="detailSectionTitle">
              <KeyRound size={16} className="text-emerald-700" />
              <span>3. ข้อมูลติดต่อ & บัญชีระบบ HOSxP</span>
            </h4>
            <div className="detailGrid">
              <div className="detailItem">
                <span className="detailLabel">อีเมล:</span>
                <span className="detailVal font-medium text-slate-800">{item.email}</span>
              </div>
              <div className="detailItem">
                <span className="detailLabel">เบอร์โทรศัพท์:</span>
                <span className="detailVal tabularNums font-medium text-slate-800">{item.phone}</span>
              </div>
              <div className="detailItem">
                <span className="detailLabel">Line ID:</span>
                <span className="detailVal">{item.lineId || '-'}</span>
              </div>
              <div className="detailItem fullWidth">
                <span className="detailLabel">สิทธิ์ระบบ HOSxP:</span>
                <div className="mt-1">
                  {item.hasHosxp ? (
                    <div className="hosxpCredentialBox">
                      <span className="hosxpBadge">ขอเปิดใช้งาน HOSxP</span>
                      <span className="hosxpItem">
                        Username: <code>{item.hosxpUser}</code>
                      </span>
                      <span className="hosxpItem">
                        Password: <code>{item.hosxpPass}</code>
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-sm">ไม่ใช้งานระบบ HOSxP</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: ที่พัก & ยานพาหนะ */}
          <div className="detailSection">
            <h4 className="detailSectionTitle">
              <Home size={16} className="text-emerald-700" />
              <span>4. สวัสดิการที่พักอาศัย & ยานพาหนะ</span>
            </h4>
            <div className="detailGrid">
              <div className="detailItem fullWidth">
                <span className="detailLabel">สถานที่พักอาศัย:</span>
                <div className="mt-0.5">
                  {item.inHospitalHousing ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-sm font-medium">
                      <Home size={14} />
                      {item.housingLocation || 'พักในโรงพยาบาล'}
                    </span>
                  ) : (
                    <span className="text-slate-500 text-sm">พักอาศัยภายนอกโรงพยาบาล</span>
                  )}
                </div>
              </div>

              <div className="detailItem fullWidth">
                <span className="detailLabel">ข้อมูลรถยนต์เข้าโซนบ้านพัก:</span>
                <div className="mt-2">
                  {item.hasVehicle && item.vehicles && Array.isArray(item.vehicles) && item.vehicles.length > 0 ? (
                    <div className="licensePlateList">
                      {item.vehicles.map((v: VehicleItem, idx: number) => (
                        <div key={idx} className="thaiLicensePlate">
                          <div className="plateMain">
                            <span className="platePrefix">{v.platePrefix}</span>
                            <span className="plateNumber">{v.plateNumber}</span>
                          </div>
                          <div className="plateProvince">{v.province}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 text-sm italic">ไม่มีรถยนต์ลงทะเบียน</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: สถานะ & การอนุมัติ */}
          <div className="detailSection">
            <h4 className="detailSectionTitle">
              <ShieldCheck size={16} className="text-emerald-700" />
              <span>5. สถานะคำขอและประวัติ</span>
            </h4>
            <div className="detailGrid">
              <div className="detailItem">
                <span className="detailLabel">สถานะปัจจุบัน:</span>
                <div className="mt-1">{getStatusBadge(item.status)}</div>
              </div>
              {item.status === 'approved' && (
                <>
                  <div className="detailItem">
                    <span className="detailLabel">ผู้อนุมัติ:</span>
                    <span className="detailVal font-medium">{item.approvedBy || '-'}</span>
                  </div>
                  <div className="detailItem">
                    <span className="detailLabel">วันที่อนุมัติ:</span>
                    <span className="detailVal">
                      {item.approvedAt
                        ? new Date(item.approvedAt).toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '-'}
                    </span>
                  </div>
                </>
              )}
              {item.status === 'rejected' && (
                <div className="detailItem fullWidth">
                  <span className="detailLabel">เหตุผลที่ปฏิเสธ:</span>
                  <div className="mt-1 p-2.5 bg-rose-50 border border-rose-200 rounded-md text-rose-700 text-sm">
                    {item.rejectReason || 'ไม่ระบุเหตุผล'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modalFooter flex flex-wrap justify-between items-center gap-3">
          <button
            type="button"
            className="btnModalEdit"
            onClick={() => {
              onClose()
              onOpenEdit(item)
            }}
          >
            <Edit3 size={15} />
            <span>แก้ไขข้อมูล</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              className="btnModalCancel"
              onClick={onClose}
            >
              <X size={15} />
              <span>ปิดหน้าต่าง</span>
            </button>

            {item.status === 'pending' && (
              <>
                <button
                  type="button"
                  className="btnModalReject"
                  onClick={() => {
                    onClose()
                    onReject(item.id)
                  }}
                >
                  <UserX size={15} />
                  <span>ปฏิเสธคำขอ</span>
                </button>

                <button
                  type="button"
                  className="btnModalApprove"
                  onClick={() => {
                    onClose()
                    onApprove(item.id)
                  }}
                >
                  <UserCheck size={15} />
                  <span>อนุมัติและสร้างบัญชี</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
