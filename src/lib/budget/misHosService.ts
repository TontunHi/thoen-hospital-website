import https from 'https'
import { calculateThaiFiscalYear } from '@/lib/events/eventUtils'

export { calculateThaiFiscalYear }

/**
 * แปลงปี พ.ศ. เป็น ค.ศ. สำหรับเรียก API สปสช. (เช่น 2569 -> 2026)
 */
export function toMisHosCeYear(year: string): string {
  const numYear = parseInt(year, 10)
  if (!isNaN(numYear) && numYear > 2400) {
    return String(numYear - 543)
  }
  return year
}

/**
 * คำนวณรายการปีงบประมาณย้อนหลัง โดยเริ่มต้นจากปีงบประมาณปัจจุบัน (ตามปฏิทินราชการไทย เดือนตุลาคมเป็นต้นไป)
 * เช่น เดือนตุลาคม 2026 = ปีงบประมาณ 2570
 */
export function getAvailableMisHosFiscalYears(count: number = 11): string[] {
  const currentFiscalYear = parseInt(calculateThaiFiscalYear(), 10)
  const years: string[] = []
  for (let i = 0; i < count; i++) {
    years.push(String(currentFiscalYear - i))
  }
  return years
}

export const THOEN_HOSPITAL_CODE = '11152'
export const DEFAULT_PROVINCE_CODE = '52'
export const DEFAULT_PROVINCE_NAME = 'ลำปาง'

