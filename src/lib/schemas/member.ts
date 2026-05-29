import { z } from 'zod'

/** Schema for requesting an OTP (member registration/login step 1) */
export const memberOtpRequestSchema = z.object({
  username: z
    .string({ error: 'กรุณากรอกชื่อผู้ใช้งาน' })
    .min(1, 'กรุณากรอกชื่อผู้ใช้งาน')
    .max(100, 'ชื่อผู้ใช้ต้องไม่เกิน 100 ตัวอักษร')
    .trim(),
  email: z
    .string({ error: 'กรุณากรอกอีเมล' })
    .email('รูปแบบอีเมลไม่ถูกต้อง')
    .max(100, 'อีเมลต้องไม่เกิน 100 ตัวอักษร')
    .trim(),
})

/** Schema for member login (step 2: OTP verification) */
export const memberLoginSchema = z.object({
  username: z
    .string({ error: 'กรุณากรอกชื่อผู้ใช้งาน' })
    .min(1, 'กรุณากรอกชื่อผู้ใช้งาน')
    .max(100, 'ชื่อผู้ใช้ต้องไม่เกิน 100 ตัวอักษร')
    .trim(),
  email: z
    .string({ error: 'กรุณากรอกอีเมล' })
    .email('รูปแบบอีเมลไม่ถูกต้อง')
    .max(100, 'อีเมลต้องไม่เกิน 100 ตัวอักษร')
    .trim(),
  otp: z
    .string({ error: 'กรุณากรอกรหัส OTP' })
    .length(6, 'รหัส OTP ต้องเป็นตัวเลข 6 หลัก')
    .regex(/^\d{6}$/, 'รหัส OTP ต้องเป็นตัวเลข 6 หลัก'),
})
