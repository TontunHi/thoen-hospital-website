import { queryGtwDb, QueryExecutor } from '@/lib/gtwDb'
import { logger } from '@/lib/logger'

export interface GtwRawArticle {
  ARTICLE_ID: number
  ARTICLE_NUM: string
  SUP_FSN: string | null
  ARTICLE_NAME: string
  ARTICLE_MODELS: string | null
  SERIAL_NO: string | null
  RECEIVE_DATE: Date | string | null
  INS_START_DATE: Date | string | null
  INS_END_DATE: Date | string | null
  EXPIRE_DATE: Date | string | null
  PRICE_PER_UNIT: string | number | null
  VENDOR_ID: string | null
  DOC_NO_NUM: string | null
  DEP_SUB_SUB_NAME: string | null
  LOCATEDEPT: string | null
  STATUS_ID: string | null
  STATUS_DELETE: string | null
  updated_at: Date | string | null
}

export interface GtwSyncSummary {
  totalFound: number
  inserted: number
  updated: number
  skipped: number
  errors: number
}

/**
 * Determine asset category from FSN code and name
 */
export function inferAssetCategory(fsnNum: string | null, name: string): 'IT' | 'MEDICAL' | 'GENERAL' {
  const cleanFsn = (fsnNum || '').trim()
  const lowerName = name.toLowerCase()

  if (
    cleanFsn.startsWith('7440') ||
    cleanFsn.startsWith('7430') ||
    cleanFsn.startsWith('5810') ||
    cleanFsn.startsWith('5815') ||
    cleanFsn.startsWith('5835') ||
    cleanFsn.startsWith('5965') ||
    lowerName.includes('คอมพิวเตอร์') ||
    lowerName.includes('โน้ตบุ๊ค') ||
    lowerName.includes('notebook') ||
    lowerName.includes('server') ||
    lowerName.includes('printer') ||
    lowerName.includes('ปริ้นเตอร์') ||
    lowerName.includes('เครื่องพิมพ์') ||
    lowerName.includes('ups') ||
    lowerName.includes('สำรองไฟ') ||
    lowerName.includes('switch') ||
    lowerName.includes('router')
  ) {
    return 'IT'
  }

  if (
    cleanFsn.startsWith('6515') ||
    cleanFsn.startsWith('6520') ||
    cleanFsn.startsWith('6525') ||
    cleanFsn.startsWith('6530') ||
    lowerName.includes('ความดัน') ||
    lowerName.includes('ช่วยหายใจ') ||
    lowerName.includes('suction') ||
    lowerName.includes('ทันตกรรม') ||
    lowerName.includes('เอกซเรย์') ||
    lowerName.includes('x-ray') ||
    lowerName.includes('oximeter') ||
    lowerName.includes('เตียงผู้ป่วย') ||
    lowerName.includes('รถเข็นนอน')
  ) {
    return 'MEDICAL'
  }

  return 'GENERAL'
}

/**
 * Fetch raw articles from GTW database
 */
export async function fetchGtwArticles(
  executor: QueryExecutor = queryGtwDb,
  options: { limit?: number; offset?: number; since?: string } = {}
): Promise<GtwRawArticle[]> {
  const { limit, offset, since } = options
  let sql = `
    SELECT 
      a.ARTICLE_ID,
      a.ARTICLE_NUM,
      COALESCE(a.SUP_FSN, s.SUP_FSN_NUM) as SUP_FSN,
      a.ARTICLE_NAME,
      a.ARTICLE_MODELS,
      a.SERIAL_NO,
      a.RECEIVE_DATE,
      a.INS_START_DATE,
      a.INS_END_DATE,
      a.EXPIRE_DATE,
      a.PRICE_PER_UNIT,
      a.VENDOR_ID,
      a.DOC_NO_NUM,
      a.DEP_SUB_SUB_NAME,
      a.LOCATEDEPT,
      a.STATUS_ID,
      a.STATUS_DELETE,
      a.updated_at
    FROM asset_article a
    LEFT JOIN supplies s ON a.SUP_ID = s.ID
    WHERE a.ARTICLE_NUM IS NOT NULL 
      AND a.ARTICLE_NUM != ''
      AND (a.STATUS_DELETE = 'false' OR a.STATUS_DELETE IS NULL)
  `

  const params: any[] = []

  if (since) {
    sql += ` AND a.updated_at >= ?`
    params.push(since)
  }

  sql += ` ORDER BY a.ARTICLE_ID DESC`

  if (limit) {
    sql += ` LIMIT ?`
    params.push(limit)
    if (offset) {
      sql += ` OFFSET ?`
      params.push(offset)
    }
  }

  try {
    const rows = await executor(sql, params)
    return rows as GtwRawArticle[]
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to fetch articles from GTW')
    throw err
  }
}
