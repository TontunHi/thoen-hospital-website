import { z } from 'zod'
import { type DmOptionCategory } from './dmRemissionTypes'

const OPTION_CATEGORIES = [
  'remission',
  'diet',
  'exercise',
  'if_fasting',
  'pcu',
] as const satisfies readonly [DmOptionCategory, ...DmOptionCategory[]]

function parseNumericInput(raw: unknown, emptyAs: null | undefined): unknown {
  if (raw === undefined) return undefined
  if (raw === null) return emptyAs
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return emptyAs
    return Number(trimmed)
  }
  if (typeof raw === 'boolean') return Number.NaN
  return raw
}

function optionalNullableNumber(bounds: {
  min: number
  max: number
  integer?: boolean
  label: string
}) {
  const baseNumber = bounds.integer
    ? z
        .number({ message: `${bounds.label}ต้องเป็นตัวเลข` })
        .int(`${bounds.label}ต้องเป็นจำนวนเต็ม`)
    : z
        .number({ message: `${bounds.label}ต้องเป็นตัวเลข` })
        .finite(`${bounds.label}ต้องเป็นตัวเลข`)

  return z.preprocess(
    (raw) => parseNumericInput(raw, null),
    baseNumber
      .min(bounds.min, `${bounds.label}ต้องไม่น้อยกว่า ${bounds.min}`)
      .max(bounds.max, `${bounds.label}ต้องไม่เกิน ${bounds.max}`)
      .nullable()
      .optional()
  )
}

function optionalNullableString(maxLength: number, label: string) {
  return z.preprocess(
    (raw) => {
      if (raw === undefined) return undefined
      if (raw === null) return null
      if (typeof raw === 'string') {
        const trimmed = raw.trim()
        return trimmed === '' ? null : trimmed
      }
      return raw
    },
    z
      .string({ message: `${label}ต้องเป็นข้อความ` })
      .max(maxLength, `${label}ต้องไม่เกิน ${maxLength} ตัวอักษร`)
      .nullable()
      .optional()
  )
}

function optionalQueryString(maxLength: number, label: string) {
  return z.preprocess(
    (raw) => {
      if (raw === undefined || raw === null) return undefined
      if (typeof raw === 'string') {
        const trimmed = raw.trim()
        return trimmed === '' ? undefined : trimmed
      }
      return raw
    },
    z
      .string({ message: `${label}ต้องเป็นข้อความ` })
      .max(maxLength, `${label}ต้องไม่เกิน ${maxLength} ตัวอักษร`)
      .optional()
  )
}

const fiscalYearNumberSchema = z
  .number({ message: 'ปีงบประมาณต้องเป็นตัวเลข' })
  .int('ปีงบประมาณต้องเป็นจำนวนเต็ม')
  .min(2550, 'ปีงบประมาณต้องไม่น้อยกว่า 2550')
  .max(2650, 'ปีงบประมาณต้องไม่เกิน 2650')

const fiscalYearField = z.preprocess(
  (raw) => parseNumericInput(raw, undefined),
  fiscalYearNumberSchema
)

const optionalFiscalYearField = z.preprocess(
  (raw) => parseNumericInput(raw, undefined),
  fiscalYearNumberSchema.optional()
)

export const cohortCreateSchema = z.object({
  fiscalYear: fiscalYearField,
  pcuName: optionalNullableString(150, 'รพ.สต.'),
  patientName: z
    .string({ message: 'กรุณาระบุชื่อ-นามสกุลผู้ป่วย' })
    .trim()
    .min(1, 'กรุณาระบุชื่อ-นามสกุลผู้ป่วย')
    .max(255, 'ชื่อ-นามสกุลผู้ป่วยต้องไม่เกิน 255 ตัวอักษร'),
  cid: optionalNullableString(20, 'เลขบัตรประชาชน'),
  hn: optionalNullableString(20, 'HN'),
  age: optionalNullableNumber({ min: 0, max: 150, integer: true, label: 'อายุ' }),
  underlyingDiseases: optionalNullableString(500, 'โรคประจำตัว'),
  heightCm: optionalNullableNumber({ min: 30, max: 250, label: 'ส่วนสูง' }),
  weightBeforeKg: optionalNullableNumber({ min: 10, max: 400, label: 'น้ำหนักก่อน' }),
  weightAfterKg: optionalNullableNumber({ min: 10, max: 400, label: 'น้ำหนักหลัง' }),
  waistBeforeCm: optionalNullableNumber({ min: 20, max: 250, label: 'รอบเอวก่อน' }),
  waistAfterCm: optionalNullableNumber({ min: 20, max: 250, label: 'รอบเอวหลัง' }),
  fpgBefore: optionalNullableNumber({ min: 10, max: 2000, label: 'FPG ก่อน' }),
  fpgAfter: optionalNullableNumber({ min: 10, max: 2000, label: 'FPG หลัง' }),
  a1cBefore: optionalNullableNumber({ min: 1, max: 30, label: 'A1c ก่อน' }),
  a1cAfter: optionalNullableNumber({ min: 1, max: 30, label: 'A1c หลัง' }),
  a1cPostStop3m: optionalNullableNumber({ min: 1, max: 30, label: 'A1c หลังหยุดยา 3 เดือน' }),
  medsBefore: optionalNullableString(2000, 'ยาก่อน'),
  medsAfter: optionalNullableString(2000, 'ยาหลัง'),
  summaryA1c: optionalNullableString(50, 'สรุป A1c'),
  summaryMeds: optionalNullableString(50, 'สรุปยาเบาหวาน'),
  summaryWeight: optionalNullableString(50, 'สรุปน้ำหนัก'),
  summaryWaist: optionalNullableString(50, 'สรุปรอบเอว'),
  summaryDiet: optionalNullableString(100, 'สรุปการปรับอาหาร'),
  summaryExercise: optionalNullableString(100, 'สรุปการออกกำลังกาย'),
  summaryIf: optionalNullableString(100, 'สรุป IF'),
  summaryRemission: optionalNullableString(100, 'สรุป Remission'),
})

