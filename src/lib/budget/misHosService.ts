import https from 'https'

export const THOEN_HOSPITAL_CODE = '11152'
export const DEFAULT_PROVINCE_CODE = '52'
export const DEFAULT_PROVINCE_NAME = 'ลำปาง'

export interface MisHosSubmenu {
  id: string
  name: string
  stId: string
  defaultSsid?: string
  description?: string
}

export interface MisHosCategory {
  id: string
  title: string
  iconName?: string
  submenus: MisHosSubmenu[]
}

export interface MisHosSubReport {
  ssid: string
  report_name: string
  chart_type: 'bar' | 'table' | 'line' | 'pie' | string
  report_width: string
  flag_data: string
}

export interface MisHosTemplateConfig {
  stId: string
  templateName: string
  subReports: MisHosSubReport[]
}

export interface MisHosTableDataResult {
  ssid: string
  // Upstream NHSO SimpleStudio SQL statements return dynamic, heterogeneous columns per SSID
  records: Record<string, any>[]
  source: 'upstream' | 'cache'
  fetchedAt: string
}

export interface MisHosHospitalInfo {
  hcode: string
  hname: string
  provinceId: string
  provinceName: string
  nhsoName: string
  nhsoZone: string
}

export const MIS_HOS_MENU_CATEGORIES: MisHosCategory[] = [
  {
    id: '0',
    title: 'การโอนเงิน (Budget Transfer)',
    submenus: [
      { id: '0.1', name: '0.1 รายการรับเงิน (ทุกกองทุน / รายเดือน)', stId: '1843', defaultSsid: '1825' },
      { id: '0.2', name: '0.2 Statement-UC (84 กองทุนย่อย / พึงรับ)', stId: '1823', defaultSsid: '1824' },
    ],
  },
  {
    id: '0-eclaim',
    title: '0-Eclaim Data (ข้อมูลส่งเบิก)',
    submenus: [
      { id: '0-ec-1', name: 'สิทธิ UC (พึงรับชดเชย E-Claim รายเดือน)', stId: '1803', defaultSsid: '1803' },
      { id: '0-ec-2', name: 'สิทธิอื่น ๆ (เบิกจ่ายตรง/อปท.)', stId: '1804', defaultSsid: '1804' },
    ],
  },
  {
    id: '1',
    title: '1. บริการผู้ป่วยนอก (OP)',
    submenus: [
      { id: '1.1', name: '1.1 ผู้ป่วยนอกฉุกเฉิน (OPAE)', stId: '1469', defaultSsid: '1469' },
      { id: '1.2', name: '1.2 OP-Refer', stId: '1470', defaultSsid: '1470' },
      { id: '1.3', name: '1.3 ค่าพาหนะส่งต่อ', stId: '1471', defaultSsid: '1471' },
      { id: '1.4', name: '1.4 OP Walk-in ทุกที่', stId: '1472', defaultSsid: '1472' },
      { id: '1.5', name: '1.5 ชดเชย On-Top', stId: '1484', defaultSsid: '1484' },
    ],
  },
  {
    id: '2',
    title: '2. บริการผู้ป่วยใน (IP)',
    submenus: [
      { id: '2.1', name: '2.1 บริการผู้ป่วยใน (IP & AdjRW)', stId: '1464', defaultSsid: '1464' },
      { id: '2.2', name: '2.2 ส่งข้อมูลผู้ป่วยใน / Error ติด C ติด Deny', stId: '1603', defaultSsid: '1603' },
    ],
  },
  {
    id: '3',
    title: '3. บริการนอกเครือข่าย',
    submenus: [
      { id: '3.1', name: '3.1 ฉุกเฉินนอกเขต', stId: '1482', defaultSsid: '1482' },
      { id: '3.2', name: '3.2 OP-Refer นอกเขต', stId: '582', defaultSsid: '582' },
      { id: '3.3', name: '3.3 ค่าพาหนะส่งต่อนอกเขต', stId: '1062', defaultSsid: '1062' },
    ],
  },
  {
    id: '4',
    title: '4. บริการค่าใช้จ่ายสูง (High Cost)',
    submenus: [
      { id: '4.1', name: '4.1 ยาละลายลิ่มเลือด (STEMI)', stId: '1468', defaultSsid: '1468' },
      { id: '4.2', name: '4.2 เคมีบำบัด มะเร็ง', stId: '1483', defaultSsid: '1483' },
      { id: '4.3', name: '4.3 ผ่าตัดต้อกระจก (Cataract)', stId: '1631', defaultSsid: '1631' },
      { id: '4.4', name: '4.4 อวัยวะเทียมและอุปกรณ์', stId: '1084', defaultSsid: '1084' },
      { id: '4.5', name: '4.5 นิ่วในระบบทางเดินปัสสาวะ', stId: '1465', defaultSsid: '1465' },
      { id: '4.6', name: '4.6 บริการประคับประคอง (Palliative Care)', stId: '503', defaultSsid: '503' },
    ],
  },
  {
    id: '5',
    title: '5. ส่งเสริมป้องกันโรค (PP)',
    submenus: [
      { id: '5.1', name: '5.1 บริการหญิงตั้งครรภ์ (ANC)', stId: '1527', defaultSsid: '1527' },
      { id: '5.2', name: '5.2 ตรวจคัดกรองมะเร็ง', stId: '1528', defaultSsid: '1528' },
      { id: '5.3', name: '5.3 ประเมินปัจจัยเสี่ยงสุขภาพ', stId: '1504', defaultSsid: '1504' },
      { id: '5.4', name: '5.4 บริการทันตกรรมสร้างเสริมสุขภาพ', stId: '1524', defaultSsid: '1524' },
      { id: '5.5', name: '5.5 ฉีดวัคซีนไข้หวัดใหญ่ (Flu Vaccine)', stId: '865', defaultSsid: '865' },
    ],
  },
  {
    id: '7',
    title: '7. นโยบายสำคัญ',
    submenus: [
      { id: '7.1', name: '7.1 Cancer Anywhere (มะเร็งรักษาทุกที่)', stId: '2183', defaultSsid: '2183' },
      { id: '7.2', name: '7.2 30 บาทรักษาทุกที่ (Walk-in)', stId: '2243', defaultSsid: '2243' },
      { id: '7.3', name: '7.3 การแพทย์ทางไกล (Telemedicine)', stId: '2204', defaultSsid: '2204' },
      { id: '7.4', name: '7.4 ระบบระบุตัวตน (Digital Health ID)', stId: '2207', defaultSsid: '2207' },
    ],
  },
  {
    id: '8',
    title: '8. บริการเฉพาะ (DMIS)',
    submenus: [
      { id: '8.1', name: '8.1 โรคไตวายเรื้อรัง (CKD)', stId: '945', defaultSsid: '945' },
      { id: '8.2', name: '8.2 บริการ MOPH', stId: '404', defaultSsid: '404' },
      { id: '8.3', name: '8.3 ปลูกถ่ายไต (KTP)', stId: '948', defaultSsid: '948' },
    ],
  },
  {
    id: '9',
    title: '9. บริการสิทธิอื่น',
    submenus: [
      { id: '9.1', name: '9.1 สิทธิข้าราชการ (CSMBS)', stId: '1525', defaultSsid: '1525' },
      { id: '9.2', name: '9.2 สิทธิ อปท. (LGO)', stId: '1164', defaultSsid: '1164' },
    ],
  },
]

