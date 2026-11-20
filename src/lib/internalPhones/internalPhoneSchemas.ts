import { z } from 'zod'

const optionalTrimmedText = (maxLen: number, label: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((val) => {
      if (val === null || val === undefined) return null
      const trimmed = val.trim()
      return trimmed.length > 0 ? trimmed : null
    })
    .refine((val) => val === null || val.length <= maxLen, {
      message: `${label}ต้องไม่เกิน ${maxLen} ตัวอักษร`,
    })

export const internalPhoneCreateSchema = z.object({
  building: z
    .string({ message: 'กรุณาระบุชื่ออาคาร' })
    .trim()
    .min(1, 'กรุณาระบุชื่ออาคาร')
    .max(150, 'ชื่ออาคารต้องไม่เกิน 150 ตัวอักษร'),
  floor: optionalTrimmedText(50, 'ชั้น'),
  room: z
    .string({ message: 'กรุณาระบุชื่อห้องหรือหน่วยงาน' })
    .trim()
    .min(1, 'กรุณาระบุชื่อห้องหรือหน่วยงาน')
    .max(255, 'ชื่อห้องหรือหน่วยงานต้องไม่เกิน 255 ตัวอักษร'),
  phone: z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((val) => (typeof val === 'string' ? val.trim() : ''))
    .refine((val) => val.length <= 100, {
      message: 'เบอร์โทรภายในต้องไม่เกิน 100 ตัวอักษร',
    }),
  note: optionalTrimmedText(500, 'หมายเหตุ'),
  displayOrder: z.coerce
    .number()
    .int('ลำดับการแสดงผลต้องเป็นจำนวนเต็ม')
    .min(0, 'ลำดับการแสดงผลต้องไม่น้อยกว่า 0')
    .max(99999, 'ลำดับการแสดงผลต้องไม่เกิน 99999')
    .optional(),
  isActive: z.boolean().optional(),
})

export const internalPhoneUpdateSchema = z
  .object({
    building: z
      .string()
      .trim()
      .min(1, 'กรุณาระบุชื่ออาคาร')
      .max(150, 'ชื่ออาคารต้องไม่เกิน 150 ตัวอักษร')
      .optional(),
    floor: optionalTrimmedText(50, 'ชั้น').optional(),
    room: z
      .string()
      .trim()
      .min(1, 'กรุณาระบุชื่อห้องหรือหน่วยงาน')
      .max(255, 'ชื่อห้องหรือหน่วยงานต้องไม่เกิน 255 ตัวอักษร')
      .optional(),
    phone: z
      .union([z.string(), z.null()])
      .transform((val) => (typeof val === 'string' ? val.trim() : ''))
      .refine((val) => val.length <= 100, {
        message: 'เบอร์โทรภายในต้องไม่เกิน 100 ตัวอักษร',
      })
      .optional(),
    note: optionalTrimmedText(500, 'หมายเหตุ').optional(),
    displayOrder: z.coerce
      .number()
      .int('ลำดับการแสดงผลต้องเป็นจำนวนเต็ม')
      .min(0, 'ลำดับการแสดงผลต้องไม่น้อยกว่า 0')
      .max(99999, 'ลำดับการแสดงผลต้องไม่เกิน 99999')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'กรุณาระบุข้อมูลที่ต้องการแก้ไขอย่างน้อย 1 รายการ',
  })

export const internalPhoneQuerySchema = z.object({
  building: z.string().trim().max(150).optional(),
  floor: z.string().trim().max(50).optional(),
  search: z.string().trim().max(200).optional(),
  includeInactive: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
})
