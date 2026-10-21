import https from 'https'

export interface SmtBudgetRecord {
  fiscalYear?: string
  runDt?: string
  batchNo?: string
  postingDate?: string
  refDocNo?: string
  vndrNo?: string
  fundName?: string
  fundGroup?: number
  fundGroupDescr?: string
  fundDescr?: string
  mouGrpCode?: string
  pmntMetd?: string
  bankNm?: string
  pmntStts?: string
  amount: number
  wait: number
  debt: number
  bond: number
  odbt?: number
  vat: number
  total: number
  downloadPAYMFileName?: string
  downloadUrl?: string
  fileName?: string
  [key: string]: any
}

export interface SmtBudgetSummary {
  recordCount: number
  totalAmount: number
  totalNetPayment: number
  totalWait: number
  totalDebt: number
  totalVat: number
  totalBond: number
  totalOdbt: number
}

export interface SmtBudgetSearchResult {
  source: 'cache' | 'upstream' | 'fallback_cache'
  fetchedAt: number
  summary: SmtBudgetSummary
  datas: SmtBudgetRecord[]
}

export interface SmtSearchOptions {
  budgetYears?: string[]
  transferStartDate?: string
  transferEndDate?: string
  vendorId5Digit?: string
  zoneId?: string
  vendorSearchConditionCode?: string
  budgetSource?: string
  forceRefresh?: boolean
}

export type SmtFetcher = (payload: Record<string, any>) => Promise<{ datas: any[] }>

const UPSTREAM_API_URL = 'https://smt.nhso.go.th/smtf/api/budgetreport/budgetSummaryByVendorReport/search'
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

// In-Memory Cache Store with TTL
const CACHE_STORE: Map<string, { timestamp: number; datas: SmtBudgetRecord[] }> = new Map()

async function defaultHttpsFetcher(payload: Record<string, any>): Promise<{ datas: any[] }> {
  return new Promise((resolve, reject) => {
    const dataString = JSON.stringify(payload)
    const url = new URL(UPSTREAM_API_URL)

    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        rejectUnauthorized: false, // Bypasses self-signed or incomplete government SSL chain
        headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
          'Content-Length': Buffer.byteLength(dataString),
        },
        timeout: 15000,
      },
      res => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', chunk => {
          body += chunk
        })
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(body)
              resolve({ datas: parsed.datas || [] })
            } catch (err) {
              reject(new Error(`Failed to parse SMT JSON response: ${(err as Error).message}`))
            }
          } else {
            reject(new Error(`SMT API returned HTTP status ${res.statusCode}`))
          }
        })
      }
    )

    req.on('error', err => {
      reject(err)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('SMT API request timed out after 15 seconds'))
    })

    req.write(dataString)
    req.end()
  })
}

export class SmtBudgetService {
  public static clearCache(): void {
    CACHE_STORE.clear()
  }

  public static getCacheSize(): number {
    return CACHE_STORE.size
  }

  public static async searchBudget(
    options: SmtSearchOptions = {},
    customFetcher?: SmtFetcher
  ): Promise<SmtBudgetSearchResult> {
    const fetcher = customFetcher || defaultHttpsFetcher

    const rawYears = options.budgetYears && options.budgetYears.length > 0 ? options.budgetYears : ['2570']
    const years = Array.from(new Set(rawYears.map(y => y.trim()).filter(Boolean))).sort().reverse()

    const vendorId = options.vendorId5Digit?.trim() || '11152'
    const zoneId = options.zoneId?.trim() || ''
    const vendorSearchConditionCode = options.vendorSearchConditionCode?.trim() || '2'
    const budgetSource = options.budgetSource?.trim() || ''

    const allItems: SmtBudgetRecord[] = []
    const sources: ('cache' | 'upstream' | 'fallback_cache')[] = []
    const now = Date.now()

    for (const yr of years) {
      const yrNum = parseInt(yr, 10) || 2570
      const startDt =
        years.length === 1 && options.transferStartDate ? options.transferStartDate : `01/10/${yrNum - 1}`
      const endDt = years.length === 1 && options.transferEndDate ? options.transferEndDate : `30/09/${yrNum}`

      const cacheKey = `${yr}_${startDt}_${endDt}_${vendorId}_${zoneId}_${budgetSource}`

      if (!options.forceRefresh && CACHE_STORE.has(cacheKey)) {
        const cached = CACHE_STORE.get(cacheKey)!
        if (now - cached.timestamp < DEFAULT_CACHE_TTL_MS) {
          for (const item of cached.datas) {
            allItems.push({ ...item, fiscalYear: yr })
          }
          sources.push('cache')
          continue
        }
      }

      const payload = {
        budgetYear: yr,
        transferStartDate: startDt,
        transferEndDate: endDt,
        vendorId5Digit: vendorId,
        zoneId: zoneId,
        vendorSearchConditionCode,
        budgetSource,
      }

      try {
        const response = await fetcher(payload)
        const rawItems = response.datas || []

        CACHE_STORE.set(cacheKey, { timestamp: now, datas: rawItems })

        for (const item of rawItems) {
          allItems.push({ ...item, fiscalYear: yr })
        }
        sources.push('upstream')
      } catch (err) {
        // Fallback to cache if available even if expired
        if (CACHE_STORE.has(cacheKey)) {
          const fallback = CACHE_STORE.get(cacheKey)!
          for (const item of fallback.datas) {
            allItems.push({ ...item, fiscalYear: yr })
          }
          sources.push('fallback_cache')
        } else {
          // If no cache, propagate or log error
          throw err
        }
      }
    }

    // Compute KPI Aggregations
    let totalAmount = 0
    let totalNetPayment = 0
    let totalWait = 0
    let totalDebt = 0
    let totalVat = 0
    let totalBond = 0
    let totalOdbt = 0

    for (const item of allItems) {
      totalAmount += Number(item.amount) || 0
      totalNetPayment += Number(item.total) || 0
      totalWait += Number(item.wait) || 0
      totalDebt += Number(item.debt) || 0
      totalVat += Number(item.vat) || 0
      totalBond += Number(item.bond) || 0
      totalOdbt += Number(item.odbt) || 0
    }

    const summary: SmtBudgetSummary = {
      recordCount: allItems.length,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalNetPayment: Math.round(totalNetPayment * 100) / 100,
      totalWait: Math.round(totalWait * 100) / 100,
      totalDebt: Math.round(totalDebt * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalBond: Math.round(totalBond * 100) / 100,
      totalOdbt: Math.round(totalOdbt * 100) / 100,
    }

    const overallSource = sources.every(s => s === 'cache') && sources.length > 0 ? 'cache' : 'upstream'

    return {
      source: overallSource,
      fetchedAt: now,
      summary,
      datas: allItems,
    }
  }
}
