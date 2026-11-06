import { z } from 'zod'

/**
 * Standard date regex for RCM Dashboards (YYYY-MM-DD)
 */
export const rcmDateRegex = /^\d{4}-\d{2}-\d{2}$/

/**
 * Base date range schema for RCM fiscal/custom date queries
 */
export const baseFiscalDateSchema = z.object({
  ds1: z
    .string()
    .regex(rcmDateRegex, 'รูปแบบวันที่เริ่มต้นต้องเป็น YYYY-MM-DD')
    .optional(),
  ds2: z
    .string()
    .regex(rcmDateRegex, 'รูปแบบวันที่สิ้นสุดต้องเป็น YYYY-MM-DD')
    .optional(),
})

/**
 * Pagination & search query parameters schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(500).default(50),
  search: z.string().max(120).optional(),
  exportAll: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
    .optional(),
})

/**
 * OPD Department Summary Query Schema
 */
export const opdDeptSummaryQuerySchema = baseFiscalDateSchema.extend({
  spclty: z.string().max(20).optional(),
})

/**
 * OPD Doctor Summary Query Schema
 */
export const opdDoctorSummaryQuerySchema = baseFiscalDateSchema.extend({
  spclty: z.string().max(20).optional(),
  doctor: z.string().max(50).optional(),
})

/**
 * OPD Patient Report / Visits Query Schema
 */
export const opdReportQuerySchema = baseFiscalDateSchema
  .extend({
    spclty: z.string().max(20).optional(),
    department: z.string().max(50).optional(),
    doctor: z.string().max(50).optional(),
    pttype: z.string().max(20).optional(),
  })
  .merge(paginationSchema.partial())

/**
 * IPD Department AdjRW Query Schema
 */
export const ipdDeptAdjrwQuerySchema = baseFiscalDateSchema.extend({
  spclty: z.string().max(20).optional(),
  ward: z.string().max(20).optional(),
})

/**
 * IPD Report Query Schema (supports summary stats, paginated list, and exportAll)
 */
export const ipdReportQuerySchema = baseFiscalDateSchema
  .extend({
    ward: z.string().max(20).optional(),
    pttype: z.string().max(20).optional(),
    admdoctor: z.string().max(50).optional(),
    dchdoctor: z.string().max(50).optional(),
    delayGroup: z.string().max(20).optional(),
    mode: z.enum(['summary', 'details', 'full']).default('full'),
  })
  .merge(paginationSchema.partial())

/**
 * SSS Dental Report Query Schema
 */
export const sssDentalQuerySchema = baseFiscalDateSchema.extend({
  doctor: z.string().max(50).optional(),
  visits: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
    .optional(),
})

/**
 * Helper to validate URLSearchParams using a Zod schema cleanly
 */
export function validateSearchParams<T>(
  schema: z.ZodSchema<T>,
  searchParams: URLSearchParams
): { success: true; data: T } | { success: false; error: string } {
  const rawObj = Object.fromEntries(searchParams.entries())
  const result = schema.safeParse(rawObj)

  if (!result.success) {
    const firstIssue = result.error.issues[0]
    return {
      success: false,
      error: firstIssue?.message || 'พารามิเตอร์ที่ระบุไม่ถูกต้อง',
    }
  }

  return {
    success: true,
    data: result.data,
  }
}
