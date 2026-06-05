import { z } from 'zod'

/** Schema for creating a news article */
export const newsCreateSchema = z.object({
  title: z
    .string({ error: 'กรุณากรอกหัวข้อข่าว' })
    .min(1, 'กรุณากรอกหัวข้อข่าว')
    .max(255, 'หัวข้อข่าวต้องไม่เกิน 255 ตัวอักษร')
    .trim(),
  youtubeUrl: z
    .string()
    .url('รูปแบบ URL YouTube ไม่ถูกต้อง')
    .max(255, 'URL ต้องไม่เกิน 255 ตัวอักษร')
    .optional()
    .nullable(),
  pdfUrl: z
    .string()
    .max(255, 'URL ต้องไม่เกิน 255 ตัวอักษร')
    .optional()
    .nullable(),
  status: z
    .enum(['PUBLISHED', 'DRAFT', 'ARCHIVED'], {
      message: 'สถานะต้องเป็น PUBLISHED, DRAFT, หรือ ARCHIVED',
    })
    .optional(),
  category: z
    .string()
    .max(100, 'หมวดหมู่ต้องไม่เกิน 100 ตัวอักษร')
    .optional(),
  publishedAt: z
    .string()
    .datetime({ message: 'รูปแบบวันที่เผยแพร่ไม่ถูกต้อง' })
    .optional()
    .nullable(),
  expiredAt: z
    .string()
    .datetime({ message: 'รูปแบบวันที่หมดอายุไม่ถูกต้อง' })
    .optional()
    .nullable(),
  images: z
    .array(
      z.string().max(500).refine(
        (val) => val.startsWith('/') || val.startsWith('http://') || val.startsWith('https://'),
        { message: 'รูปแบบ URL รูปภาพไม่ถูกต้อง' }
      )
    )
    .max(20, 'รูปภาพต้องไม่เกิน 20 รูป')
    .optional(),
})
