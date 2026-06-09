import { z } from 'zod'

export const heroSlideSchema = z.object({
  imagePath: z.string().min(1, 'กรุณาอัปโหลดรูปภาพก่อนบันทึก'),
  title: z.string().optional().nullable(),
  linkUrl: z.string().url('รูปแบบ URL ไม่ถูกต้อง').or(z.literal('')).or(z.literal(null)).optional().nullable(),
  startDate: z.string().min(1, 'กรุณาระบุเวลาที่เริ่มแสดง'),
  endDate: z.string().min(1, 'กรุณาระบุเวลาสิ้นสุด'),
  displayOrder: z.number().int().optional().default(0),
}).refine((data) => {
  const start = new Date(data.startDate)
  const end = new Date(data.endDate)
  return start < end
}, {
  message: 'เวลาที่เริ่มแสดงจะต้องเกิดก่อนเวลาสิ้นสุด',
  path: ['startDate'],
})
