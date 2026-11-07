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
 * Thai Traditional Medicine Topic 3 Query Schema
 */
export const ttmTopic3QuerySchema = baseFiscalDateSchema
  .extend({
    cardFilter: z
      .enum([
        'ALL',
        'TREATMENT_DRUG',
        'TREATMENT_MASSAGE',
        'TREATMENT_COMPRESS',
        'TREATMENT_OTHER',
        'COMPENSATED',
        'UNCOMPENSATED',
        'WITH_AUTHEN',
      ])
      .default('ALL'),
    place: z.enum(['ALL', 'IN_HOSP', 'OUT_HOSP']).default('ALL'),
    treatmentType: z.string().max(10).optional(),
    ucOnly: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
    sortBy: z
      .enum([
        'vstdate',
        'vsttime',
        'hn',
        'cid',
        'ptname',
        'age',
        'income',
        'compensated',
        'pdx',
        'authencode',
      ])
      .default('vstdate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    refresh: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
  })
  .merge(paginationSchema.partial())

/**
 * Thai Traditional Medicine Topic 11 Query Schema
 */
export const ttmTopic11QuerySchema = baseFiscalDateSchema
  .extend({
    cardFilter: z
      .enum([
        'ALL',
        'COMPENSATED',
        'UNCOMPENSATED',
        'WITH_AUTHEN',
        'NO_AUTHEN',
        'HIP_UCS',
        'HIP_WEL',
        'WITH_INVOICE',
      ])
      .default('ALL'),
    sortBy: z
      .enum([
        'vstdate',
        'vsttime',
        'hn',
        'cid',
        'ptname',
        'age',
        'income',
        'totalQty',
        'totalDrugAmount',
        'compensated',
        'pdx',
        'authCode',
      ])
      .default('vstdate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    refresh: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
  })
  .merge(paginationSchema.partial())

/**
 * Telemed 11.53 Query Schema
 */
export const telemedReportQuerySchema = baseFiscalDateSchema
  .extend({
    cardFilter: z
      .enum([
        'ALL',
        'COMPENSATED',
        'UNCOMPENSATED',
        'WITH_AUTHEN',
        'NO_AUTHEN',
        'UC_ONLY',
        'WITH_PRICE',
        'EXPORT_CODE_5',
      ])
      .default('ALL'),
    ucOnly: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
    searchField: z
      .enum(['ALL', 'HN', 'CID', 'PTNAME', 'VN', 'DIAG', 'PTTYPE', 'DEPARTMENT', 'CLINIC'])
      .default('ALL'),
    sortBy: z
      .enum([
        'vstdate',
        'vsttime',
        'hn',
        'cid',
        'ptname',
        'income',
        'sum_price',
        'compensated',
        'pdx',
        'authencode',
      ])
      .default('vstdate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    refresh: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
  })
  .merge(paginationSchema.partial())

/**
 * Postal Drug 11.52 Query Schema (ส่งยาไปรษณีย์)
 */
export const postalDrugReportQuerySchema = baseFiscalDateSchema
  .extend({
    cardFilter: z
      .enum([
        'ALL',
        'COMPENSATED',
        'UNCOMPENSATED',
        'WITH_AUTHEN',
        'NO_AUTHEN',
        'UC_ONLY',
        'WITH_PRICE',
        'WITHOUT_PRICE',
      ])
      .default('ALL'),
    ucOnly: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
    searchField: z
      .enum(['ALL', 'HN', 'CID', 'PTNAME', 'VN', 'DIAG', 'PTTYPE', 'DEPARTMENT', 'CLINIC'])
      .default('ALL'),
    sortBy: z
      .enum([
        'vstdate',
        'vsttime',
        'hn',
        'cid',
        'ptname',
        'income',
        'sum_price',
        'compensated',
        'pdx',
        'authencode',
      ])
      .default('vstdate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    refresh: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
  })
  .merge(paginationSchema.partial())

/**
 * HOMEWARD Report Query Schema (ระบบ AMed และ Home Ward)
 */
export const homewardReportQuerySchema = baseFiscalDateSchema
  .extend({
    cardFilter: z
      .enum([
        'ALL',
        'ON_AMED',
        'NOT_ON_AMED',
        'WITH_AUTHEN',
        'NO_AUTHEN',
        'WITH_REP',
        'NO_REP',
        'WITH_DEBIT',
      ])
      .default('ALL'),
    search: z.string().max(120).optional(),
    sortBy: z
      .enum([
        'dchdate',
        'admdate',
        'an',
        'hn',
        'cid',
        'ptname',
        'age',
        'los',
        'pdx',
        'income',
        'debit',
        'adjrw',
      ])
      .default('dchdate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    refresh: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
  })
  .merge(paginationSchema.partial())

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

