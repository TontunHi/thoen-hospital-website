'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  User,
  Briefcase,
  KeyRound,
  Home,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Car,
  FileCheck,
  Edit3,
  Phone,
  Mail,
  Building2,
  Sparkles,
} from 'lucide-react'
import {
  WORK_DEPARTMENTS,
  POSITIONS,
  JOB_LEVELS,
  PERSONNEL_GROUPS,
  TITLES,
  HOUSING_LOCATIONS,
  THAI_PROVINCES,
  THAI_MONTHS,
} from '@/lib/registration/registrationConstants'
import './page.css'

interface VehicleItem {
  platePrefix: string
  plateNumber: string
  province: string
}

interface FormData {
  // Step 1: Personal Info
  citizenId: string
  title: string
  customTitle: string
  firstNameTh: string
  lastNameTh: string
  firstNameEn: string
  lastNameEn: string
  nickname: string
  licenseNo: string
  birthDay: string
  birthMonth: string
  birthYear: string

  // Step 2: Work & Position
  startDay: string
  startMonth: string
  startYear: string
  containDay: string
  containMonth: string
  containYear: string
  department: string
  position: string
  level: string
  personnelGroup: string
  personnelGroupOther: string

  // Step 3: Contact & HOSxP
  hasHosxp: boolean
  hosxpUser: string
  hosxpPass: string
  email: string
  phone: string
  lineId: string

  // Step 4: Housing & Vehicles
  inHospitalHousing: boolean
  housingLocation: string
  hasVehicle: boolean
  vehicleCount: number
  vehicles: VehicleItem[]

  // Step 5: Consent
  consentPolicy: boolean
}

const initialForm: FormData = {
  citizenId: '',
  title: 'นาย',
  customTitle: '',
  firstNameTh: '',
  lastNameTh: '',
  firstNameEn: '',
  lastNameEn: '',
  nickname: '',
  licenseNo: '',
  birthDay: '01',
  birthMonth: '01',
  birthYear: '2540',

  startDay: '01',
  startMonth: '01',
  startYear: '2567',
  containDay: '',
  containMonth: '',
  containYear: '',
  department: WORK_DEPARTMENTS[0],
  position: POSITIONS[0],
  level: JOB_LEVELS[0],
  personnelGroup: PERSONNEL_GROUPS[0],
  personnelGroupOther: '',

  hasHosxp: false,
  hosxpUser: '',
  hosxpPass: '',
  email: '',
  phone: '',
  lineId: '',

  inHospitalHousing: false,
  housingLocation: HOUSING_LOCATIONS[0],
  hasVehicle: false,
  vehicleCount: 1,
  vehicles: [{ platePrefix: '', plateNumber: '', province: 'ลำปาง' }],

  consentPolicy: false,
}

// Generate years from 2480 to 2575 (Buddhist years)
const currentYearBuddhist = new Date().getFullYear() + 543
const yearsList = Array.from({ length: 95 }, (_, i) => String(currentYearBuddhist + 5 - i))
const daysList = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))

