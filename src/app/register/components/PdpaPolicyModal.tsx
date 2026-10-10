'use client'

import React from 'react'
import {
  ShieldCheck,
  FileText,
  CheckCircle2,
  Lock,
  UserCheck,
  Building2,
  X,
  Check,
  ExternalLink,
} from 'lucide-react'

interface PdpaPolicyModalProps {
  isOpen: boolean
  onClose: () => void
  onAccept: () => void
}

export function PdpaPolicyModal({ isOpen, onClose, onAccept }: PdpaPolicyModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="modalBackdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modalCard pdpaModalCard" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="pdpaModalHeader">
          <div className="pdpaHeaderLeft">
            <div className="pdpaHeaderIconBadge">
              <ShieldCheck size={24} className="text-emerald-700" />
            </div>
            <div className="pdpaHeaderTitleBox">
              <div className="flex flex-wrap items-center gap-2">
                <span className="pdpaLawTag">พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562</span>
              </div>
              <h3 className="pdpaModalTitle">ประกาศนโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)</h3>
              <p className="pdpaModalSubtitle">
                โรงพยาบาลเถิน จังหวัดลำปาง &bull; สำหรับบุคลากรและเจ้าหน้าที่ผู้ขอลงทะเบียนเข้าใช้งานระบบ
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

        {/* Modal Body */}
        <div className="modalBody pdpaModalBody">
          {/* Hero Banner */}
          <div className="pdpaHeroBanner">
            <div className="flex items-start gap-3">
              <ShieldCheck size={22} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-emerald-950 text-sm sm:text-base">
                  ความมุ่งมั่นในการคุ้มครองข้อมูลส่วนบุคคลของโรงพยาบาลเถิน
                </h4>
                <p className="text-xs sm:text-sm text-emerald-800 mt-1 leading-relaxed">
                  โรงพยาบาลเถินตระหนักถึงสิทธิความเป็นส่วนตัวและความปลอดภัยของข้อมูลส่วนบุคคลของบุคลากรทุกคน 
                  ข้อมูลที่ท่านบันทึกในระบบจะถูกจัดเก็บและประมวลผลอย่างโปร่งใส มีมาตรการรักษาความมั่นคงปลอดภัยตามมาตรฐาน 
                  และนำไปใช้เพื่อประโยชน์ในการบริหารงานบุคคลและการปฏิบัติหน้าที่เท่านั้น
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: Data Collected */}
          <div className="pdpaSectionCard">
            <div className="pdpaSectionHeader">
              <div className="pdpaSectionIcon bg-blue-50 text-blue-700 border-blue-200">
                <FileText size={18} />
              </div>
              <div>
                <h4 className="pdpaSectionTitle">1. ข้อมูลส่วนบุคคลที่มีการจัดเก็บและประมวลผล</h4>
                <p className="pdpaSectionDesc">ประเภทของข้อมูลที่จำเป็นต่อการปฏิบัติงานและการยืนยันตัวตน</p>
              </div>
            </div>
            <div className="pdpaPillGrid">
              <div className="pdpaPillItem">
                <span className="pdpaPillIcon">🪪</span>
                <div>
                  <strong className="text-slate-800">ข้อมูลระบุตัวตน:</strong>
                  <span className="text-slate-600 block text-xs mt-0.5">
                    เลขประจำตัวประชาชน 13 หลัก, คำนำหน้า, ชื่อ-นามสกุล (ไทย/อังกฤษ), ชื่อเล่น, วันเดือนปีเกิด
                  </span>
                </div>
              </div>
              <div className="pdpaPillItem">
                <span className="pdpaPillIcon">💼</span>
                <div>
                  <strong className="text-slate-800">ข้อมูลการปฏิบัติงาน:</strong>
                  <span className="text-slate-600 block text-xs mt-0.5">
                    กลุ่มงาน/แผนก, ตำแหน่ง, ระดับงาน, ประเภทการจ้างงาน, วันที่เริ่มงาน, เลขที่ใบประกอบวิชาชีพ
                  </span>
                </div>
              </div>
              <div className="pdpaPillItem">
                <span className="pdpaPillIcon">🔐</span>
                <div>
                  <strong className="text-slate-800">ข้อมูลสิทธิ์ระบบงาน:</strong>
                  <span className="text-slate-600 block text-xs mt-0.5">
                    ชื่อผู้ใช้งานและรหัสผ่านระบบ HOSxP, สิทธิ์เข้าใช้ระบบบริการและใบรับรองเงินเดือน
                  </span>
                </div>
              </div>
              <div className="pdpaPillItem">
                <span className="pdpaPillIcon">🏠</span>
                <div>
                  <strong className="text-slate-800">ข้อมูลสวัสดิการ & ยานพาหนะ:</strong>
                  <span className="text-slate-600 block text-xs mt-0.5">
                    การพักอาศัยในแฟลต/บ้านพักโรงพยาบาล, ทะเบียนรถยนต์เข้า-ออกโซนบ้านพัก (สูงสุด 2 คัน)
                  </span>
                </div>
              </div>
              <div className="pdpaPillItem">
                <span className="pdpaPillIcon">📞</span>
                <div>
                  <strong className="text-slate-800">ข้อมูลการติดต่อ:</strong>
                  <span className="text-slate-600 block text-xs mt-0.5">
                    อีเมลทางการ, เบอร์โทรศัพท์เคลื่อนที่, Line ID
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Purposes */}
          <div className="pdpaSectionCard">
            <div className="pdpaSectionHeader">
              <div className="pdpaSectionIcon bg-emerald-50 text-emerald-700 border-emerald-200">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h4 className="pdpaSectionTitle">2. วัตถุประสงค์ในการเก็บรวบรวมและนำไปใช้</h4>
                <p className="pdpaSectionDesc">วัตถุประสงค์อันชอบด้วยกฎหมายในการบริหารจัดการโรงพยาบาล</p>
              </div>
            </div>
            <ul className="pdpaCheckList">
              <li>
                <Check size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>การบริหารงานบุคคล:</strong> เพื่อจัดทำทะเบียนประวัติ ทำเนียบบุคลากร และตรวจสอบสถานะการปฏิบัติงาน</span>
              </li>
              <li>
                <Check size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>การเปิดสิทธิ์ระบบสารสนเทศ:</strong> เพื่อยืนยันตัวบุคคลในการเข้าถึง HOSxP, Member Portal, และระบบสลิปเงินเดือน</span>
              </li>
              <li>
                <Check size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>การจัดสรรสวัสดิการ:</strong> เพื่อบริหารจัดการบ้านพัก แฟลตบุคลากร และบันทึกยานพาหนะเข้าออกเพื่อความปลอดภัย</span>
              </li>
              <li>
                <Check size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>การติดต่อประสานงาน:</strong> เพื่อส่งข้อมูลประกาศ ข่าวสารสำคัญของโรงพยาบาล และการติดต่อกรณีฉุกเฉิน</span>
              </li>
            </ul>
          </div>

          {/* Section 3: Security */}
          <div className="pdpaSectionCard">
            <div className="pdpaSectionHeader">
              <div className="pdpaSectionIcon bg-amber-50 text-amber-700 border-amber-200">
                <Lock size={18} />
              </div>
              <div>
                <h4 className="pdpaSectionTitle">3. มาตรการรักษาความมั่นคงปลอดภัยของข้อมูล</h4>
                <p className="pdpaSectionDesc">การควบคุมการเข้าถึงและมาตรฐานการเข้ารหัสข้อมูลที่รัดกุม</p>
              </div>
            </div>
            <div className="pdpaSecurityGrid">
              <div className="pdpaSecurityBox">
                <span className="font-semibold text-slate-800 block text-xs">🔒 การเข้ารหัสข้อมูล</span>
                <span className="text-slate-600 text-xs">
                  รหัสผ่านและข้อมูลอ่อนไหวจะถูกเข้ารหัสทางคณิตศาสตร์ ไม่ถูกจัดเก็บในรูปข้อความธรรมดา
                </span>
              </div>
              <div className="pdpaSecurityBox">
                <span className="font-semibold text-slate-800 block text-xs">🛡️ สิทธิ์ตามบทบาท (RBAC)</span>
                <span className="text-slate-600 text-xs">
                  จำกัดการเข้าถึงเฉพาะเจ้าหน้าที่ฝ่ายบริหารงานบุคคลและผู้ดูแลระบบที่ได้รับอนุญาตเท่านั้น
                </span>
              </div>
              <div className="pdpaSecurityBox">
                <span className="font-semibold text-slate-800 block text-xs">📋 บันทึกประวัติ (Audit Logs)</span>
                <span className="text-slate-600 text-xs">
                  มีระบบบันทึกประวัติการเรียกดูและอนุมัติข้อมูลทุกขั้นตอน เพื่อความโปร่งใสและตรวจสอบได้
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Data Subject Rights */}
          <div className="pdpaSectionCard">
            <div className="pdpaSectionHeader">
              <div className="pdpaSectionIcon bg-purple-50 text-purple-700 border-purple-200">
                <UserCheck size={18} />
              </div>
              <div>
                <h4 className="pdpaSectionTitle">4. สิทธิของเจ้าของข้อมูลส่วนบุคคลตามกฎหมาย</h4>
                <p className="pdpaSectionDesc">สิทธิที่บุคลากรสามารถใช้ได้ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล</p>
              </div>
            </div>
            <div className="pdpaRightsGrid">
              <div className="pdpaRightItem">
                <span className="pdpaRightBadge">สิทธิขอเข้าถึง</span>
                <span className="text-xs text-slate-600">ขอตรวจสอบและขอรับสำเนาข้อมูลส่วนบุคคลของตนเอง</span>
              </div>
              <div className="pdpaRightItem">
                <span className="pdpaRightBadge">สิทธิขอแก้ไข</span>
                <span className="text-xs text-slate-600">ขอปรับปรุงข้อมูลให้ถูกต้อง เป็นปัจจุบัน และสมบูรณ์</span>
              </div>
              <div className="pdpaRightItem">
                <span className="pdpaRightBadge">สิทธิขอลบ/ระงับ</span>
                <span className="text-xs text-slate-600">ขอลบหรือระงับใช้เมื่อสิ้นสุดสภาพการปฏิบัติงาน</span>
              </div>
              <div className="pdpaRightItem">
                <span className="pdpaRightBadge">สิทธิขอเพิกถอน</span>
                <span className="text-xs text-slate-600">เพิกถอนความยินยอมตามเงื่อนไขที่กฎหมายกำหนด</span>
              </div>
            </div>
          </div>

          {/* Section 5: Contact */}
          <div className="pdpaContactCard">
            <div className="flex items-start gap-3">
              <Building2 size={20} className="text-slate-700 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-800">ช่องทางการติดต่อเจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (DPO):</p>
                <p className="mt-0.5">กลุ่มงานบริหารทั่วไป และ ศูนย์คอมพิวเตอร์ โรงพยาบาลเถิน</p>
                <p>199 หมู่ 7 ตำบลล้อมแรด อำเภอเถิน จังหวัดลำปาง 52160 &bull; โทรศัพท์: 054-291-536 ต่อ 111</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modalFooter pdpaModalFooter">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <span className="text-xs text-slate-500 text-center sm:text-left">
              การกดยอมรับแสดงว่าท่านได้รับทราบและเข้าใจนโยบายความคุ้มครองนี้แล้ว
            </span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                className="btnSecondary flex-1 sm:flex-none text-xs sm:text-sm py-2 px-4 h-10"
                onClick={onClose}
              >
                <span>ปิดหน้าต่าง</span>
              </button>
              <button
                type="button"
                className="btnPrimary flex-1 sm:flex-none text-xs sm:text-sm py-2 px-5 h-10 shadow-sm"
                onClick={onAccept}
              >
                <Check size={16} />
                <span>เข้าใจและยินยอมนโยบาย</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
