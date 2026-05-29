import { z } from 'zod'

/** Schema for admin login (Step 1: credentials) */
export const adminLoginSchema = z.object({
  username: z
    .string({ error: 'กรุณากรอกชื่อผู้ใช้' })
    .min(1, 'กรุณากรอกชื่อผู้ใช้')
    .max(50, 'ชื่อผู้ใช้ต้องไม่เกิน 50 ตัวอักษร')
    .trim(),
  password: z
    .string({ error: 'กรุณากรอกรหัสผ่าน' })
    .min(1, 'กรุณากรอกรหัสผ่าน')
    .max(128, 'รหัสผ่านต้องไม่เกิน 128 ตัวอักษร'),
})

/** Schema for admin login (Step 2: OTP verification) */
export const adminOtpVerifySchema = z.object({
  otp: z
    .string({ error: 'กรุณากรอกรหัส OTP' })
    .length(6, 'รหัส OTP ต้องเป็นตัวเลข 6 หลัก')
    .regex(/^\d{6}$/, 'รหัส OTP ต้องเป็นตัวเลข 6 หลัก'),
  tempToken: z
    .string({ error: 'ไม่พบ tempToken' })
    .min(1, 'ไม่พบ tempToken'),
})

/** Combined schema that handles both login steps */
export const adminLoginRequestSchema = z.union([
  adminOtpVerifySchema,
  adminLoginSchema,
])