export default function RegisterClientView() {
  const [step, setStep] = useState<number>(1)
  const [form, setForm] = useState<FormData>(initialForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [showPolicyModal, setShowPolicyModal] = useState(false)

  const updateField = (field: keyof FormData, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    // Clear error for that field
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const updateVehicle = (index: number, key: keyof VehicleItem, val: string) => {
    setForm((prev) => {
      const nextVehicles = [...prev.vehicles]
      if (!nextVehicles[index]) {
        nextVehicles[index] = { platePrefix: '', plateNumber: '', province: 'ลำปาง' }
      }
      nextVehicles[index] = { ...nextVehicles[index], [key]: val }
      return { ...prev, vehicles: nextVehicles }
    })
  }

  const handleVehicleCountChange = (count: number) => {
    setForm((prev) => {
      const current = [...prev.vehicles]
      if (count === 1) {
        return { ...prev, vehicleCount: 1, vehicles: [current[0] || { platePrefix: '', plateNumber: '', province: 'ลำปาง' }] }
      } else {
        return {
          ...prev,
          vehicleCount: 2,
          vehicles: [
            current[0] || { platePrefix: '', plateNumber: '', province: 'ลำปาง' },
            current[1] || { platePrefix: '', plateNumber: '', province: 'ลำปาง' },
          ],
        }
      }
    })
  }

  // Validate step before advancing
  const validateCurrentStep = (currentStep: number): boolean => {
    const errs: Record<string, string> = {}

    if (currentStep === 1) {
      if (!form.citizenId.trim()) {
        errs.citizenId = 'กรุณากรอกเลขบัตรประชาชน 13 หลัก'
      } else if (!/^\d{13}$/.test(form.citizenId.trim())) {
        errs.citizenId = 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก'
      }

      if (form.title === 'อื่นๆ' && !form.customTitle.trim()) {
        errs.customTitle = 'กรุณาระบุคำนำหน้า'
      }

      if (!form.firstNameTh.trim()) errs.firstNameTh = 'กรุณากรอกชื่อภาษาไทย'
      if (!form.lastNameTh.trim()) errs.lastNameTh = 'กรุณากรอกนามสกุลภาษาไทย'
      if (!form.firstNameEn.trim()) errs.firstNameEn = 'กรุณากรอกชื่อภาษาอังกฤษ'
      if (!form.lastNameEn.trim()) errs.lastNameEn = 'กรุณากรอกนามสกุลภาษาอังกฤษ'
      if (!form.nickname.trim()) errs.nickname = 'กรุณากรอกชื่อเล่น'
      if (!form.birthDay || !form.birthMonth || !form.birthYear) {
        errs.birthDate = 'กรุณาระบุวันเดือนปีเกิดให้ครบถ้วน'
      }
    }

    if (currentStep === 2) {
      if (!form.department) errs.department = 'กรุณาเลือกกลุ่มงาน'
      if (!form.position) errs.position = 'กรุณาเลือกตำแหน่ง'
      if (!form.level) errs.level = 'กรุณาเลือกระดับงาน'
      if (!form.personnelGroup) errs.personnelGroup = 'กรุณาเลือกกลุ่มบุคคล'
      if (!form.startDay || !form.startMonth || !form.startYear) {
        errs.startDate = 'กรุณาระบุวันที่เริ่มปฏิบัติงานให้ครบถ้วน'
      }
    }

    if (currentStep === 3) {
      if (!form.email.trim()) {
        errs.email = 'กรุณากรอกอีเมล'
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        errs.email = 'รูปแบบอีเมลไม่ถูกต้อง'
      }

      if (!form.phone.trim()) {
        errs.phone = 'กรุณากรอกเบอร์โทรศัพท์'
      } else if (form.phone.replace(/\D/g, '').length < 9) {
        errs.phone = 'เบอร์โทรศัพท์ต้องมีอย่างน้อย 9-10 หลัก'
      }

      if (form.hasHosxp) {
        if (!form.hosxpUser.trim()) errs.hosxpUser = 'กรุณากรอกชื่อผู้ใช้งาน HOSxP'
        if (!form.hosxpPass.trim()) errs.hosxpPass = 'กรุณากรอกรหัสผ่านผู้ใช้งาน HOSxP'
      }
    }

    if (currentStep === 4) {
      if (form.inHospitalHousing && !form.housingLocation) {
        errs.housingLocation = 'กรุณาเลือกบ้านพัก/แฟลต'
      }

      if (form.hasVehicle) {
        for (let i = 0; i < form.vehicleCount; i++) {
          const v = form.vehicles[i]
          if (!v || !v.platePrefix.trim() || !v.plateNumber.trim() || !v.province) {
            errs[`vehicle_${i}`] = `กรุณากรอกข้อมูลรถคันที่ ${i + 1} ให้ครบถ้วน (หมวดอักษร, เลขทะเบียน, จังหวัด)`
          }
        }
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => {
    if (validateCurrentStep(step)) {
      setStep((prev) => Math.min(prev + 1, 5))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handlePrev = () => {
    setStep((prev) => Math.max(prev - 1, 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleFinalSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitError('')

    if (!form.consentPolicy) {
      setErrors({ consentPolicy: 'กรุณายินยอมนโยบายคุ้มครองข้อมูลส่วนบุคคลก่อนส่งคำขอ' })
      return
    }

    setIsSubmitting(true)

    // Build payload
    const effectiveTitle = form.title === 'อื่นๆ' ? form.customTitle.trim() : form.title
    const birthDateStr = `${form.birthDay}/${form.birthMonth}/${form.birthYear}`
    const startDateStr = `${form.startDay}/${form.startMonth}/${form.startYear}`
    const containDateStr =
      form.containDay && form.containMonth && form.containYear
        ? `${form.containDay}/${form.containMonth}/${form.containYear}`
        : null

    const payload = {
      citizenId: form.citizenId.trim(),
      title: effectiveTitle,
      firstNameTh: form.firstNameTh.trim(),
      lastNameTh: form.lastNameTh.trim(),
      firstNameEn: form.firstNameEn.trim(),
      lastNameEn: form.lastNameEn.trim(),
      nickname: form.nickname.trim(),
      licenseNo: form.licenseNo.trim() || null,
      birthDate: birthDateStr,
      startDate: startDateStr,
      containDate: containDateStr,
      department: form.department,
      position: form.position,
      level: form.level,
      personnelGroup: form.personnelGroup,
      personnelGroupOther: form.personnelGroup === 'อื่นๆ' ? form.personnelGroupOther.trim() || null : null,
      hasHosxp: form.hasHosxp,
      hosxpUser: form.hasHosxp ? form.hosxpUser.trim() : null,
      hosxpPass: form.hasHosxp ? form.hosxpPass.trim() : null,
      email: form.email.trim(),
      phone: form.phone.trim(),
      lineId: form.lineId.trim() || null,
      inHospitalHousing: form.inHospitalHousing,
      housingLocation: form.inHospitalHousing ? form.housingLocation : null,
      hasVehicle: form.hasVehicle,
      vehicles: form.hasVehicle
        ? form.vehicles.slice(0, form.vehicleCount).map((v) => ({
            platePrefix: v.platePrefix.trim(),
            plateNumber: v.plateNumber.trim(),
            province: v.province,
          }))
        : null,
      consentPolicy: true,
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setIsSuccess(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setSubmitError(data.error || 'เกิดข้อผิดพลาดในการส่งคำขอ กรุณาลองใหม่อีกครั้ง')
      }
    } catch {
      setSubmitError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <main className="registerPage">
        <div className="registerContainer">
          <div className="registerSuccessCard">
            <div className="successIconWrap">
              <CheckCircle2 size={48} className="text-emerald-600" />
            </div>
            <h1 className="successTitle">ส่งคำขอลงทะเบียนเรียบร้อยแล้ว</h1>
            <p className="successDesc">
              ข้อมูลของคุณถูกบันทึกเข้าสู่ระบบโรงพยาบาลเถินแล้ว ผู้ดูแลระบบจะดำเนินการตรวจสอบและอนุมัติการเข้าใช้งานระบบ
            </p>

            <div className="successDetailsBox">
              <div className="summaryRow">
                <span className="summaryLabel">ชื่อ-นามสกุล:</span>
                <span className="summaryValue font-medium">
                  {form.title === 'อื่นๆ' ? form.customTitle : form.title}
                  {form.firstNameTh} {form.lastNameTh}
                </span>
              </div>
              <div className="summaryRow">
                <span className="summaryLabel">เลขบัตรประชาชน:</span>
                <span className="summaryValue">
                  {form.citizenId.slice(0, 1)}-xxxx-xxxxx-{form.citizenId.slice(-2)}
                </span>
              </div>
              <div className="summaryRow">
                <span className="summaryLabel">กลุ่มงาน / ตำแหน่ง:</span>
                <span className="summaryValue">
                  {form.department} / {form.position}
                </span>
              </div>
              <div className="summaryRow">
                <span className="summaryLabel">อีเมล:</span>
                <span className="summaryValue">{form.email}</span>
              </div>
            </div>

            <div className="successNotice">
              <Sparkles size={20} className="text-emerald-600 flex-shrink-0" />
              <p>
                เมื่อได้รับการอนุมัติแล้ว ท่านจะสามารถเข้าสู่ระบบสมาชิก (Member Portal) โดยใช้เลขบัตรประชาชนและรหัส OTP
                ผ่านอีเมลที่ได้ลงทะเบียนไว้
              </p>
            </div>

            <Link href="/" className="btnPrimary mt-6 w-full text-center">
              กลับสู่หน้าหลักโรงพยาบาล
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const stepsMeta = [
    { num: 1, title: 'ข้อมูลส่วนตัว', icon: User },
    { num: 2, title: 'งานและตำแหน่ง', icon: Briefcase },
    { num: 3, title: 'ติดต่อ & HOSxP', icon: KeyRound },
    { num: 4, title: 'ที่พัก & ยานพาหนะ', icon: Home },
    { num: 5, title: 'ตรวจทาน & ยินยอม', icon: FileCheck },
  ]

  return (
    <main className="registerPage">
      <div className="registerContainer">
        {/* Header Branding */}
        <header className="registerHeader">
          <div className="hospitalLogoPill">
            <Building2 size={16} className="text-emerald-700" />
            <span>โรงพยาบาลเถิน จ.ลำปาง</span>
          </div>
          <h1 className="registerMainTitle">ลงทะเบียนบุคลากรใหม่</h1>
          <p className="registerSubtitle">
            กรอกข้อมูลเพื่อขอเปิดบัญชีเข้าใช้งานระบบสารสนเทศและบริการสมาชิกโรงพยาบาล
          </p>
        </header>

        {/* Step Progress Navigation */}
        <nav className="stepProgressBar" aria-label="ขั้นตอนการลงทะเบียน">
          {stepsMeta.map((s) => {
            const Icon = s.icon
            const isCompleted = step > s.num
            const isCurrent = step === s.num
            return (
              <button
                key={s.num}
                type="button"
                className={`stepTabBtn ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => {
                  if (s.num < step) setStep(s.num)
                }}
                disabled={s.num > step}
              >
                <div className="stepTabIcon">
                  {isCompleted ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </div>
                <span className="stepTabLabel">
                  <span className="stepNumber">ขั้นที่ {s.num}</span>
                  <span className="stepTitle">{s.title}</span>
                </span>
              </button>
            )
          })}
        </nav>

        {/* Form Card */}
        <section className="formCard">
          <div className="stepBadgeRow">
            <span className="currentStepBadge">ขั้นตอนที่ {step} จาก 5</span>
            <span className="requiredLegend">
              <span className="requiredStar">*</span> ช่องบังคับกรอก
            </span>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              STEP 1: Personal Info
             ══════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="stepSection">
              <h2 className="stepSectionTitle">
                <User size={20} className="text-emerald-600" />
                ข้อมูลส่วนบุคคลพื้นฐาน
              </h2>

              <div className="fieldGroup">
                <label className="inputLabel" htmlFor="citizenId">
                  เลขบัตรประจำตัวประชาชน (13 หลัก) <span className="requiredStar">*</span>
                </label>
                <input
                  id="citizenId"
                  type="text"
                  inputMode="numeric"
                  maxLength={13}
                  placeholder="3520500123456"
                  className={`textInput tabularNums ${errors.citizenId ? 'inputError' : ''}`}
                  value={form.citizenId}
                  onChange={(e) => updateField('citizenId', e.target.value.replace(/\D/g, ''))}
                  autoComplete="off"
                />
                {errors.citizenId && <p className="fieldError">{errors.citizenId}</p>}
                <p className="fieldHint">ตัวเลข 13 หลัก ไม่ต้องใส่ขีดคั่น ใช้สำหรับยืนยันตัวตนเข้าสู่ระบบ</p>
              </div>

              <div className="grid2Col">
                <div className="fieldGroup">
                  <label className="inputLabel" htmlFor="title">
                    คำนำหน้าชื่อ <span className="requiredStar">*</span>
                  </label>
                  <select
                    id="title"
                    className="selectInput"
                    value={form.title}
                    onChange={(e) => updateField('title', e.target.value)}
                  >
                    {TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {form.title === 'อื่นๆ' && (
                  <div className="fieldGroup">
                    <label className="inputLabel" htmlFor="customTitle">
                      ระบุคำนำหน้าชื่อ <span className="requiredStar">*</span>
                    </label>
                    <input
                      id="customTitle"
                      type="text"
                      className={`textInput ${errors.customTitle ? 'inputError' : ''}`}
                      placeholder="เช่น อาจารย์, ดร."
                      value={form.customTitle}
                      onChange={(e) => updateField('customTitle', e.target.value)}
                    />
                    {errors.customTitle && <p className="fieldError">{errors.customTitle}</p>}
                  </div>
                )}
              </div>

              <div className="grid2Col">
                <div className="fieldGroup">
                  <label className="inputLabel" htmlFor="firstNameTh">
                    ชื่อ (ภาษาไทย) <span className="requiredStar">*</span>
                  </label>
                  <input
                    id="firstNameTh"
                    type="text"
                    className={`textInput ${errors.firstNameTh ? 'inputError' : ''}`}
                    placeholder="สมชาย"
                    value={form.firstNameTh}
                    onChange={(e) => updateField('firstNameTh', e.target.value)}
                  />
                  {errors.firstNameTh && <p className="fieldError">{errors.firstNameTh}</p>}
                </div>

                <div className="fieldGroup">
                  <label className="inputLabel" htmlFor="lastNameTh">
                    นามสกุล (ภาษาไทย) <span className="requiredStar">*</span>
                  </label>
                  <input
                    id="lastNameTh"
                    type="text"
                    className={`textInput ${errors.lastNameTh ? 'inputError' : ''}`}
                    placeholder="ใจดี"
                    value={form.lastNameTh}
                    onChange={(e) => updateField('lastNameTh', e.target.value)}
                  />
                  {errors.lastNameTh && <p className="fieldError">{errors.lastNameTh}</p>}
                </div>
              </div>

              <div className="grid2Col">
                <div className="fieldGroup">
                  <label className="inputLabel" htmlFor="firstNameEn">
                    First Name (English) <span className="requiredStar">*</span>
                  </label>
                  <input
                    id="firstNameEn"
                    type="text"
                    className={`textInput ${errors.firstNameEn ? 'inputError' : ''}`}
                    placeholder="Somchai"
                    value={form.firstNameEn}
                    onChange={(e) => updateField('firstNameEn', e.target.value)}
                  />
                  {errors.firstNameEn && <p className="fieldError">{errors.firstNameEn}</p>}
                </div>

                <div className="fieldGroup">
                  <label className="inputLabel" htmlFor="lastNameEn">
                    Last Name (English) <span className="requiredStar">*</span>
                  </label>
                  <input
                    id="lastNameEn"
                    type="text"
                    className={`textInput ${errors.lastNameEn ? 'inputError' : ''}`}
                    placeholder="Jaidee"
                    value={form.lastNameEn}
                    onChange={(e) => updateField('lastNameEn', e.target.value)}
                  />
                  {errors.lastNameEn && <p className="fieldError">{errors.lastNameEn}</p>}
                </div>
              </div>

              <div className="grid2Col">
                <div className="fieldGroup">
                  <label className="inputLabel" htmlFor="nickname">
                    ชื่อเล่น <span className="requiredStar">*</span>
                  </label>
                  <input
                    id="nickname"
                    type="text"
                    className={`textInput ${errors.nickname ? 'inputError' : ''}`}
                    placeholder="ชาย"
                    value={form.nickname}
                    onChange={(e) => updateField('nickname', e.target.value)}
                  />
                  {errors.nickname && <p className="fieldError">{errors.nickname}</p>}
                </div>

                <div className="fieldGroup">
                  <label className="inputLabel" htmlFor="licenseNo">
                    เลขที่ใบประกอบวิชาชีพ <span className="optionalTag">(ถ้ามี)</span>
                  </label>
                  <input
                    id="licenseNo"
                    type="text"
                    className="textInput"
                    placeholder="เช่น ว.12345 หรือ พ.12345"
                    value={form.licenseNo}
                    onChange={(e) => updateField('licenseNo', e.target.value)}
                  />
                </div>
              </div>

              {/* Date of birth */}
              <div className="fieldGroup">
                <label className="inputLabel">
                  วันเดือนปีเกิด (พ.ศ.) <span className="requiredStar">*</span>
                </label>
                <div className="dateDropdownRow">
                  <select
                    className="selectInput dateDay"
                    aria-label="วันเกิด"
                    value={form.birthDay}
                    onChange={(e) => updateField('birthDay', e.target.value)}
                  >
                    {daysList.map((d) => (
                      <option key={d} value={d}>
                        {parseInt(d, 10)}
                      </option>
                    ))}
                  </select>

                  <select
                    className="selectInput dateMonth"
                    aria-label="เดือนเกิด"
                    value={form.birthMonth}
                    onChange={(e) => updateField('birthMonth', e.target.value)}
                  >
                    {THAI_MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="selectInput dateYear"
                    aria-label="ปีเกิด พ.ศ."
                    value={form.birthYear}
                    onChange={(e) => updateField('birthYear', e.target.value)}
                  >
                    {yearsList.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.birthDate && <p className="fieldError">{errors.birthDate}</p>}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 2: Work & Position
             ══════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="stepSection">
              <h2 className="stepSectionTitle">
                <Briefcase size={20} className="text-emerald-600" />
                ข้อมูลตำแหน่งและการปฏิบัติงาน
              </h2>

              <div className="fieldGroup">
                <label className="inputLabel" htmlFor="department">
                  กลุ่มงาน / แผนก <span className="requiredStar">*</span>
                </label>
                <select
                  id="department"
                  className={`selectInput ${errors.department ? 'inputError' : ''}`}
                  value={form.department}
                  onChange={(e) => updateField('department', e.target.value)}
                >
                  {WORK_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                {errors.department && <p className="fieldError">{errors.department}</p>}
              </div>

              <div className="fieldGroup">
                <label className="inputLabel" htmlFor="position">
                  ตำแหน่ง <span className="requiredStar">*</span>
                </label>
                <select
                  id="position"
                  className={`selectInput ${errors.position ? 'inputError' : ''}`}
                  value={form.position}
                  onChange={(e) => updateField('position', e.target.value)}
                >
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
                {errors.position && <p className="fieldError">{errors.position}</p>}
              </div>

              <div className="grid2Col">
                <div className="fieldGroup">
                  <label className="inputLabel" htmlFor="level">
                    ระดับงาน <span className="requiredStar">*</span>
                  </label>
                  <select
                    id="level"
                    className="selectInput"
                    value={form.level}
                    onChange={(e) => updateField('level', e.target.value)}
                  >
                    {JOB_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fieldGroup">
                  <label className="inputLabel" htmlFor="personnelGroup">
                    กลุ่มบุคคล <span className="requiredStar">*</span>
                  </label>
                  <select
                    id="personnelGroup"
                    className="selectInput"
                    value={form.personnelGroup}
                    onChange={(e) => updateField('personnelGroup', e.target.value)}
                  >
                    {PERSONNEL_GROUPS.map((grp) => (
                      <option key={grp} value={grp}>
                        {grp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.personnelGroup === 'อื่นๆ' && (
                <div className="fieldGroup">
                  <label className="inputLabel" htmlFor="personnelGroupOther">
                    ระบุกลุ่มบุคคลเพิ่มเติม <span className="optionalTag">(ถ้ามี)</span>
                  </label>
                  <input
                    id="personnelGroupOther"
                    type="text"
                    className="textInput"
                    placeholder="เช่น นักศึกษาฝึกงาน"
                    value={form.personnelGroupOther}
                    onChange={(e) => updateField('personnelGroupOther', e.target.value)}
                  />
                </div>
              )}

              {/* Start Work Date */}
              <div className="fieldGroup">
                <label className="inputLabel">
                  วันที่เริ่มปฏิบัติงาน (พ.ศ.) <span className="requiredStar">*</span>
                </label>
                <div className="dateDropdownRow">
                  <select
                    className="selectInput dateDay"
                    aria-label="วันที่เริ่มงาน"
                    value={form.startDay}
                    onChange={(e) => updateField('startDay', e.target.value)}
                  >
                    {daysList.map((d) => (
                      <option key={d} value={d}>
                        {parseInt(d, 10)}
                      </option>
                    ))}
                  </select>

                  <select
                    className="selectInput dateMonth"
                    aria-label="เดือนที่เริ่มงาน"
                    value={form.startMonth}
                    onChange={(e) => updateField('startMonth', e.target.value)}
                  >
                    {THAI_MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="selectInput dateYear"
                    aria-label="ปีที่เริ่มงาน พ.ศ."
                    value={form.startYear}
                    onChange={(e) => updateField('startYear', e.target.value)}
                  >
                    {yearsList.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.startDate && <p className="fieldError">{errors.startDate}</p>}
              </div>

              {/* Containment Date */}
              <div className="fieldGroup">
                <label className="inputLabel">
                  วันที่บรรจุ (พ.ศ.) <span className="optionalTag">(ถ้ามี - สำหรับข้าราชการ/พนักงานราชการ)</span>
                </label>
                <div className="dateDropdownRow">
                  <select
                    className="selectInput dateDay"
                    aria-label="วันที่บรรจุ"
                    value={form.containDay}
                    onChange={(e) => updateField('containDay', e.target.value)}
                  >
                    <option value="">-- วัน --</option>
                    {daysList.map((d) => (
                      <option key={d} value={d}>
                        {parseInt(d, 10)}
                      </option>
                    ))}
                  </select>

                  <select
                    className="selectInput dateMonth"
                    aria-label="เดือนที่บรรจุ"
                    value={form.containMonth}
                    onChange={(e) => updateField('containMonth', e.target.value)}
                  >
                    <option value="">-- เดือน --</option>
                    {THAI_MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="selectInput dateYear"
                    aria-label="ปีที่บรรจุ พ.ศ."
                    value={form.containYear}
                    onChange={(e) => updateField('containYear', e.target.value)}
                  >
                    <option value="">-- ปี พ.ศ. --</option>
                    {yearsList.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 3: Contact & HOSxP
             ══════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="stepSection">
              <h2 className="stepSectionTitle">
                <Mail size={20} className="text-emerald-600" />
                ข้อมูลติดต่อ & บัญชีระบบ HOSxP
              </h2>

              <div className="fieldGroup">
                <label className="inputLabel" htmlFor="email">
                  อีเมล (Email) <span className="requiredStar">*</span>
                </label>
                <div className="inputWithIcon">
                  <Mail size={18} className="inputIcon" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className={`textInput pl-10 ${errors.email ? 'inputError' : ''}`}
                    placeholder="somchai@example.com"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                  />
                </div>
                {errors.email && <p className="fieldError">{errors.email}</p>}
                <p className="fieldHint">ใช้สำหรับรับรหัส OTP เพื่อเข้าสู่ระบบและรับการแจ้งเตือนงาน</p>
              </div>

              <div className="grid2Col">
                <div className="fieldGroup">
                  <label className="inputLabel" htmlFor="phone">
                    เบอร์โทรศัพท์มือถือ <span className="requiredStar">*</span>
                  </label>
                  <div className="inputWithIcon">
                    <Phone size={18} className="inputIcon" />
                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className={`textInput pl-10 ${errors.phone ? 'inputError' : ''}`}
                      placeholder="0812345678"
                      value={form.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                    />
                  </div>
                  {errors.phone && <p className="fieldError">{errors.phone}</p>}
                </div>

                <div className="fieldGroup">
                  <label className="inputLabel" htmlFor="lineId">
                    Line ID <span className="optionalTag">(ถ้ามี)</span>
                  </label>
                  <input
                    id="lineId"
                    type="text"
                    className="textInput"
                    placeholder="somchai_line"
                    value={form.lineId}
                    onChange={(e) => updateField('lineId', e.target.value)}
                  />
                </div>
              </div>

              {/* HOSxP Switch Section */}
              <div className="conditionalCard">
                <div className="switchRow">
                  <div className="switchInfo">
                    <span className="switchTitle">จำเป็นต้องใช้งานระบบโรงพยาบาล HOSxP หรือไม่?</span>
                    <span className="switchDesc">สำหรับแพทย์ พยาบาล เภสัชกร และเจ้าหน้าที่ที่ต้องบันทึกเวชระเบียน</span>
                  </div>
                  <label className="toggleSwitch" aria-label="ใช้งานระบบ HOSxP">
                    <input
                      type="checkbox"
                      checked={form.hasHosxp}
                      onChange={(e) => updateField('hasHosxp', e.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>

                {form.hasHosxp && (
                  <div className="conditionalContent animateFadeIn">
                    <div className="grid2Col">
                      <div className="fieldGroup">
                        <label className="inputLabel" htmlFor="hosxpUser">
                          ชื่อผู้ใช้งาน HOSxP (Username) <span className="requiredStar">*</span>
                        </label>
                        <input
                          id="hosxpUser"
                          type="text"
                          autoComplete="off"
                          className={`textInput ${errors.hosxpUser ? 'inputError' : ''}`}
                          placeholder="ชื่อผู้ใช้งานที่ต้องการ"
                          value={form.hosxpUser}
                          onChange={(e) => updateField('hosxpUser', e.target.value)}
                        />
                        {errors.hosxpUser && <p className="fieldError">{errors.hosxpUser}</p>}
                      </div>

                      <div className="fieldGroup">
                        <label className="inputLabel" htmlFor="hosxpPass">
                          รหัสผ่าน HOSxP (Password) <span className="requiredStar">*</span>
                        </label>
                        <input
                          id="hosxpPass"
                          type="password"
                          autoComplete="new-password"
                          className={`textInput ${errors.hosxpPass ? 'inputError' : ''}`}
                          placeholder="รหัสผ่านเข้า HOSxP"
                          value={form.hosxpPass}
                          onChange={(e) => updateField('hosxpPass', e.target.value)}
                        />
                        {errors.hosxpPass && <p className="fieldError">{errors.hosxpPass}</p>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 4: Housing & Vehicles
             ══════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <div className="stepSection">
              <h2 className="stepSectionTitle">
                <Home size={20} className="text-emerald-600" />
                สวัสดิการที่พักอาศัย & ยานพาหนะ
              </h2>

              {/* Housing Switch */}
              <div className="conditionalCard">
                <div className="switchRow">
                  <div className="switchInfo">
                    <span className="switchTitle">พักอาศัยอยู่ในโรงพยาบาลหรือไม่?</span>
                    <span className="switchDesc">เลือกเปิดหากพักอยู่ในโซนบ้านพักหรือแฟลตของโรงพยาบาลเถิน</span>
                  </div>
                  <label className="toggleSwitch" aria-label="พักอาศัยในโรงพยาบาล">
                    <input
                      type="checkbox"
                      checked={form.inHospitalHousing}
                      onChange={(e) => updateField('inHospitalHousing', e.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>

                {form.inHospitalHousing && (
                  <div className="conditionalContent animateFadeIn">
                    <div className="fieldGroup">
                      <label className="inputLabel" htmlFor="housingLocation">
                        เลือกสถานที่พักอาศัย <span className="requiredStar">*</span>
                      </label>
                      <select
                        id="housingLocation"
                        className={`selectInput ${errors.housingLocation ? 'inputError' : ''}`}
                        value={form.housingLocation}
                        onChange={(e) => updateField('housingLocation', e.target.value)}
                      >
                        {HOUSING_LOCATIONS.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                      {errors.housingLocation && <p className="fieldError">{errors.housingLocation}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Vehicle Switch */}
              <div className="conditionalCard mt-4">
                <div className="switchRow">
                  <div className="switchInfo">
                    <span className="switchTitle">จำเป็นต้องใช้รถยนต์เข้ามาในโซนบ้านพักโรงพยาบาลหรือไม่?</span>
                    <span className="switchDesc">ลงทะเบียนข้อมูลทะเบียนรถเพื่อการรักษาความปลอดภัย (สูงสุด 2 คัน)</span>
                  </div>
                  <label className="toggleSwitch" aria-label="นำรถยนต์เข้าโซนบ้านพัก">
                    <input
                      type="checkbox"
                      checked={form.hasVehicle}
                      onChange={(e) => updateField('hasVehicle', e.target.checked)}
                    />
                    <span className="slider" />
                  </label>
                </div>

                {form.hasVehicle && (
                  <div className="conditionalContent animateFadeIn">
                    <div className="fieldGroup">
                      <label className="inputLabel">จำนวนรถยนต์ที่ต้องการลงทะเบียน</label>
                      <div className="segmentedControl">
                        <button
                          type="button"
                          className={`segmentBtn ${form.vehicleCount === 1 ? 'active' : ''}`}
                          onClick={() => handleVehicleCountChange(1)}
                        >
                          1 คัน
                        </button>
                        <button
                          type="button"
                          className={`segmentBtn ${form.vehicleCount === 2 ? 'active' : ''}`}
                          onClick={() => handleVehicleCountChange(2)}
                        >
                          2 คัน
                        </button>
                      </div>
                    </div>

                    {Array.from({ length: form.vehicleCount }).map((_, idx) => (
                      <div key={idx} className="vehicleBox">
                        <div className="vehicleBoxHeader">
                          <Car size={16} className="text-emerald-700" />
                          <span className="font-semibold text-slate-800">ข้อมูลรถยนต์คันที่ {idx + 1}</span>
                        </div>

                        <div className="grid3Col">
                          <div className="fieldGroup">
                            <label className="inputLabel" htmlFor={`platePrefix_${idx}`}>
                              หมวดอักษร <span className="requiredStar">*</span>
                            </label>
                            <input
                              id={`platePrefix_${idx}`}
                              type="text"
                              className="textInput"
                              placeholder="กข"
                              maxLength={4}
                              value={form.vehicles[idx]?.platePrefix || ''}
                              onChange={(e) => updateVehicle(idx, 'platePrefix', e.target.value)}
                            />
                          </div>

                          <div className="fieldGroup">
                            <label className="inputLabel" htmlFor={`plateNumber_${idx}`}>
                              เลขทะเบียน <span className="requiredStar">*</span>
                            </label>
                            <input
                              id={`plateNumber_${idx}`}
                              type="text"
                              inputMode="numeric"
                              className="textInput tabularNums"
                              placeholder="1234"
                              maxLength={6}
                              value={form.vehicles[idx]?.plateNumber || ''}
                              onChange={(e) => updateVehicle(idx, 'plateNumber', e.target.value)}
                            />
                          </div>

                          <div className="fieldGroup">
                            <label className="inputLabel" htmlFor={`province_${idx}`}>
                              จังหวัด <span className="requiredStar">*</span>
                            </label>
                            <select
                              id={`province_${idx}`}
                              className="selectInput"
                              value={form.vehicles[idx]?.province || 'ลำปาง'}
                              onChange={(e) => updateVehicle(idx, 'province', e.target.value)}
                            >
                              {THAI_PROVINCES.map((prov) => (
                                <option key={prov} value={prov}>
                                  {prov}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {errors[`vehicle_${idx}`] && <p className="fieldError">{errors[`vehicle_${idx}`]}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              STEP 5: Review & Consent
             ══════════════════════════════════════════════════════════════ */}
          {step === 5 && (
            <div className="stepSection">
              <h2 className="stepSectionTitle">
                <FileCheck size={20} className="text-emerald-600" />
                ตรวจสอบข้อมูลก่อนส่งคำขอลงทะเบียน
              </h2>
              <p className="stepDesc">
                กรุณาตรวจสอบความถูกต้องของข้อมูลทั้งหมด หากต้องการแก้ไข สามารถกดปุ่ม &quot;แก้ไข&quot; ในแต่ละส่วนได้ทันที
              </p>

              {/* Review Card 1 */}
              <div className="reviewSectionCard">
                <div className="reviewSectionHeader">
                  <span className="reviewSectionTitle">1. ข้อมูลส่วนบุคคล</span>
                  <button type="button" className="btnEditSection" onClick={() => setStep(1)}>
                    <Edit3 size={14} />
                    <span>แก้ไข</span>
                  </button>
                </div>
                <div className="reviewGrid">
                  <div>
                    <span className="reviewLabel">เลขบัตรประชาชน:</span>
                    <span className="reviewValue tabularNums">{form.citizenId}</span>
                  </div>
                  <div>
                    <span className="reviewLabel">ชื่อ-นามสกุล (ไทย):</span>
                    <span className="reviewValue">
                      {form.title === 'อื่นๆ' ? form.customTitle : form.title}
                      {form.firstNameTh} {form.lastNameTh}
                    </span>
                  </div>
                  <div>
                    <span className="reviewLabel">ชื่อ-นามสกุล (อังกฤษ):</span>
                    <span className="reviewValue">
                      {form.firstNameEn} {form.lastNameEn}
                    </span>
                  </div>
                  <div>
                    <span className="reviewLabel">ชื่อเล่น:</span>
                    <span className="reviewValue">{form.nickname}</span>
                  </div>
                  <div>
                    <span className="reviewLabel">วันเกิด (พ.ศ.):</span>
                    <span className="reviewValue">
                      {form.birthDay}/{form.birthMonth}/{form.birthYear}
                    </span>
                  </div>
                  <div>
                    <span className="reviewLabel">เลขที่ใบประกอบ:</span>
                    <span className="reviewValue">{form.licenseNo || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Review Card 2 */}
              <div className="reviewSectionCard">
                <div className="reviewSectionHeader">
                  <span className="reviewSectionTitle">2. ข้อมูลงานและตำแหน่ง</span>
                  <button type="button" className="btnEditSection" onClick={() => setStep(2)}>
                    <Edit3 size={14} />
                    <span>แก้ไข</span>
                  </button>
                </div>
                <div className="reviewGrid">
                  <div>
                    <span className="reviewLabel">กลุ่มงาน / แผนก:</span>
                    <span className="reviewValue">{form.department}</span>
                  </div>
                  <div>
                    <span className="reviewLabel">ตำแหน่ง:</span>
                    <span className="reviewValue">{form.position}</span>
                  </div>
                  <div>
                    <span className="reviewLabel">ระดับงาน:</span>
                    <span className="reviewValue">{form.level}</span>
                  </div>
                  <div>
                    <span className="reviewLabel">กลุ่มบุคคล:</span>
                    <span className="reviewValue">
                      {form.personnelGroup}
                      {form.personnelGroup === 'อื่นๆ' && form.personnelGroupOther ? ` (${form.personnelGroupOther})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="reviewLabel">วันที่เริ่มปฏิบัติงาน:</span>
                    <span className="reviewValue">
                      {form.startDay}/{form.startMonth}/{form.startYear}
                    </span>
                  </div>
                  <div>
                    <span className="reviewLabel">วันที่บรรจุ:</span>
                    <span className="reviewValue">
                      {form.containDay ? `${form.containDay}/${form.containMonth}/${form.containYear}` : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Review Card 3 */}
              <div className="reviewSectionCard">
                <div className="reviewSectionHeader">
                  <span className="reviewSectionTitle">3. ข้อมูลติดต่อ & HOSxP</span>
                  <button type="button" className="btnEditSection" onClick={() => setStep(3)}>
                    <Edit3 size={14} />
                    <span>แก้ไข</span>
                  </button>
                </div>
                <div className="reviewGrid">
                  <div>
                    <span className="reviewLabel">อีเมล:</span>
                    <span className="reviewValue">{form.email}</span>
                  </div>
                  <div>
                    <span className="reviewLabel">เบอร์โทรศัพท์:</span>
                    <span className="reviewValue">{form.phone}</span>
                  </div>
                  <div>
                    <span className="reviewLabel">Line ID:</span>
                    <span className="reviewValue">{form.lineId || '-'}</span>
                  </div>
                  <div>
                    <span className="reviewLabel">ใช้งานระบบ HOSxP:</span>
                    <span className="reviewValue">{form.hasHosxp ? `เปิดใช้งาน (User: ${form.hosxpUser})` : 'ไม่ใช้งาน'}</span>
                  </div>
                </div>
              </div>

              {/* Review Card 4 */}
              <div className="reviewSectionCard">
                <div className="reviewSectionHeader">
                  <span className="reviewSectionTitle">4. ที่พัก & ยานพาหนะ</span>
                  <button type="button" className="btnEditSection" onClick={() => setStep(4)}>
                    <Edit3 size={14} />
                    <span>แก้ไข</span>
                  </button>
                </div>
                <div className="reviewGrid">
                  <div>
                    <span className="reviewLabel">ที่พักในโรงพยาบาล:</span>
                    <span className="reviewValue">{form.inHospitalHousing ? form.housingLocation : 'พักภายนอกโรงพยาบาล'}</span>
                  </div>
                  <div>
                    <span className="reviewLabel">ยานพาหนะ:</span>
                    <span className="reviewValue">
                      {form.hasVehicle
                        ? form.vehicles
                            .slice(0, form.vehicleCount)
                            .map((v) => `${v.platePrefix} ${v.plateNumber} ${v.province}`)
                            .join(', ')
                        : 'ไม่มีรถยนต์เข้าโซนบ้านพัก'}
                    </span>
                  </div>
                </div>
              </div>

              {/* PDPA Consent Box */}
              <div className="consentBox">
                <div className="consentHeader">
                  <ShieldCheck size={20} className="text-emerald-700" />
                  <span className="consentTitle">คำประกาศการยินยอมให้ใช้ข้อมูลส่วนบุคคล (PDPA)</span>
                </div>
                <p className="consentText">
                  โรงพยาบาลเถินให้ความสำคัญกับความปลอดภัยของข้อมูลส่วนบุคคลของบุคลากร ข้อมูลทั้งหมดที่ท่านกรอกจะถูกนำไปใช้เพื่อวัตถุประสงค์ในการบริหารงานบุคคล การเปิดสิทธิ์ใช้งานระบบสารสนเทศของโรงพยาบาล และการรักษาความปลอดภัยในสถานที่เท่านั้น
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    className="text-emerald-700 underline text-sm font-medium hover:text-emerald-800"
                    onClick={() => setShowPolicyModal(true)}
                  >
                    อ่านนโยบายคุ้มครองข้อมูลส่วนบุคคลฉบับเต็ม (/policy)
                  </button>
                </div>

                <label className="checkboxLabel">
                  <input
                    type="checkbox"
                    checked={form.consentPolicy}
                    onChange={(e) => updateField('consentPolicy', e.target.checked)}
                  />
                  <span>
                    ข้าพเจ้าได้อ่านและเข้าใจข้อกำหนดข้างต้น และยินยอมให้โรงพยาบาลเถินจัดเก็บและประมวลผลข้อมูลส่วนบุคคลตามนโยบายคุ้มครองข้อมูลส่วนบุคคล <span className="requiredStar">*</span>
                  </span>
                </label>
                {errors.consentPolicy && <p className="fieldError mt-2">{errors.consentPolicy}</p>}
              </div>

              {submitError && (
                <div className="errorBanner">
                  <AlertCircle size={20} className="text-rose-600 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>
          )}

          {/* Navigation Action Buttons (Bottom Bar) */}
          <div className="formActionRow">
            {step > 1 && (
              <button
                type="button"
                className="btnSecondary"
                onClick={handlePrev}
                disabled={isSubmitting}
              >
                <ChevronLeft size={18} />
                <span>ย้อนกลับ</span>
              </button>
            )}

            {step < 5 ? (
              <button
                type="button"
                className="btnPrimary ml-auto"
                onClick={handleNext}
              >
                <span>ถัดไป</span>
                <ChevronRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="btnPrimary btnSubmitFinal ml-auto"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span>กำลังส่งข้อมูล…</span>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>ยืนยันส่งคำขอลงทะเบียน</span>
                  </>
                )}
              </button>
            )}
          </div>
        </section>

        {/* Policy Modal */}
        {showPolicyModal && (
          <div className="modalBackdrop" role="dialog" aria-modal="true">
            <div className="modalCard">
              <div className="modalHeader">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={22} className="text-emerald-700" />
                  <h3 className="modalTitle">นโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)</h3>
                </div>
                <button
                  type="button"
                  className="modalCloseBtn"
                  onClick={() => setShowPolicyModal(false)}
                  aria-label="ปิด"
                >
                  ✕
                </button>
              </div>
              <div className="modalBody">
                <p>
                  <strong>โรงพยาบาลเถิน</strong> ตระหนักถึงความสำคัญของการคุ้มครองข้อมูลส่วนบุคคลของบุคลากรตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
                </p>
                <h4 className="font-semibold text-slate-800 mt-3">1. วัตถุประสงค์ในการเก็บรวบรวม</h4>
                <p>
                  เพื่อการบริหารงานบุคคล การเปิดสิทธิ์การใช้งานระบบสารสนเทศ (HOSxP, Member Portal, ระบบเงินเดือน), การจัดการสวัสดิการบ้านพัก และการรักษาความปลอดภัยในเขตพื้นที่โรงพยาบาล
                </p>
                <h4 className="font-semibold text-slate-800 mt-3">2. การรักษาความปลอดภัย</h4>
                <p>
                  โรงพยาบาลมีมาตรการรักษาความปลอดภัยทางเทคนิคและการบริหารจัดการที่เข้มงวด ข้อมูลจะถูกจัดเก็บในฐานข้อมูลที่ปลอดภัยและเข้าถึงได้เฉพาะผู้มีอำนาจหน้าที่เท่านั้น
                </p>
                <h4 className="font-semibold text-slate-800 mt-3">3. สิทธิของเจ้าของข้อมูล</h4>
                <p>
                  ท่านมีสิทธิ์ในการขอเข้าถึง ขอรับสำเนา ขอแก้ไข หรือขอลบข้อมูลส่วนบุคคลของท่านตามที่กฎหมายกำหนด
                </p>
              </div>
              <div className="modalFooter">
                <button
                  type="button"
                  className="btnPrimary w-full"
                  onClick={() => setShowPolicyModal(false)}
                >
                  รับทราบและปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