interface CacheEntry<T> {
  data: T
  cachedAt: number
}

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export class MisHosService {
  private static cache = new Map<string, CacheEntry<any>>()
  private static readonly BASE_URL = 'https://mishos.nhso.go.th/mis_hos_apixam/'
  private static readonly STATEMENT_ENDPOINT = 'simplestudio/ss_statement.php'
  private static readonly HOSPITAL_SEE_ENDPOINT = 'l_hospital_see.php'

  private static httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  })

  public static clearCache(): void {
    this.cache.clear()
  }

  /**
   * Fetch and decode template configuration (cards, chart types, sub-reports)
   */
  public static async getTemplateConfig(
    stId: string,
    options?: {
      year?: string
      hcode?: string
      subfund?: string
      fetchImpl?: typeof fetch
    }
  ): Promise<MisHosTemplateConfig | null> {
    const year = options?.year || '2568'
    const hcode = options?.hcode || THOEN_HOSPITAL_CODE
    const subfund = options?.subfund || ''
    const fetchFn = options?.fetchImpl || fetch

    const cacheKey = `tpl:${stId}:${year}:${hcode}:${subfund}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.data
    }

    try {
      const url = `${this.BASE_URL}${this.STATEMENT_ENDPOINT}`
      const res = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          st_id: stId,
          api_type: 'template_get',
          year,
          hcode,
          subfund,
        }),
        // @ts-expect-error Node fetch supports agent
        agent: this.httpsAgent,
      })

      if (!res.ok) return null
      const json = await res.json()
      if (!Array.isArray(json) || json.length === 0) return null

      const first = json[0]
      let subReports: MisHosSubReport[] = []
      if (first.ST_CONFIG) {
        try {
          const decodedStr = Buffer.from(first.ST_CONFIG, 'base64').toString('utf8')
          subReports = JSON.parse(decodedStr)
        } catch {
          subReports = []
        }
      }

      const result: MisHosTemplateConfig = {
        stId: first.ST_ID || stId,
        templateName: first.ST_TEMPLATENAME || 'รายงาน',
        subReports,
      }

      this.cache.set(cacheKey, { data: result, cachedAt: Date.now() })
      return result
    } catch {
      return null
    }
  }

  /**
   * Fetch tabular or chart data for a specific statement ID (ssid)
   */
  public static async getTableData(
    ssid: string,
    options?: {
      hcode?: string
      year?: string
      province?: string
      subfund?: string
      provinceName?: string
      forceRefresh?: boolean
      fetchImpl?: typeof fetch
    }
  ): Promise<MisHosTableDataResult> {
    const hcode = options?.hcode || THOEN_HOSPITAL_CODE
    const year = options?.year || '2568'
    const province = options?.province || DEFAULT_PROVINCE_CODE
    const provinceName = options?.provinceName || DEFAULT_PROVINCE_NAME
    const subfund = options?.subfund || ''
    const forceRefresh = options?.forceRefresh || false
    const fetchFn = options?.fetchImpl || fetch

    const cacheKey = `tbl:${ssid}:${hcode}:${year}:${province}:${subfund}`
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return {
          ssid,
          records: cached.data,
          source: 'cache',
          fetchedAt: new Date(cached.cachedAt).toISOString(),
        }
      }
    }

    try {
      const url = `${this.BASE_URL}${this.STATEMENT_ENDPOINT}`
      
      // Some statements query CE year (e.g. 2024), some BE (e.g. 2567)
      // We first try year as provided
      let records = await this.executeTableQuery(url, {
        ssid,
        api_type: 'get_tabledata',
        hcode,
        province,
        year,
        subfund,
        province_name: provinceName,
      }, fetchFn)

      // If empty and year is BE (>= 2500), try CE (year - 543)
      const numYear = parseInt(year, 10)
      if (records.length === 0 && !isNaN(numYear) && numYear > 2500) {
        const ceYear = String(numYear - 543)
        const ceRecords = await this.executeTableQuery(url, {
          ssid,
          api_type: 'get_tabledata',
          hcode,
          province,
          year: ceYear,
          subfund,
          province_name: provinceName,
        }, fetchFn)
        if (ceRecords.length > 0) {
          records = ceRecords
        }
      }

      this.cache.set(cacheKey, { data: records, cachedAt: Date.now() })
      return {
        ssid,
        records,
        source: 'upstream',
        fetchedAt: new Date().toISOString(),
      }
    } catch {
      return {
        ssid,
        records: [],
        source: 'upstream',
        fetchedAt: new Date().toISOString(),
      }
    }
  }

  private static async executeTableQuery(
    url: string,
    body: Record<string, string>,
    fetchFn: typeof fetch
  ): Promise<Record<string, any>[]> {
    try {
      const res = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        // @ts-expect-error Node fetch supports agent
        agent: this.httpsAgent,
      })

      if (!res.ok) return []
      const text = await res.text()
      if (text.startsWith('<br') || text.includes('error')) return []
      const json = JSON.parse(text)
      return Array.isArray(json) ? json : []
    } catch {
      return []
    }
  }

  /**
   * Fetch hospital lookup info (name, province, zone)
   */
  public static async getHospitalInfo(
    hcode: string,
    options?: { fetchImpl?: typeof fetch }
  ): Promise<MisHosHospitalInfo | null> {
    const fetchFn = options?.fetchImpl || fetch
    const cacheKey = `hosp:${hcode}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS * 6) {
      return cached.data
    }

    try {
      const url = `${this.BASE_URL}${this.HOSPITAL_SEE_ENDPOINT}?hcode=${encodeURIComponent(hcode)}`
      const res = await fetchFn(url, {
        // @ts-expect-error Node fetch supports agent
        agent: this.httpsAgent,
      })
      if (!res.ok) return null
      const json = await res.json()
      if (!Array.isArray(json) || json.length === 0) return null

      const first = json[0]
      const result: MisHosHospitalInfo = {
        hcode,
        hname: first.HNAME || `รพ. รหัส ${hcode}`,
        provinceId: first.PROVINCE_ID || DEFAULT_PROVINCE_CODE,
        provinceName: first.PROVINCE_NAME || DEFAULT_PROVINCE_NAME,
        nhsoName: first.NHSO_NAME || '',
        nhsoZone: first.NHSO_ZONE || '',
      }

      this.cache.set(cacheKey, { data: result, cachedAt: Date.now() })
      return result
    } catch {
      return null
    }
  }
}
