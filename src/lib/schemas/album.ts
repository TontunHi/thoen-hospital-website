import { z } from 'zod'

const imagePathValidator = z
  .string()
  .min(1, 'กรุณาระบุ URL รูปภาพ')
  .max(1000, 'URL รูปภาพต้องไม่เกิน 1000 ตัวอักษร')
  .refine(
    (val) => val.startsWith('/') || val.startsWith('http://') || val.startsWith('https://'),
    { message: 'รูปแบบ URL รูปภาพไม่ถูกต้อง' }
  )

export const albumImageInputSchema = z.object({
  imageUrl: imagePathValidator,
  caption: z
    .string()
    .max(500, 'คำบรรยายภาพต้องไม่เกิน 500 ตัวอักษร')
    .optional()
    .nullable(),
  displayOrder: z.number().int().min(0).optional(),
})

export const albumCreateSchema = z.object({
  title: z
    .string({ error: 'กรุณากรอกชื่อกิจกรรมหรือหัวข้อภาพข่าว' })
    .min(1, 'กรุณากรอกชื่อกิจกรรมหรือหัวข้อภาพข่าว')
    .max(500, 'หัวข้อต้องไม่เกิน 500 ตัวอักษร')
    .trim(),
  slug: z
    .string()
    .max(255, 'Slug ต้องไม่เกิน 255 ตัวอักษร')
    .regex(/^[a-zA-Z0-9\u0E00-\u0E7F\-_]+$/, 'รูปแบบ slug ไม่ถูกต้อง')
    .optional(),
  description: z
    .string()
    .max(2000, 'คำบรรยายต้องไม่เกิน 2000 ตัวอักษร')
    .optional()
    .nullable(),
  eventDate: z
    .string({ error: 'กรุณาระบุวันที่จัดกิจกรรม' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD'),
  coverImageUrl: imagePathValidator.optional().nullable(),
  status: z
    .enum(['PUBLISHED', 'DRAFT'], {
      message: 'สถานะต้องเป็น PUBLISHED หรือ DRAFT',
    })
    .default('PUBLISHED'),
  isPinned: z.boolean().default(false),
  images: z
    .array(albumImageInputSchema)
    .min(1, 'กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป')
    .max(300, 'สามารถแนบรูปภาพได้สูงสุด 300 รูปต่อ 1 เดือน'),
})

export const albumUpdateSchema = albumCreateSchema.partial().refine(
  (data) => data.images === undefined || data.images.length >= 1,
  { message: 'อัลบั้มต้องมีรูปภาพอย่างน้อย 1 รูป', path: ['images'] }
)
