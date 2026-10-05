import { z } from 'zod'

export const heroSlideSchema = z.object({
  imagePath: z.string().min(1, 'กรุณาอัปโหลดรูปภาพหรือวิดีโอก่อนบันทึก'),
  title: z.string().optional().nullable(),
  linkUrl: z.string().url('รูปแบบ URL ไม่ถูกต้อง').or(z.literal('')).or(z.literal(null)).optional().nullable(),
  startDate: z.string().min(1, 'กรุณาระบุเวลาที่เริ่มแสดง'),
  endDate: z.string().min(1, 'กรุณาระบุเวลาสิ้นสุด'),
  displayOrder: z.number().int().optional().default(0),
  duration: z.coerce.number().int().min(1, 'ระยะเวลาแสดงผลต้องอย่างน้อย 1 วินาที').max(300, 'ระยะเวลาแสดงผลต้องไม่เกิน 300 วินาที').optional().default(6),
}).refine((data) => {
  const start = new Date(data.startDate)
  const end = new Date(data.endDate)
  return start < end
}, {
  message: 'เวลาที่เริ่มแสดงจะต้องเกิดก่อนเวลาสิ้นสุด',
  path: ['startDate'],
})
