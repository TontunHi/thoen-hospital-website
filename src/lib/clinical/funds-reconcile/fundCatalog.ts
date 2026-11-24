import { SEAMLESS_FUND_MAP } from '../seamless-import/typesAndParsers'
import type { FundDefinition } from './types'

/**
 * Canonical registry of all /service/dashboard-rcm/funds/* modules
 * mapped to Seamless REP prefixes, REP Fund/SubFund keywords, HOSxP ADP codes,
 * and ICD-10 diagnosis rules.
 *
 * Priority order (lower number = higher priority when resolving primaryFundId)
 * ensures specific high-cost/special funds win over broad screening/general funds.
 */
export const RCM_FUND_CATALOG: readonly FundDefinition[] = [
  {
    id: 'streptokinase',
    code: 'STK',
    label: 'กองทุนยา Streptokinase (Stroke / STEMI)',
    shortLabel: 'Streptokinase',
    category: 'disease_drug',
    href: '/service/dashboard-rcm/funds/streptokinase/recipients',
    priority: 10,
    seamlessPrefixes: [],
    repFundKeywords: ['STREPTOKINASE', 'STEMI'],
    adpCodes: [],
    adpPrefixes: ['STEMI'],
    icd10Prefixes: [],
    description: 'ยาละลายลิ่มเลือด Streptokinase ในผู้ป่วย Stroke และ STEMI',
  },
  {
    id: 'clopidogrel',
    code: 'CLOP',
    label: 'กองทุนยา Clopidogrel',
    shortLabel: 'Clopidogrel',
    category: 'disease_drug',
    href: '/service/dashboard-rcm/funds/clopidogrel/usage',
    priority: 20,
    seamlessPrefixes: [],
    repFundKeywords: ['CLOPIDOGREL'],
    adpCodes: ['37999771001', '3799977101'],
    adpPrefixes: ['379997710'],
    icd10Prefixes: [],
    description: 'รายการใช้ยาต้านเกล็ดเลือด Clopidogrel ตามเกณฑ์ สปสช.',
  },
  {
    id: 'dental-implant',
    code: 'DENT',
    label: 'กองทุนรากฟันเทียม (DENSUR)',
    shortLabel: 'รากฟันเทียม',
    category: 'rehab_special',
    href: '/service/dashboard-rcm/funds/dental-implant/densur',
    priority: 30,
    seamlessPrefixes: ['DDEN'],
    repFundKeywords: ['DENSUR', 'DDEN', 'รากฟันเทียม', 'ฟันเทียม'],
    adpCodes: ['DENSUR'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'ผ่าตัดใส่รากฟันเทียม DENSUR และโครงการฟันเทียม (DDEN)',
  },
  {
    id: 'cancer',
    code: 'CA',
    label: 'กองทุนมะเร็ง (CANCER ADP)',
    shortLabel: 'กองทุนมะเร็ง',
    category: 'disease_drug',
    href: '/service/dashboard-rcm/funds/cancer/adp',
    priority: 40,
    seamlessPrefixes: [],
    repFundKeywords: ['CANCER'],
    adpCodes: ['CANCER'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'ผู้ป่วยกองทุนมะเร็งจากรหัส ADP CANCER',
  },
  {
    id: 'thalassemia-fund',
    code: 'THAL-F',
    label: 'กองทุน Thalassemia (OPD/IPD)',
    shortLabel: 'กองทุน Thalassemia',
    category: 'disease_drug',
    href: '/service/dashboard-rcm/funds/thalassemia-fund/opd',
    priority: 50,
    seamlessPrefixes: ['DTDT'],
    repFundKeywords: ['DTDT', 'THALASSEMIA', 'ธาลัสซีเมียชนิดรุนแรง'],
    adpCodes: [],
    adpPrefixes: ['232'],
    icd10Prefixes: [],
    description: 'กองทุนโรคโลหิตจางธาลัสซีเมีย (ADP 232* / DTDT)',
  },
  {
    id: 'instrument',
    code: 'INST',
    label: 'กองทุนอวัยวะเทียมและอุปกรณ์',
    shortLabel: 'อวัยวะเทียม/อุปกรณ์',
    category: 'rehab_special',
    href: '/service/dashboard-rcm/funds/instrument',
    priority: 60,
    seamlessPrefixes: [],
    repFundKeywords: ['INST', 'CATINST', 'อวัยวะเทียม'],
    adpCodes: [],
    adpPrefixes: ['7004', '7005', '8612', '8813', '8814'],
    icd10Prefixes: [],
    description: 'อุปกรณ์และอวัยวะเทียม (nhso_adp_type_id = 2)',
  },
  {
    id: 'rehabilitation',
    code: '11.47',
    label: 'กองทุนฟื้นฟูสมรรถภาพ / IMC / Disability',
    shortLabel: 'ฟื้นฟูสมรรถภาพ/IMC',
    category: 'rehab_special',
    href: '/service/dashboard-rcm/funds/rehabilitation/services/disability-services',
    priority: 70,
    seamlessPrefixes: ['DDSA'],
    repFundKeywords: ['DDSA', 'ฟื้นฟูสมรรถภาพ', 'DISABILITY', 'IMC'],
    adpCodes: [
      'H9449.1',
      'H0489',
      'H9339',
      'H9375.1',
      'H9375.2',
      'H9378.1',
      'H9378.2',
      'H9378.3',
      'H9383.1',
      'H9383.2',
      'H9433.1',
      'H9433.2',
      'H9438.1',
      'H9438.2',
      'H9449.2',
      'H9549',
    ],
    adpPrefixes: ['H9', 'H0489'],
    icd10Prefixes: [],
    description: 'บริการฟื้นฟูสมรรถภาพคนพิการและผู้ป่วย IMC (DDSA / ADP H9*)',
  },
  {
    id: 'amed-homeward',
    code: 'AMED',
    label: 'ระบบ AMed และ Home Ward',
    shortLabel: 'AMed / Home Ward',
    category: 'rehab_special',
    href: '/service/dashboard-rcm/funds/amed-homeward/homeward',
    priority: 80,
    seamlessPrefixes: ['DAMD'],
    repFundKeywords: ['DAMD', 'HOMEWARD', 'AMED'],
    adpCodes: ['HOMEWARD'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'บริการ Home Ward และระบบ AMed (DAMD)',
  },
  {
    id: 'thai-traditional-medicine',
    code: 'TTM',
    label: 'บริการแพทย์แผนไทยและการแพทย์ทางเลือก',
    shortLabel: 'แพทย์แผนไทย (TTM)',
    category: 'rehab_special',
    href: '/service/dashboard-rcm/funds/thai-traditional-medicine/3',
    priority: 90,
    seamlessPrefixes: ['DTTM'],
    repFundKeywords: ['DTTM', 'แพทย์แผนไทย', 'สมุนไพร'],
    adpCodes: [],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'บริการแพทย์แผนไทยและยาสมุนไพร (DTTM)',
  },
  {
    id: 'telemed-drug',
    code: '11',
    label: 'ระบบ Telemedicine & ยาไปรษณีย์',
    shortLabel: 'Telemed & Drug',
    category: 'rehab_special',
    href: '/service/dashboard-rcm/funds/telemed-drug/telemed',
    priority: 100,
    seamlessPrefixes: ['DAME', 'DPRX'],
    repFundKeywords: ['DAME', 'DPRX', 'TELMED', 'TELEMED', 'DRUGP', 'การแพทย์ทางไกล', 'ไปรษณีย์'],
    adpCodes: ['TELMED', 'DRUGP'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'บริการการแพทย์ทางไกล TELMED และส่งยาไปรษณีย์ DRUGP',
  },
  {
    id: 'ccs',
    code: 'CCS',
    label: 'คัดกรองมะเร็งปากมดลูก (CCS)',
    shortLabel: 'มะเร็งปากมดลูก',
    category: 'pp',
    href: '/service/dashboard-rcm/funds/ccs/2',
    priority: 110,
    seamlessPrefixes: ['DCCS'],
    repFundKeywords: ['DCCS', 'มะเร็งปากมดลูก', '1B005', '1B004'],
    adpCodes: [
      '1B005',
      '1B004N',
      '1B004P',
      '1B004_0N',
      '1B004_0P',
      '1B0046_0',
      '1B0046_01',
      '1B0046_1',
      '1B0046_11',
      '1B0046_2',
      '1B0046_21',
    ],
    adpPrefixes: ['1B004', '1B005'],
    icd10Prefixes: ['Z124'],
    description: 'คัดกรองมะเร็งปากมดลูก Pap Smear / HPV DNA (DCCS / 1B004-5)',
  },
  {
    id: 'colorectal-cancer',
    code: '21',
    label: 'คัดกรองมะเร็งลำไส้ใหญ่ (Fit test)',
    shortLabel: 'มะเร็งลำไส้ใหญ่',
    category: 'pp',
    href: '/service/dashboard-rcm/funds/colorectal-cancer/21-2',
    priority: 120,
    seamlessPrefixes: ['DCAC'],
    repFundKeywords: ['DCAC', 'มะเร็งลำไส้ใหญ่', '90005'],
    adpCodes: ['90005'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'ตรวจคัดกรองมะเร็งลำไส้ใหญ่ Fit test (DCAC / ADP 90005)',
  },
  {
    id: 'viral-hepatitis',
    code: '23',
    label: 'ตรวจคัดกรองไวรัสตับอักเสบ (B & C)',
    shortLabel: 'ไวรัสตับอักเสบ B&C',
    category: 'pp',
    href: '/service/dashboard-rcm/funds/viral-hepatitis/23-1',
    priority: 130,
    seamlessPrefixes: [],
    repFundKeywords: ['ไวรัสตับอักเสบ', '36318', '36319', '36331', '36333'],
    adpCodes: ['36318', '36319', '36331', '36333'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'คัดกรองไวรัสตับอักเสบ B (36318-9) และ C / HCV RNA (36331, 36333)',
  },
  {
    id: 'thalassemia',
    code: 'THAL',
    label: 'คัดกรองธาลัสซีเมียในหญิงตั้งครรภ์',
    shortLabel: 'ธาลัสซีเมีย (ตั้งครรภ์)',
    category: 'pp',
    href: '/service/dashboard-rcm/funds/thalassemia/1',
    priority: 140,
    seamlessPrefixes: ['DTLM'],
    repFundKeywords: ['DTLM', '30313', '37532'],
    adpCodes: ['30313', '37532'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'คัดกรองธาลัสซีเมียหญิงตั้งครรภ์ (DTLM / ADP 30313, 37532)',
  },
  {
    id: 'anc',
    code: 'ANC',
    label: 'บริการฝากครรภ์ (ANC / 30011)',
    shortLabel: 'บริการฝากครรภ์',
    category: 'pp',
    href: '/service/dashboard-rcm/funds/anc/4',
    priority: 150,
    seamlessPrefixes: ['DANC'],
    repFundKeywords: ['DANC', 'ฝากครรภ์', '30011'],
    adpCodes: ['30011'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'บริการฝากครรภ์ US / ตรวจช่องปาก / ขัดฟัน (DANC / ADP 30011)',
  },
  {
    id: 'postpartum',
    code: 'PNC',
    label: 'การตรวจหลังคลอด & ยา Triforine',
    shortLabel: 'ตรวจหลังคลอด',
    category: 'pp',
    href: '/service/dashboard-rcm/funds/postpartum/2',
    priority: 160,
    seamlessPrefixes: [],
    repFundKeywords: ['หลังคลอด', '30015', '30016'],
    adpCodes: ['30015', '30016'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'บริการตรวจหลังคลอด ADP 30015 และ Triforine ADP 30016',
  },
  {
    id: 'family-planning',
    code: 'FP',
    label: 'วางแผนครอบครัว & คุมกำเนิด',
    shortLabel: 'วางแผนครอบครัว',
    category: 'pp',
    href: '/service/dashboard-rcm/funds/family-planning/1',
    priority: 170,
    seamlessPrefixes: [],
    repFundKeywords: ['FP001', 'FP002', 'FP003', 'วางแผนครอบครัว', 'คุมกำเนิด'],
    adpCodes: [
      'FP001',
      'FP002',
      'FP002_1',
      'FP002_2',
      'FP003_1',
      'FP003_2',
      'FP003_3',
      'FP003_4',
      '20001',
      '20002',
      '20003',
      '20004',
      '71681',
      '71682',
      '71691',
    ],
    adpPrefixes: ['FP00'],
    icd10Prefixes: [],
    description: 'ยาคุมกำเนิด ฝัง/ถอดยาคุม ห่วงอนามัย คุมกำเนิดกึ่งถาวร',
  },
  {
    id: 'pregnancy-test',
    code: '8.1',
    label: 'การทดสอบการตั้งครรภ์',
    shortLabel: 'ทดสอบตั้งครรภ์',
    category: 'pp',
    href: '/service/dashboard-rcm/funds/pregnancy-test/1',
    priority: 180,
    seamlessPrefixes: [],
    repFundKeywords: ['31101', '30014', 'ทดสอบการตั้งครรภ์'],
    adpCodes: ['31101', '30014'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'บริการตรวจทดสอบการตั้งครรภ์ ADP 31101 / 30014',
  },
  {
    id: 'oral-cancer',
    code: '12',
    label: 'คัดกรองมะเร็งช่องปาก (40 ปี+)',
    shortLabel: 'มะเร็งช่องปาก',
    category: 'pp',
    href: '/service/dashboard-rcm/funds/oral-cancer/1',
    priority: 190,
    seamlessPrefixes: [],
    repFundKeywords: ['90004', 'มะเร็งช่องปาก'],
    adpCodes: ['90004'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'คัดกรองรอยโรคมะเร็งช่องปาก ADP 90004',
  },
  {
    id: 'health-screening',
    code: '14',
    label: 'คัดกรองสุขภาพกาย/จิต (FPG / Cholesterol)',
    shortLabel: 'คัดกรองสุขภาพ (14)',
    category: 'pp',
    href: '/service/dashboard-rcm/funds/health-screening/14-5',
    priority: 200,
    seamlessPrefixes: [],
    repFundKeywords: ['12003', '12004'],
    adpCodes: ['12003', '12004'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'ตรวจคัดกรอง FPG (12003) และ Cholesterol/HDL (12004)',
  },
  {
    id: 'anemia-screening',
    code: '17',
    label: 'คัดกรองโลหิตจาง (13-24 ปี)',
    shortLabel: 'คัดกรองโลหิตจาง',
    category: 'pp',
    href: '/service/dashboard-rcm/funds/anemia-screening/17-1',
    priority: 210,
    seamlessPrefixes: [],
    repFundKeywords: ['13001', 'โลหิตจาง'],
    adpCodes: ['13001'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'บริการคัดกรองโลหิตจางจากการขาดธาตุเหล็ก ADP 13001',
  },
  {
    id: 'iron-supplements',
    code: '18',
    label: 'บริการยาเม็ดเสริมธาตุเหล็ก (13-45 ปี)',
    shortLabel: 'เสริมธาตุเหล็ก',
    category: 'pp',
    href: '/service/dashboard-rcm/funds/iron-supplements/18-2',
    priority: 220,
    seamlessPrefixes: [],
    repFundKeywords: ['14001', 'เสริมธาตุเหล็ก'],
    adpCodes: ['14001'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'บริการจ่ายยาเม็ดเสริมธาตุเหล็ก ADP 14001',
  },
  {
    id: 'fluoride-varnish',
    code: '20',
    label: 'บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง)',
    shortLabel: 'เคลือบฟลูออไรด์',
    category: 'pp',
    href: '/service/dashboard-rcm/funds/fluoride-varnish/20-1',
    priority: 230,
    seamlessPrefixes: [],
    repFundKeywords: ['15001', 'ฟลูออไรด์'],
    adpCodes: ['15001'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'บริการเคลือบฟลูออไรด์กลุ่มเสี่ยง ADP 15001',
  },
  {
    id: 't1dm-gdm-pdm',
    code: 'DM',
    label: 'กองทุนเบาหวาน T1DM / GDM / PDM',
    shortLabel: 'T1DM / GDM / PDM',
    category: 'disease_drug',
    href: '/service/dashboard-rcm/funds/t1dm-gdm-pdm/2',
    priority: 240,
    seamlessPrefixes: [],
    repFundKeywords: ['T1DM', 'GDM', 'PDM'],
    adpCodes: [],
    adpPrefixes: [],
    icd10Prefixes: ['O24', 'E10'],
    description: 'ผู้ป่วยเบาหวานชนิดที่ 1 และเบาหวานขณะตั้งครรภ์ (ICD-10 O24*, E10*)',
  },
  {
    id: 'walkin',
    code: 'WALK',
    label: 'กองทุน Walkin (ADP WALKIN)',
    shortLabel: 'กองทุน Walkin',
    category: 'rehab_special',
    href: '/service/dashboard-rcm/funds/walkin/adp',
    priority: 250,
    seamlessPrefixes: [],
    repFundKeywords: ['WALKIN'],
    adpCodes: ['WALKIN'],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'ผู้รับบริการนอกเขตรับผิดชอบ Walkin ADP',
  },
  {
    id: 'general',
    code: 'GEN',
    label: 'กองทุนทั่วไป / สิทธิหลักอื่น (UCS/OFC/SSS/LGO/Seamless อื่น)',
    shortLabel: 'กองทุนทั่วไป/อื่นๆ',
    category: 'general',
    href: '/service/dashboard-rcm/rep-funds',
    priority: 999,
    seamlessPrefixes: [],
    repFundKeywords: ['UCS', 'OFC', 'SSS', 'LGO', 'STP', 'OP', 'IP'],
    adpCodes: [],
    adpPrefixes: [],
    icd10Prefixes: [],
    description: 'รายการ REP ที่ไม่เข้าเกณฑ์กองทุนเฉพาะ 25 ข้อ (เช่น UCS/OFC/SSS/LGO ทั่วไป)',
  },
]

const FUND_BY_ID = new Map(RCM_FUND_CATALOG.map((f) => [f.id, f]))

export function getFundDefinition(fundId: string): FundDefinition {
  return FUND_BY_ID.get(fundId) || RCM_FUND_CATALOG[RCM_FUND_CATALOG.length - 1]
}

export function extractRepPrefixCode(rep?: string | null): string | null {
  const clean = String(rep || '')
    .trim()
    .toUpperCase()
  const match = clean.match(/^([A-Z]{2,8})\d/)
  return match ? match[1] : null
}

export function formatRepTypeLabel(prefix: string | null, repFund?: string | null): string {
  if (prefix && SEAMLESS_FUND_MAP[prefix]) {
    return `${prefix} · ${SEAMLESS_FUND_MAP[prefix]}`
  }
  if (prefix) {
    return repFund ? `${prefix} · ${repFund}` : prefix
  }
  return repFund || 'ทั่วไป (e-Claim)'
}

export interface FundClassificationInput {
  rep?: string | null
  repPrefix?: string | null
  repFund?: string | null
  repSubFund?: string | null
  projectCode?: string | null
  adpCodes?: readonly string[]
  hasInstType2?: boolean
  icd10Codes?: readonly string[]
  exportCode?: string | null
}

export interface FundClassificationResult {
  primaryFundId: string
  matchedFundIds: string[]
  matchReason: string
}

/**
 * Classifies a statement line into all matching /funds/* modules
 * and picks a deterministic primaryFundId (Q11 = A: Primary Fund Priority).
 *
 * Precedence:
 * 1. Explicit REP / Seamless Prefix or Fund Keyword match (so Seamless DCCS/DANC/DTTM/DDSA always stays in its own fund)
 * 2. Clinical HOSxP ADP / Type2 Instrument / Telemed export_code='5' / ICD-10 match sorted by fund priority
 * 3. Fallback to 'general'
 */
export function classifyStatementFund(input: FundClassificationInput): FundClassificationResult {
  const repPrefix = (input.repPrefix || extractRepPrefixCode(input.rep) || '').toUpperCase()
  const repTagText = [input.repFund, input.repSubFund, input.projectCode]
    .filter(Boolean)
    .join(' ')
    .toUpperCase()

  const adpUpper = (input.adpCodes || []).map((c) => c.trim().toUpperCase()).filter(Boolean)
  const icdUpper = (input.icd10Codes || []).map((c) => c.trim().toUpperCase()).filter(Boolean)

  const explicitMatches: Array<{ fund: FundDefinition; reason: string }> = []
  const clinicalMatches: Array<{ fund: FundDefinition; reason: string }> = []

  for (const fund of RCM_FUND_CATALOG) {
    if (fund.id === 'general') continue

    // 1. Check REP Prefix & Fund Keywords
    if (repPrefix && fund.seamlessPrefixes.includes(repPrefix)) {
      explicitMatches.push({ fund, reason: `REP Prefix ${repPrefix}` })
      continue
    }

    const matchedKeyword = fund.repFundKeywords.find((kw) => repTagText.includes(kw.toUpperCase()))
    if (matchedKeyword) {
      explicitMatches.push({ fund, reason: `REP Fund (${matchedKeyword})` })
      continue
    }

    // 2. Check HOSxP clinical rules (ADP codes, prefixes, Instrument type 2, export_code='5', ICD-10)
    const exactAdp = adpUpper.find((code) =>
      fund.adpCodes.some((target) => target.toUpperCase() === code)
    )
    if (exactAdp) {
      clinicalMatches.push({ fund, reason: `ADP ${exactAdp}` })
      continue
    }

    const prefixAdp = adpUpper.find((code) =>
      fund.adpPrefixes.some((pfx) => code.startsWith(pfx.toUpperCase()))
    )
    if (prefixAdp) {
      clinicalMatches.push({ fund, reason: `ADP ${prefixAdp}` })
      continue
    }

    if (fund.id === 'instrument' && input.hasInstType2) {
      clinicalMatches.push({ fund, reason: 'อุปกรณ์/อวัยวะเทียม (ADP Type 2)' })
      continue
    }

    if (fund.id === 'telemed-drug' && String(input.exportCode || '').trim() === '5') {
      clinicalMatches.push({ fund, reason: 'Telemed (export_code=5)' })
      continue
    }

    const matchedIcd = icdUpper.find((dx) =>
      fund.icd10Prefixes.some((pfx) => dx.startsWith(pfx.toUpperCase()))
    )
    if (matchedIcd) {
      clinicalMatches.push({ fund, reason: `ICD-10 ${matchedIcd}` })
      continue
    }
  }

  explicitMatches.sort((a, b) => a.fund.priority - b.fund.priority)
  clinicalMatches.sort((a, b) => a.fund.priority - b.fund.priority)

  const combined = [...explicitMatches, ...clinicalMatches]
  if (combined.length === 0) {
    return {
      primaryFundId: 'general',
      matchedFundIds: ['general'],
      matchReason: input.repFund ? `กองทุนทั่วไป (${input.repFund})` : 'กองทุนทั่วไป/อื่นๆ',
    }
  }

  const uniqueFundIds = Array.from(new Set(combined.map((m) => m.fund.id)))
  return {
    primaryFundId: combined[0].fund.id,
    matchedFundIds: uniqueFundIds,
    matchReason: combined[0].reason,
  }
}
