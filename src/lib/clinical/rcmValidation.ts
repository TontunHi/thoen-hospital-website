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

export const dateRangeSchema = baseFiscalDateSchema

/**
 * Pagination & search query parameters schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).default(50),
  search: z.string().max(120).optional(),
  pttypes: z.string().max(300).optional(),
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
    ucOnly: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
  })
  .merge(paginationSchema.partial())

/**
 * ADP Search Report Query Schema (OPD & IPD by NHSO ADP Code)
 */
export const adpSearchQuerySchema = baseFiscalDateSchema
  .extend({
    patientType: z.enum(['OPD', 'IPD']).default('OPD'),
    adpCode: z.string().max(1000).optional(),
    cardFilter: z
      .enum([
        'ALL',
        'COMPENSATED',
        'UNCOMPENSATED',
        'WITH_AUTHEN',
        'NO_AUTHEN',
        'UC_ONLY',
        'WITH_OPERATION',
      ])
      .optional(),
    sortBy: z.string().max(50).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    refresh: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
    ucOnly: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
  })
  .merge(paginationSchema.partial())


/**
 * Clopidogrel Drug Usage Report Query Schema (กองทุนยา Clopidogrel)
 */
export const clopidogrelReportQuerySchema = baseFiscalDateSchema
  .extend({
    cardFilter: z
      .enum([
        'ALL',
        'COMPENSATED',
        'UNCOMPENSATED',
        'UC_ONLY',
        'WITH_AUTHEN',
        'NO_AUTHEN',
        'INVOICE',
        'NOT_SENT',
      ])
      .default('ALL'),
    ucOnly: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
    search: z.string().max(120).optional(),
    sortBy: z
      .enum([
        'vstdate',
        'vsttime',
        'hn',
        'cid',
        'ptname',
        'age',
        'qty',
        'money',
        'hosxp_money',
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
 * Streptokinase Drug Fund Report Query Schema (กองทุนยา Streptokinase)
 */
export const streptokinaseReportQuerySchema = baseFiscalDateSchema
  .extend({
    patientType: z.enum(['OPD', 'IPD']).default('OPD'),
    cardFilter: z
      .enum([
        'ALL',
        'AUDIT_PASS',
        'AUDIT_ERROR',
        'COMPENSATED',
        'UNCOMPENSATED',
        'WITH_INVOICE',
        'WITH_REP',
        'NOT_SENT',
      ])
      .default('ALL'),
    search: z.string().max(120).optional(),
    sortBy: z
      .enum([
        'date',
        'time',
        'hn',
        'cid',
        'ptname',
        'age',
        'drugname',
        'money_hosxp',
        'debit',
        'money_eclaim',
        'money_rep',
        'money_invoice',
        'rep',
        'status',
      ])
      .default('date'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    refresh: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
  })
  .merge(paginationSchema.partial())

/**
 * กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์ (Rehabilitation & Disability Fund)
 * หัวข้อย่อย: รายการการให้บริการฟื้นฟูสมรรถภาพ
 * หัวข้อย่อยอีกที: รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability (11.47.3)
 */
export const rehabCardFilterSchema = z
  .enum([
    'ALL',
    'MATCHED',
    'NOT_IN_WEB',
    'NO_REHAB_CODE',
    'NO_VN',
    'COMPENSATED',
    'UNCOMPENSATED',
    'WITH_AUTHEN',
    'NO_AUTHEN',
    'UC_ONLY',
  ])
  .default('ALL')

export const rehabSortFieldSchema = z
  .enum([
    'vstdate',
    'vsttime',
    'vn',
    'hn',
    'cid',
    'ptname',
    'income',
    'compensated',
    'rehab_name',
    'rehab_code',
    'match_status',
  ])
  .default('vstdate')

export const rehabReportQuerySchema = baseFiscalDateSchema
  .extend({
    startDate: z.string().regex(rcmDateRegex).optional(),
    endDate: z.string().regex(rcmDateRegex).optional(),
    cardFilter: rehabCardFilterSchema,
    search: z.string().max(120).optional(),
    sortBy: rehabSortFieldSchema,
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    refresh: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
  })
  .merge(paginationSchema.partial())

/**
 * IMC Eligible Patients Report Query Schema (กองทุนฟื้นฟูสมรรถภาพ: รายงานบริการผู้ป่วย IMC)
 */
export const imcCardFilterSchema = z
  .enum([
    'ALL',
    'CHRONIC',
    'NOT_CHRONIC',
    'IN_WEB',
    'NOT_IN_WEB',
    'COMPENSATED',
    'UNCOMPENSATED',
    'WITH_AUTHEN',
    'NO_AUTHEN',
  ])
  .default('ALL')

export const imcSortFieldSchema = z
  .enum([
    'date',
    'an',
    'vn',
    'hn',
    'cid',
    'ptname',
    'age',
    'income',
    'getprice',
    'compensated',
    'chronic',
    'web',
    'status',
    'rep',
  ])
  .default('date')

export const imcReportQuerySchema = baseFiscalDateSchema
  .extend({
    startDate: z.string().regex(rcmDateRegex).optional(),
    endDate: z.string().regex(rcmDateRegex).optional(),
    patientType: z.enum(['IPD', 'OPD']).default('IPD'),
    cardFilter: imcCardFilterSchema,
    search: z.string().max(120).optional(),
    sortBy: imcSortFieldSchema,
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    refresh: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
  })
  .merge(paginationSchema.partial())

/**
 * กองทุนอวัยวะเทียมและอุปกรณ์ (Instrument Fund - 11.29)
 * กองทุน -> กองทุนอวัยวะเทียมและอุปกรณ์ -> รายชื่อผู้รับบริการ อวัยวะเทียมและอุปกรณ์
 */
export const instrumentCardFilterSchema = z
  .enum([
    'ALL',
    'OA',
    'DM',
    'OTHER',
    'COMPENSATED',
    'INVOICE',
    'REP',
    'UNSENT',
    'DISCREPANCY',
    'WITH_AUTHEN',
    'NO_AUTHEN',
    'UC_ONLY',
  ])
  .default('ALL')

export const instrumentSortFieldSchema = z
  .enum([
    'date',
    'time',
    'hn',
    'cid',
    'ptname',
    'vn',
    'an',
    'room',
    'ward',
    'pttypename',
    'instrument',
    'money_hosxp',
    'debit',
    'money_eclaim',
    'money_rep',
    'money_invoice',
    'diff_money',
    'status',
    'authencode',
  ])
  .default('date')

export const instrumentReportQuerySchema = baseFiscalDateSchema
  .extend({
    patientType: z.enum(['OPD', 'IPD']).default('OPD'),
    cardFilter: instrumentCardFilterSchema,
    search: z.string().max(120).optional(),
    sortBy: instrumentSortFieldSchema,
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    refresh: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
    ucOnly: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
  })
  .merge(paginationSchema.partial())

/**
 * Dental Implant DENSUR Report Query Schema (กองทุนรากฟันเทียม - DENSUR)
 */
export const dentalImplantCardFilterSchema = z
  .enum(['ALL', 'COMPENSATED', 'UNCOMPENSATED', 'WITH_AUTHEN', 'NO_AUTHEN', 'UC_ONLY'])
  .default('ALL')

export const dentalImplantSortFieldSchema = z
  .enum([
    'vstdate',
    'vsttime',
    'hn',
    'cid',
    'ptname',
    'age',
    'pttypename',
    'authencode',
    'pdx',
    'listname',
    'status',
    'rep',
    'compensated',
  ])
  .default('vstdate')

export const dentalImplantDensurQuerySchema = baseFiscalDateSchema
  .extend({
    cardFilter: dentalImplantCardFilterSchema,
    ucOnly: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
    search: z.string().max(120).optional(),
    sortBy: dentalImplantSortFieldSchema,
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    refresh: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
  })
  .merge(paginationSchema.partial())

/**
 * Cancer Fund ADP Query Schema (กองทุนมะเร็ง - CANCER ADP)
 */
export const cancerFundCardFilterSchema = z
  .enum(['ALL', 'COMPENSATED', 'UNCOMPENSATED', 'WITH_AUTHEN', 'NO_AUTHEN', 'INVOICE', 'UC_ONLY'])
  .default('ALL')

export const cancerFundSortFieldSchema = z
  .enum([
    'vstdate',
    'vsttime',
    'hn',
    'cid',
    'ptname',
    'age',
    'income',
    'pttypename',
    'authencode',
    'pdx',
    'listname',
    'status_eclaim',
    'rep',
    'compensated',
  ])
  .default('vstdate')

export const cancerFundAdpQuerySchema = baseFiscalDateSchema
  .extend({
    cardFilter: cancerFundCardFilterSchema,
    ucOnly: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
    search: z.string().max(120).optional(),
    sortBy: cancerFundSortFieldSchema,
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    refresh: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
  })
  .merge(paginationSchema.partial())

/**
 * Walkin Fund Report Query Schema (กองทุน Walkin - ADP WALKIN)
 */
export const walkinFundCardFilterSchema = z
  .enum(['ALL', 'WITH_AUTHEN', 'NO_AUTHEN', 'COMPENSATED', 'INVOICE', 'UNSENT', 'UC_ONLY'])
  .default('ALL')

export const walkinFundSortFieldSchema = z
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
    'pttypename',
  ])
  .default('vstdate')

export const walkinFundReportQuerySchema = baseFiscalDateSchema
  .extend({
    cardFilter: walkinFundCardFilterSchema,
    ucOnly: z
      .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true'), z.literal('1').transform(() => true)])
      .optional(),
    search: z.string().max(120).optional(),
    sortBy: walkinFundSortFieldSchema,
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


