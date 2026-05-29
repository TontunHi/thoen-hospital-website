import { z } from 'zod'

/** Schema for contact form submission */
export const contactCreateSchema = z.object({
  name: z
    .string({ error: 'กรุณากรอกชื่อ' })
    .min(1, 'กรุณากรอกชื่อ')
    .max(200, 'ชื่อต้องไม่เกิน 200 ตัวอักษร')
    .trim(),
  email: z
    .string({ error: 'กรุณากรอกอีเมล' })
    .email('รูปแบบอีเมลไม่ถูกต้อง')
    .max(100, 'อีเมลต้องไม่เกิน 100 ตัวอักษร')
    .trim(),
  phone: z
    .string()
    .max(20, 'เบอร์โทรต้องไม่เกิน 20 ตัวอักษร')
    .regex(/^[\d\-+() ]*$/, 'รูปแบบเบอร์โทรไม่ถูกต้อง')
    .optional()
    .nullable(),
  message: z
    .string({ error: 'กรุณากรอกข้อความ' })
    .min(1, 'กรุณากรอกข้อความ')
    .max(5000, 'ข้อความต้องไม่เกิน 5,000 ตัวอักษร')
    .trim(),
})

/** Schema for marking a contact as read */
export const contactUpdateSchema = z.object({
  id: z
    .number({ error: 'กรุณาระบุ ID ของข้อความ' })
    .int('ID ต้องเป็นจำนวนเต็ม')
    .positive('ID ต้องเป็นค่าบวก'),
  isRead: z.boolean().optional(),
})
