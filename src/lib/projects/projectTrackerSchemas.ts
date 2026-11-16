import { z } from 'zod'

const optionalTrimmedText = (maxLen: number) =>
  z
    .union([z.string().max(maxLen), z.null(), z.undefined()])
    .transform((val) => {
      if (val === null || val === undefined) return null
      const trimmed = val.trim()
      return trimmed ? trimmed : null
    })

const nonNegativeMoney = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val, ctx) => {
    if (val === null || val === undefined || val === '') return 0
    const cleaned =
      typeof val === 'string'
        ? val.replace(/,/g, '').replace(/฿/g, '').trim()
        : val
    if (cleaned === '' || cleaned === '-' || cleaned === '—') return 0
    const num = Number(cleaned)
    if (!Number.isFinite(num) || num < 0 || num > 1_000_000_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'จำนวนเงินต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป',
      })
      return z.NEVER
    }
    return Math.round(num * 100) / 100
  })

const optionalSequenceNo = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val, ctx) => {
    if (val === null || val === undefined || val === '') return null
    const num = Number(val)
    if (!Number.isInteger(num) || num < 1 || num > 100000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ลำดับต้องเป็นจำนวนเต็มบวก',
      })
      return z.NEVER
    }
    return num
  })

export const projectListQuerySchema = z.object({
  fiscalYear: z
    .string()
    .trim()
    .optional()
    .transform((val, ctx) => {
      if (!val) return undefined
      const num = Number(val)
      if (!Number.isInteger(num) || num < 2560 || num > 2650) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'ปีงบประมาณไม่ถูกต้อง (พ.ศ. 2560–2650)',
        })
        return z.NEVER
      }
      return num
    }),
  strategy: z.string().trim().max(50).optional(),
  submissionStatus: z.string().trim().max(50).optional(),
  budgetSource: z.string().trim().max(50).optional(),
  search: z.string().trim().max(200).optional(),
})

export const projectCreateSchema = z.object({
  fiscalYear: z.coerce
    .number()
    .int()
    .min(2560, 'ปีงบประมาณต้องตั้งแต่ พ.ศ. 2560 ขึ้นไป')
    .max(2650, 'ปีงบประมาณต้องไม่เกิน พ.ศ. 2650'),
  sequenceNo: optionalSequenceNo.optional(),
  projectCode: optionalTrimmedText(50).optional(),
  strategy: z
    .string({ error: 'กรุณาระบุยุทธศาสตร์' })
    .trim()
    .min(1, 'กรุณาระบุยุทธศาสตร์')
    .max(50, 'ชื่อยุทธศาสตร์ยาวเกินกำหนด'),
  projectName: z
    .string({ error: 'กรุณาระบุชื่อโครงการ' })
    .trim()
    .min(1, 'กรุณาระบุชื่อโครงการ')
    .max(500, 'ชื่อโครงการต้องไม่เกิน 500 ตัวอักษร'),
  responsibleUnit: optionalTrimmedText(255).optional(),
  q1Budget: nonNegativeMoney.optional().default(0),
  q2Budget: nonNegativeMoney.optional().default(0),
  q3Budget: nonNegativeMoney.optional().default(0),
  q4Budget: nonNegativeMoney.optional().default(0),
  actualSpent: nonNegativeMoney.optional().default(0),
  submissionStatus: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .default('ยังไม่ส่ง'),
  budgetSource: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .optional()
    .default('เงินบำรุง'),
  notes: optionalTrimmedText(2000).optional(),
})

export const projectUpdateSchema = z
  .object({
    fiscalYear: z.coerce.number().int().min(2560).max(2650).optional(),
    sequenceNo: optionalSequenceNo.optional(),
    projectCode: optionalTrimmedText(50).optional(),
    strategy: z.string().trim().min(1).max(50).optional(),
    projectName: z.string().trim().min(1, 'กรุณาระบุชื่อโครงการ').max(500).optional(),
    responsibleUnit: optionalTrimmedText(255).optional(),
    q1Budget: nonNegativeMoney.optional(),
    q2Budget: nonNegativeMoney.optional(),
    q3Budget: nonNegativeMoney.optional(),
    q4Budget: nonNegativeMoney.optional(),
    actualSpent: nonNegativeMoney.optional(),
    submissionStatus: z.string().trim().min(1).max(50).optional(),
    budgetSource: z.string().trim().min(1).max(50).optional(),
    notes: optionalTrimmedText(2000).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'ต้องระบุข้อมูลอย่างน้อย 1 ช่องสำหรับอัปเดต',
  })

export const projectBatchImportSchema = z.object({
  fiscalYear: z.coerce.number().int().min(2560).max(2650),
  mode: z.enum(['append', 'replace']).optional().default('append'),
  rows: z
    .array(projectCreateSchema)
    .min(1, 'กรุณาเลือกข้อมูลอย่างน้อย 1 โครงการ')
    .max(1000, 'นำเข้าได้สูงสุด 1,000 โครงการต่อครั้ง'),
})