export const cohortUpdateSchema = cohortCreateSchema.partial()

export const carryoverSchema = z
  .object({
    fromFiscalYear: fiscalYearField,
    toFiscalYear: fiscalYearField,
  })
  .refine((data) => data.toFiscalYear > data.fromFiscalYear, {
    message: 'ปีงบประมาณปลายทางต้องมากกว่าปีงบประมาณต้นทาง',
    path: ['toFiscalYear'],
  })

export const optionCreateSchema = z.object({
  category: z.enum(OPTION_CATEGORIES, { message: 'หมวดหมู่ตัวเลือกไม่ถูกต้อง' }),
  label: z
    .string({ message: 'กรุณาระบุชื่อตัวเลือก' })
    .trim()
    .min(1, 'กรุณาระบุชื่อตัวเลือก')
    .max(150, 'ชื่อตัวเลือกต้องไม่เกิน 150 ตัวอักษร'),
  sortOrder: z.preprocess(
    (raw) => parseNumericInput(raw, undefined),
    z
      .number({ message: 'ลำดับต้องเป็นตัวเลข' })
      .int('ลำดับต้องเป็นจำนวนเต็ม')
      .min(0, 'ลำดับต้องไม่ติดลบ')
      .max(9999, 'ลำดับต้องไม่เกิน 9999')
      .optional()
      .default(0)
  ),
  isActive: z.boolean({ message: 'สถานะการใช้งานไม่ถูกต้อง' }).optional().default(true),
})

export const optionUpdateSchema = z.object({
  label: z
    .string({ message: 'ชื่อตัวเลือกต้องเป็นข้อความ' })
    .trim()
    .min(1, 'กรุณาระบุชื่อตัวเลือก')
    .max(150, 'ชื่อตัวเลือกต้องไม่เกิน 150 ตัวอักษร')
    .optional(),
  sortOrder: z.preprocess(
    (raw) => parseNumericInput(raw, undefined),
    z
      .number({ message: 'ลำดับต้องเป็นตัวเลข' })
      .int('ลำดับต้องเป็นจำนวนเต็ม')
      .min(0, 'ลำดับต้องไม่ติดลบ')
      .max(9999, 'ลำดับต้องไม่เกิน 9999')
      .optional()
  ),
  isActive: z.boolean({ message: 'สถานะการใช้งานไม่ถูกต้อง' }).optional(),
})

export const listQuerySchema = z.object({
  fiscalYear: optionalFiscalYearField,
  pcuName: optionalQueryString(150, 'รพ.สต.'),
  remissionStatus: optionalQueryString(100, 'สถานะ Remission'),
  search: optionalQueryString(120, 'คำค้นหา'),
})

function optionalBooleanParam() {
  return z.preprocess((raw) => {
    if (raw === undefined || raw === null || raw === '') return undefined
    if (typeof raw === 'boolean') return raw
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase()
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
      if (normalized === 'false' || normalized === '0' || normalized === 'no') return false
    }
    return raw
  }, z.boolean().optional())
}

export const labTrackingQuerySchema = z.object({
  fiscalYear: optionalFiscalYearField,
  a1cMax: z.preprocess(
    (raw) => parseNumericInput(raw, undefined),
    z
      .number({ message: 'ค่า HbA1c สูงสุดต้องเป็นตัวเลข' })
      .min(3, 'ค่า HbA1c สูงสุดต้องไม่น้อยกว่า 3')
      .max(15, 'ค่า HbA1c สูงสุดต้องไม่เกิน 15')
      .optional()
  ),
  ucScope: z.enum(['visit', 'current', 'either'], { message: 'ขอบเขตสิทธิ์ UC ไม่ถูกต้อง' }).optional(),
  diagScope: z
    .enum(['ever', 'in_fy', 'same_vn'], { message: 'ขอบเขตการวินิจฉัย E11 ไม่ถูกต้อง' })
    .optional(),
  drugScope: z
    .enum(['fy', '90d_before_lab', 'visit_only', 'all'], {
      message: 'ขอบเขตการตรวจสอบยาเบาหวานไม่ถูกต้อง',
    })
    .optional(),
  cohortStatus: z
    .enum(['all', 'registered', 'unregistered', 'dm_remission', 't1dm', 'both'], {
      message: 'ตัวกรองสถานะทะเบียนไม่ถูกต้อง',
    })
    .optional(),
  tambon: optionalQueryString(100, 'ตำบล'),
  search: optionalQueryString(120, 'คำค้นหา'),
  includeDeceased: optionalBooleanParam(),
  page: z.preprocess(
    (raw) => parseNumericInput(raw, undefined),
    z.number().int().min(1).max(10000).optional()
  ),
  pageSize: z.preprocess(
    (raw) => parseNumericInput(raw, undefined),
    z.number().int().min(1).max(200).optional()
  ),
  exportAll: optionalBooleanParam(),
  refresh: optionalBooleanParam(),
})

export const labTrackingHnParamSchema = z
  .string({ message: 'กรุณาระบุ HN' })
  .trim()
  .min(1, 'กรุณาระบุ HN')
  .max(20, 'รูปแบบ HN ไม่ถูกต้อง')
  .regex(/^[A-Za-z0-9-]+$/, 'รูปแบบ HN ไม่ถูกต้อง')