export interface MisHosSubmenu {
  id: string
  name: string
  stId: string
  secondaryStId?: string
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

export interface MisHosChartConfig {
  ssid: string
  reportName: string
  chartType: string
  yaxis?: string
  xaxis?: string
  xaxisLabel?: string[]
  showvalue?: boolean
  table_header?: string[]
  color?: string[]
  digit?: string | number
  height?: number
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
  chartConfig?: MisHosChartConfig | null
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
      { id: '0.2', name: '0.2 Statement-UC (84 กองทุนย่อย / พึงรับ)', stId: '1823', defaultSsid: '1803' },
    ],
  },
  {
    id: '0-eclaim',
    title: '0-Eclaim Data (ข้อมูลส่งเบิก)',
    submenus: [
      { id: '0-ec-1', name: 'สิทธิ UC (พึงรับชดเชย E-Claim รายเดือน)', stId: '404', secondaryStId: '945', defaultSsid: '430' },
      { id: '0-ec-2', name: 'สิทธิอื่น ๆ (เบิกจ่ายตรง/อปท.)', stId: '424', secondaryStId: '948', defaultSsid: '428' },
    ],
  },
  {
    id: '1',
    title: '1. บริการผู้ป่วยนอก (OP)',
    submenus: [
      { id: '1.1', name: '1.1 ผู้ป่วยนอกฉุกเฉิน (OPAE)', stId: '1464', defaultSsid: '1507' },
      { id: '1.2', name: '1.2 OP-Refer (ผู้ป่วยนอกข้ามจังหวัด)', stId: '1482', defaultSsid: '1566' },
      { id: '1.3', name: '1.3 ค่าพาหนะส่งต่อ', stId: '1631', secondaryStId: '1483', defaultSsid: '1632' },
      { id: '1.4', name: '1.4 OP Walk-in ทุกที่', stId: '503', secondaryStId: '1465', defaultSsid: '504' },
      { id: '1.5', name: '1.5 ชดเชย On-Top', stId: '1202', secondaryStId: '1466', defaultSsid: '1203' },
    ],
  },
  {
    id: '2',
    title: '2. บริการผู้ป่วยใน (IP)',
    submenus: [
      { id: '2.1', name: '2.1 บริการผู้ป่วยใน (IP & AdjRW)', stId: '453', secondaryStId: '1467', defaultSsid: '455' },
      { id: '2.2', name: '2.2 ส่งข้อมูลผู้ป่วยใน / Error ติด C ติด Deny', stId: '1224', secondaryStId: '1225', defaultSsid: '2083' },
    ],
  },
  {
    id: '3',
    title: '3. บริการนอกเครือข่าย',
    submenus: [
      { id: '3.1', name: '3.1 ฉุกเฉินนอกเขต (OPAE)', stId: '1464', defaultSsid: '1507' },
      { id: '3.2', name: '3.2 OP-Refer นอกเขต', stId: '1482', defaultSsid: '1566' },
      { id: '3.3', name: '3.3 ค่าพาหนะส่งต่อนอกเขต', stId: '1631', secondaryStId: '1483', defaultSsid: '1632' },
    ],
  },
  {
    id: '4',
    title: '4. บริการค่าใช้จ่ายสูง (High Cost)',
    submenus: [
      { id: '4.1', name: '4.1 ยาละลายลิ่มเลือด (STEMI/Stroke)', stId: '1468' },
      { id: '4.2', name: '4.2 เคมีบำบัด มะเร็ง', stId: '1469' },
      { id: '4.3', name: '4.3 ผ่าตัดต้อกระจก (Cataract)', stId: '1470' },
      { id: '4.4', name: '4.4 อวัยวะเทียมและอุปกรณ์', stId: '1471' },
      { id: '4.5', name: '4.5 นิ่วในระบบทางเดินปัสสาวะ', stId: '1472' },
      { id: '4.6', name: '4.6 บริการประคับประคอง (Palliative Care)', stId: '1062', secondaryStId: '1484', defaultSsid: '1082' },
    ],
  },
  {
    id: '5',
    title: '5. ส่งเสริมป้องกันโรค (PP)',
    submenus: [
      { id: '5.1', name: '5.1 บริการหญิงตั้งครรภ์ (ANC)', stId: '742', secondaryStId: '1485', defaultSsid: '1047' },
      { id: '5.2', name: '5.2 ตรวจคัดกรองมะเร็ง (PAP & Fit test)', stId: '727', secondaryStId: '1522', defaultSsid: '728' },
      { id: '5.3', name: '5.3 ประเมินปัจจัยเสี่ยงสุขภาพ', stId: '1104', secondaryStId: '1523', defaultSsid: '1106' },
    ],
  },
  {
    id: '7',
    title: '7. นโยบายสำคัญ',
    submenus: [
      { id: '7.1', name: '7.1 Cancer Anywhere (มะเร็งรักษาทุกที่)', stId: '865', secondaryStId: '1524', defaultSsid: '870' },
      { id: '7.2', name: '7.2 Covid-19 (พึงรับชดเชย)', stId: '444', secondaryStId: '1503', defaultSsid: '445' },
      { id: '7.3', name: '7.3 เปลี่ยนสิทธิทันที', stId: '844', defaultSsid: '867' },
      { id: '7.4', name: '7.4 รักษาทุกที่ (Walk-in)', stId: '503', secondaryStId: '1465', defaultSsid: '504' },
      { id: '7.5', name: '7.5 การแพทย์ทางไกล (Telemedicine)', stId: '1164', secondaryStId: '1525', defaultSsid: '1162' },
      { id: '7.6', name: '7.6 บัตรประชาชนใบเดียวรักษาทุกที่ (ONE-ID)', stId: '2207', defaultSsid: '2283' },
    ],
  },
  {
    id: '8',
    title: '8. บริการเฉพาะ (DMIS)',
    submenus: [
      { id: '8.1', name: '8.1 โรคไตวายเรื้อรัง (CKD)', stId: '2183', defaultSsid: '2203' },
      { id: '8.2', name: '8.2 บริการ MOPH-Claim', stId: '2204', defaultSsid: '2205' },
      { id: '8.3', name: '8.3 Krungthai Platform (KTP)', stId: '2243', defaultSsid: '2263' },
    ],
  },
  {
    id: '9',
    title: '9. บริการสิทธิอื่น',
    submenus: [
      { id: '9.1', name: '9.1 สิทธิข้าราชการ (CSMBS)', stId: '1526', secondaryStId: '1527', defaultSsid: '1530' },
      { id: '9.2', name: '9.2 สิทธิ อปท. (LGO)', stId: '1504', secondaryStId: '1528', defaultSsid: '1531' },
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

  public static findSubmenuByStId(stId: string): MisHosSubmenu | undefined {
    for (const cat of MIS_HOS_MENU_CATEGORIES) {
      const found = cat.submenus.find(s => s.stId === stId || s.secondaryStId === stId)
      if (found) return found
    }
    return undefined
  }

  /**
   * Fetch and decode template configuration (cards, chart types, sub-reports)
   */
  public static async getTemplateConfig(
    stId: string,
    options?: {
      secondaryStId?: string
      year?: string
      hcode?: string
      subfund?: string
      fetchImpl?: typeof fetch
    }
  ): Promise<MisHosTemplateConfig | null> {
    const year = options?.year || calculateThaiFiscalYear()
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
      const text = await res.text()
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return null
      const json = JSON.parse(jsonMatch[0])
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

      // If High Cost clinical modules lack ST_CONFIG in SimpleStudio, provide custom subreports matching MIS HOS endpoints
      if (subReports.length === 0) {
        if (stId === '1468') {
          subReports = [
            { ssid: 'custom:m0401_stemi_year', report_name: 'บริการกรณี ยาละลายลิ่มเลือด (STEMI/Stroke) แยกรายปี', chart_type: 'bar', report_width: '6', flag_data: 'Y' },
            { ssid: 'custom:m0401_stemi_month', report_name: 'บริการกรณี ยาละลายลิ่มเลือด แยกรายเดือน', chart_type: 'table', report_width: '6', flag_data: 'Y' },
          ]
        } else if (stId === '1469') {
          subReports = [
            { ssid: 'custom:m0402_cancer_year', report_name: 'บริการเคมีบำบัด/รังสีรักษา โรคมะเร็ง แยกรายปี', chart_type: 'bar', report_width: '6', flag_data: 'Y' },
            { ssid: 'custom:m0402_cancer_month', report_name: 'บริการเคมีบำบัด/รังสีรักษา โรคมะเร็ง แยกรายเดือน', chart_type: 'table', report_width: '6', flag_data: 'Y' },
          ]
        } else if (stId === '1470') {
          subReports = [
            { ssid: 'custom:m0403_cataract_year', report_name: 'บริการผ่าตัดต้อกระจก (Cataract) แยกรายปี', chart_type: 'bar', report_width: '6', flag_data: 'Y' },
            { ssid: 'custom:m0403_cataract_month', report_name: 'บริการผ่าตัดต้อกระจก แยกรายเดือน', chart_type: 'table', report_width: '6', flag_data: 'Y' },
          ]
        } else if (stId === '1471') {
          subReports = [
            { ssid: 'custom:m0404_instrument_year', report_name: 'บริการชดเชยอวัยวะเทียมและอุปกรณ์บำบัดรักษาโรค แยกรายปี', chart_type: 'bar', report_width: '6', flag_data: 'Y' },
            { ssid: 'custom:m0404_instrument_month', report_name: 'บริการชดเชยอวัยวะเทียมและอุปกรณ์ แยกรายเดือน', chart_type: 'table', report_width: '6', flag_data: 'Y' },
          ]
        } else if (stId === '1472') {
          subReports = [
            { ssid: 'custom:m0405_stone_year', report_name: 'บริการสลายนิ่วในระบบทางเดินปัสสาวะ แยกรายปี', chart_type: 'bar', report_width: '6', flag_data: 'Y' },
            { ssid: 'custom:m0405_stone_month', report_name: 'บริการสลายนิ่วในระบบทางเดินปัสสาวะ แยกรายเดือน', chart_type: 'table', report_width: '6', flag_data: 'Y' },
          ]
        }
      }

      // If primary stId still has 0 subReports, fallback to secondaryStId (hospital-view template)
      const secondaryStId = options?.secondaryStId || this.findSubmenuByStId(stId)?.secondaryStId
      if (subReports.length === 0 && secondaryStId && secondaryStId !== stId) {
        const fallbackConfig = await this.getTemplateConfig(secondaryStId, {
          ...options,
          secondaryStId: undefined, // prevent infinite loop
        })
        if (fallbackConfig && fallbackConfig.subReports.length > 0) {
          const combinedResult: MisHosTemplateConfig = {
            stId,
            templateName: first.ST_TEMPLATENAME || fallbackConfig.templateName,
            subReports: fallbackConfig.subReports,
          }
          this.cache.set(cacheKey, { data: combinedResult, cachedAt: Date.now() })
          return combinedResult
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
   * Fetch chart metadata & table header definitions from simplestudio/ss_statement.php (chart_get)
   */
  public static async getChartConfig(
    ssid: string,
    options?: { fetchImpl?: typeof fetch }
  ): Promise<MisHosChartConfig | null> {
    if (ssid.startsWith('custom:')) {
      const customConfigs: Record<string, MisHosChartConfig> = {
        'custom:m0401_stemi_year': {
          ssid,
          reportName: 'บริการกรณี ยาละลายลิ่มเลือด (STEMI/Stroke) แยกรายปี',
          chartType: 'bar',
          yaxis: 'บาท',
          table_header: ['ปีงบประมาณ', 'ผู้ป่วย Stroke (ราย),0', 'ชดเชย Stroke (บาท),2', 'ผู้ป่วย STEMI (ราย),0', 'ชดเชย STEMI (บาท),2'],
        },
        'custom:m0401_stemi_month': {
          ssid,
          reportName: 'บริการกรณี ยาละลายลิ่มเลือด แยกรายเดือน',
          chartType: 'table',
          yaxis: 'บาท',
          table_header: ['เดือน', 'ผู้ป่วย Stroke (ราย),0', 'ชดเชย Stroke (บาท),2', 'ผู้ป่วย STEMI (ราย),0', 'ชดเชย STEMI (บาท),2'],
        },
        'custom:m0402_cancer_year': {
          ssid,
          reportName: 'บริการเคมีบำบัด/รังสีรักษา โรคมะเร็ง แยกรายปี',
          chartType: 'bar',
          yaxis: 'บาท',
          table_header: ['ปีงบประมาณ', 'ผู้ป่วย OP (ราย),0', 'ชดเชย OP (บาท),2', 'ผู้ป่วย IP (ราย),0', 'ชดเชย IP (บาท),2'],
        },
        'custom:m0402_cancer_month': {
          ssid,
          reportName: 'บริการเคมีบำบัด/รังสีรักษา โรคมะเร็ง แยกรายเดือน',
          chartType: 'table',
          yaxis: 'บาท',
          table_header: ['เดือน', 'ผู้ป่วย OP (ราย),0', 'ชดเชย OP (บาท),2', 'ผู้ป่วย IP (ราย),0', 'ชดเชย IP (บาท),2'],
        },
        'custom:m0403_cataract_year': {
          ssid,
          reportName: 'บริการผ่าตัดต้อกระจก (Cataract) แยกรายปี',
          chartType: 'bar',
          yaxis: 'บาท',
          table_header: ['ปีงบประมาณ', 'ผู้ป่วย (ราย),0', 'ชดเชย (บาท),2'],
        },
        'custom:m0403_cataract_month': {
          ssid,
          reportName: 'บริการผ่าตัดต้อกระจก แยกรายเดือน',
          chartType: 'table',
          yaxis: 'บาท',
          table_header: ['เดือน', 'ผู้ป่วย (ราย),0', 'ชดเชย (บาท),2'],
        },
        'custom:m0404_instrument_year': {
          ssid,
          reportName: 'บริการชดเชยอวัยวะเทียมและอุปกรณ์บำบัดรักษาโรค แยกรายปี',
          chartType: 'bar',
          yaxis: 'บาท',
          table_header: ['ปีงบประมาณ', 'ชดเชย OP (ครั้ง),0', 'ชดเชย OP (บาท),2', 'ชดเชย IP (ครั้ง),0', 'ชดเชย IP (บาท),2'],
        },
        'custom:m0404_instrument_month': {
          ssid,
          reportName: 'บริการชดเชยอวัยวะเทียมและอุปกรณ์ แยกรายเดือน',
          chartType: 'table',
          yaxis: 'บาท',
          table_header: ['เดือน', 'ชดเชย OP (ครั้ง),0', 'ชดเชย OP (บาท),2', 'ชดเชย IP (ครั้ง),0', 'ชดเชย IP (บาท),2'],
        },
        'custom:m0405_stone_year': {
          ssid,
          reportName: 'บริการสลายนิ่วในระบบทางเดินปัสสาวะ แยกรายปี',
          chartType: 'bar',
          yaxis: 'บาท',
          table_header: ['ปีงบประมาณ', 'ผู้ป่วย (ราย),0', 'ชดเชย (บาท),2'],
        },
        'custom:m0405_stone_month': {
          ssid,
          reportName: 'บริการสลายนิ่วในระบบทางเดินปัสสาวะ แยกรายเดือน',
          chartType: 'table',
          yaxis: 'บาท',
          table_header: ['เดือน', 'ผู้ป่วย (ราย),0', 'ชดเชย (บาท),2'],
        },
      }
      return customConfigs[ssid] || null
    }

    const fetchFn = options?.fetchImpl || fetch
    const cacheKey = `chart_cfg:${ssid}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS * 6) {
      return cached.data
    }

    try {
      const url = `${this.BASE_URL}${this.STATEMENT_ENDPOINT}`
      const res = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ss_id: ssid,
          api_type: 'chart_get',
        }),
        // @ts-expect-error Node fetch supports agent
        agent: this.httpsAgent,
      })

      if (!res.ok) return null
      const text = await res.text()
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return null
      const json = JSON.parse(jsonMatch[0])
      if (!Array.isArray(json) || json.length === 0) return null

      const first = json[0]
      let configObj: any = {}
      if (first.SS_CHART_CONFIG) {
        try {
          const decoded = Buffer.from(first.SS_CHART_CONFIG, 'base64').toString('utf8')
          configObj = JSON.parse(decoded)
        } catch {
          configObj = {}
        }
      }

      const result: MisHosChartConfig = {
        ssid,
        reportName: first.SS_REPORTNAME || '',
        chartType: first.CHART_TYPE || 'table',
        yaxis: configObj.yaxis || '',
        xaxis: configObj.xaxis || '',
        xaxisLabel: configObj.xaxisLabel || [],
        showvalue: Boolean(configObj.showvalue),
        table_header: Array.isArray(configObj.table_header) ? configObj.table_header : [],
        color: Array.isArray(configObj.color) ? configObj.color : [],
        digit: configObj.digit ?? '2',
        height: typeof configObj.height === 'number' ? configObj.height : 260,
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
    const year = options?.year || calculateThaiFiscalYear()
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
          records: cached.data.records,
          chartConfig: cached.data.chartConfig,
          source: 'cache',
          fetchedAt: new Date(cached.cachedAt).toISOString(),
        }
      }
    }

    try {
      // MIS HOS SQL statements filter on CE year (e.g. 2026 for FY 2569)
      const numYear = parseInt(year, 10)
      const isBe = !isNaN(numYear) && numYear > 2400
      const primaryYear = isBe ? String(numYear - 543) : year
      const fallbackYear = isBe ? year : String(numYear + 543)

      // Dedicated hospital endpoints for High Cost modules (4.x) bypassing SimpleStudio
      if (ssid.startsWith('custom:')) {
        const endpoint = ssid.replace('custom:', '')
        const customUrl = `${this.BASE_URL}${endpoint}.php`
        let records = await this.executeTableQuery(
          customUrl,
          { data1: hcode, year: primaryYear },
          fetchFn
        )

        if (records.length === 0) {
          records = await this.executeTableQuery(
            customUrl,
            { data1: hcode, year: fallbackYear },
            fetchFn
          )
        }

        const chartConfig = await this.getChartConfig(ssid, { fetchImpl: fetchFn })
        const dataToCache = { records, chartConfig }
        this.cache.set(cacheKey, { data: dataToCache, cachedAt: Date.now() })

        return {
          ssid,
          records,
          chartConfig,
          source: 'upstream',
          fetchedAt: new Date().toISOString(),
        }
      }

      const url = `${this.BASE_URL}${this.STATEMENT_ENDPOINT}`

      // Fetch chart configuration in parallel with data
      const chartConfigPromise = this.getChartConfig(ssid, { fetchImpl: fetchFn })

      let records = await this.executeTableQuery(url, {
        ssid,
        api_type: 'get_tabledata',
        hcode,
        province,
        year: primaryYear,
        subfund,
        province_name: provinceName,
      }, fetchFn)

      // Fallback if primary returned empty
      if (records.length === 0) {
        const fallbackRecords = await this.executeTableQuery(url, {
          ssid,
          api_type: 'get_tabledata',
          hcode,
          province,
          year: fallbackYear,
          subfund,
          province_name: provinceName,
        }, fetchFn)
        if (fallbackRecords.length > 0) {
          records = fallbackRecords
        }
      }

      const chartConfig = await chartConfigPromise
      const dataToCache = { records, chartConfig }
      this.cache.set(cacheKey, { data: dataToCache, cachedAt: Date.now() })

      return {
        ssid,
        records,
        chartConfig,
        source: 'upstream',
        fetchedAt: new Date().toISOString(),
      }
    } catch {
      return {
        ssid,
        records: [],
        chartConfig: null,
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
      // Extract JSON array even if PHP/OCI warnings or HTML headers prepend the output
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        try {
          const json = JSON.parse(jsonMatch[0])
          return Array.isArray(json) ? json : []
        } catch {
          return []
        }
      }
      return []
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
      const text = await res.text()
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return null
      const json = JSON.parse(jsonMatch[0])
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
