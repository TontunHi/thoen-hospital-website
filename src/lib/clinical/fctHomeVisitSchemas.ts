import { z } from 'zod'
import { FCT_ALL_OPTION_CATEGORIES, type FctOptionCategory } from './fctHomeVisitTypes'

const OPTION_CATEGORIES = FCT_ALL_OPTION_CATEGORIES as unknown as readonly [
  FctOptionCategory,
  ...FctOptionCategory[],
]

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

const nullableIsoDateSchema = z.preprocess(
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
    .string({ message: 'รูปแบบวันที่เยี่ยมบ้านไม่ถูกต้อง' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่เยี่ยมบ้านต้องเป็น YYYY-MM-DD')
    .nullable()
    .optional()
)

const fiscalYearNumberSchema = z
  .number({ message: 'ปีงบประมาณต้องเป็นตัวเลข' })
  .int('ปีงบประมาณต้องเป็นจำนวนเต็ม')
  .min(2550, 'ปีงบประมาณต้องไม่น้อยกว่า 2550')
  .max(2650, 'ปีงบประมาณต้องไม่เกิน 2650')

const optionalFiscalYearField = z.preprocess(
  (raw) => parseNumericInput(raw, undefined),
  fiscalYearNumberSchema.optional()
)

export const fctHomeVisitCreateSchema = z.object({
  visitDate: nullableIsoDateSchema,
  fiscalYear: z.preprocess(
    (raw) => parseNumericInput(raw, null),
    fiscalYearNumberSchema.nullable().optional()
  ),
  pcuName: optionalNullableString(150, 'รพ.สต.'),
  patientName: z
    .string({ message: 'กรุณาระบุชื่อ-สกุลผู้ป่วย' })
    .trim()
    .min(1, 'กรุณาระบุชื่อ-สกุลผู้ป่วย')
    .max(255, 'ชื่อ-สกุลผู้ป่วยต้องไม่เกิน 255 ตัวอักษร'),
  hn: optionalNullableString(20, 'HN'),
  age: optionalNullableNumber({ min: 0, max: 150, integer: true, label: 'อายุ' }),
  address: optionalNullableString(500, 'ที่อยู่'),
  adlScore: optionalNullableNumber({ min: 0, max: 20, integer: true, label: 'คะแนน ADL' }),
  adlGroup: optionalNullableString(100, 'กลุ่ม ADL'),
  diagnosis: optionalNullableString(500, 'Dx'),
  patientCategory: optionalNullableString(150, 'ประเภทคนไข้'),
  followUpPlan: optionalNullableString(1000, 'สิ่งที่ต้องตาม'),
  treatmentFacility: optionalNullableString(255, 'สถานที่รักษา'),
  visitOutcome: optionalNullableString(100, 'ผลลัพธ์การเยี่ยม'),
  overallRiskLevel: optionalNullableString(100, 'ระดับความเสี่ยงโดยรวมของผู้ป่วย'),
  riskLevel: optionalNullableString(100, 'ระดับความเสี่ยง'),
  dentalNote: optionalNullableString(1000, 'ทันตกรรม'),
  pharmacyNote: optionalNullableString(1000, 'เภสัช'),
  nutritionStatus: optionalNullableString(150, 'สถานะโภชนาการ'),
  nutritionNote: optionalNullableString(2000, 'คำแนะนำโภชนาการ'),
  ptCategory: optionalNullableString(255, 'กายภาพ (หมวดกิจกรรม)'),
  ptNote: optionalNullableString(1000, 'กายภาพ (บันทึก)'),
  thaiMedCategory: optionalNullableString(255, 'แผนไทย (หมวดอาการ/บริการ)'),
  thaiMedNote: optionalNullableString(1000, 'แผนไทย (บันทึก)'),
})

export const fctHomeVisitUpdateSchema = fctHomeVisitCreateSchema.partial()

export const fctBatchImportSchema = z.object({
  rows: z
    .array(fctHomeVisitCreateSchema, { message: 'กรุณาระบุรายการสำหรับนำเข้า' })
    .min(1, 'ต้องมีอย่างน้อย 1 รายการสำหรับนำเข้า')
    .max(1000, 'นำเข้าได้สูงสุด 1,000 รายการต่อครั้ง'),
})

export const fctOptionCreateSchema = z.object({
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

export const fctOptionUpdateSchema = z.object({
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

export const fctListQuerySchema = z.object({
  fiscalYear: optionalFiscalYearField,
  pcuName: optionalQueryString(150, 'รพ.สต.'),
  adlGroup: optionalQueryString(100, 'กลุ่ม ADL'),
  visitOutcome: optionalQueryString(100, 'ผลลัพธ์การเยี่ยม'),
  search: optionalQueryString(120, 'คำค้นหา'),
})
