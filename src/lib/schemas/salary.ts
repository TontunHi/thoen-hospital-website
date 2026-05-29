import { z } from 'zod'

/** Schema for salary system login */
export const salaryLoginSchema = z.object({
  username: z
    .string({ error: 'กรุณากรอกชื่อผู้ใช้งาน' })
    .min(1, 'กรุณากรอกชื่อผู้ใช้งาน')
    .max(100, 'ชื่อผู้ใช้ต้องไม่เกิน 100 ตัวอักษร')
    .trim(),
  password: z
    .string({ error: 'กรุณากรอกรหัสผ่าน' })
    .min(1, 'กรุณากรอกรหัสผ่าน')
    .max(128, 'รหัสผ่านต้องไม่เกิน 128 ตัวอักษร'),
})
