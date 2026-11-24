// Thoen Hospital API Gateway Plugin: Unified Funds REP Reconciliation
// Level-1 Optimized SQL across active sources: rcmdb.repdata, rcmdb.repeclaim, rcmdb.seamless

const SEAMLESS_FUND_MAP = {
  DAMD: 'ระบบบริการทางการแพทย์ AMED',
  DAME: 'ระบบบริการทางการแพทย์ทางไกล',
  DANC: 'ระบบบริการฝากครรภ์',
  DATK: 'โครงการแจกชุดตรวจโควิด-19',
  DBMT: 'โครงการปลูกถ่ายไขกระดูก',
  DCAC: 'ระบบบริการตรวจคัดกรองและตรวจยืนยันมะเร็งลำไส้ใหญ่',
  DCCS: 'ระบบบริการตรวจคัดกรองมะเร็งปากมดลูก',
  DCKD: 'ระบบสารสนเทศเพื่อการให้บริการผู้ป่วยไตวายเรื้อรังระยะสุดท้าย',
  DCMH: 'ระบบบริการดูแลผู้ป่วยจิตเวชเรื้อรังในชุมชน',
  DCNB: 'ระบบการจ่ายค่าใช้จ่ายบริการสาธารณสุข กรณีการใช้ยาน้ำมันกัญชา',
  DDEN: 'โครงการฟันเทียมพระราชทาน',
  DDOW: 'ระบบบูรณาการการคัดกรองความผิดปกติของหญิงตั้งครรภ์และทารกแรกเกิด (กลุ่มอาการดาวน์)',
  DDSA: 'ระบบสารสนเทศการให้บริการฟื้นฟูสมรรถภาพ',
  DHEM: 'ระบบบริหารโรคเลือดออกง่ายฮีโมฟีเลีย',
  DHTD: 'ระบบผ่าตัดเปลี่ยนหัวใจในเด็ก',
  DINS: 'โครงการบัตรประชาชนใบเดียวสำหรับหน่วยนวัตกรรม',
  DKTP: 'Krungthai Digital Health Platform',
  DLTC: 'ระบบผู้สูงอายุและผู้มีภาวะพึ่งพิง',
  DLTD: 'ระบบผ่าตัดเปลี่ยนตับในเด็ก',
  DMOP: 'ระบบหมอพร้อม',
  DMOR: 'ระบบหมอพร้อม',
  DMTB: 'ระบบบริหารจัดการโรคเฉพาะ(วัณโรค)',
  DMXD: 'ระบบทันตกรรมจัดฟันและบริการแก้ไขการพูดและการได้ยิน (Cleft Lip and Cleft Palate)',
  DNAP: 'ระบบสารสนเทศการให้บริการผู้ติดเชื้อเอชไอวี ผู้ป่วยเอดส์ แห่งชาติ (NAP)',
  DPHS: 'ระบบบริการสร้างเสริมสุขภาพและป้องกันโรคที่บ้านและชุมชน',
  DPRX: 'ระบบข้อมูลการจ่ายยาตามใบสั่งแพทย์',
  DTDT: 'ระบบบริการผู้ป่วยโรคโลหิตจางธาลัสซีเมียชนิดรุนแรง',
  DTLM: 'ระบบบูรณาการการคัดกรองความผิดปกติของหญิงตั้งครรภ์และทารกแรกเกิด (โรคโลหิตจางธาลัสซีเมีย)',
  DTSH: 'ระบบบริการไทรอยด์สำหรับเด็กแรกเกิด',
  DTTM: 'ระบบบริการการแพทย์แผนไทย',
}

const RCM_FUND_CATALOG = [
  {
    id: 'streptokinase', code: 'STK', label: 'กองทุนยา Streptokinase (Stroke / STEMI)', shortLabel: 'Streptokinase',
    category: 'disease_drug', href: '/service/dashboard-rcm/funds/streptokinase/recipients', priority: 10,
    seamlessPrefixes: [], repFundKeywords: ['STREPTOKINASE', 'STEMI'], adpCodes: [], adpPrefixes: ['STEMI'], icd10Prefixes: [],
  },
  {
    id: 'clopidogrel', code: 'CLOP', label: 'กองทุนยา Clopidogrel', shortLabel: 'Clopidogrel',
    category: 'disease_drug', href: '/service/dashboard-rcm/funds/clopidogrel/usage', priority: 20,
    seamlessPrefixes: [], repFundKeywords: ['CLOPIDOGREL'], adpCodes: ['37999771001', '3799977101'], adpPrefixes: ['379997710'], icd10Prefixes: [],
  },
  {
    id: 'dental-implant', code: 'DENT', label: 'กองทุนรากฟันเทียม (DENSUR)', shortLabel: 'รากฟันเทียม',
    category: 'rehab_special', href: '/service/dashboard-rcm/funds/dental-implant/densur', priority: 30,
    seamlessPrefixes: ['DDEN'], repFundKeywords: ['DENSUR', 'DDEN', 'รากฟันเทียม', 'ฟันเทียม'], adpCodes: ['DENSUR'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'cancer', code: 'CA', label: 'กองทุนมะเร็ง (CANCER ADP)', shortLabel: 'กองทุนมะเร็ง',
    category: 'disease_drug', href: '/service/dashboard-rcm/funds/cancer/adp', priority: 40,
    seamlessPrefixes: [], repFundKeywords: ['CANCER'], adpCodes: ['CANCER'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'thalassemia-fund', code: 'THAL-F', label: 'กองทุน Thalassemia (OPD/IPD)', shortLabel: 'กองทุน Thalassemia',
    category: 'disease_drug', href: '/service/dashboard-rcm/funds/thalassemia-fund/opd', priority: 50,
    seamlessPrefixes: ['DTDT'], repFundKeywords: ['DTDT', 'THALASSEMIA', 'ธาลัสซีเมียชนิดรุนแรง'], adpCodes: [], adpPrefixes: ['232'], icd10Prefixes: [],
  },
  {
    id: 'instrument', code: 'INST', label: 'กองทุนอวัยวะเทียมและอุปกรณ์', shortLabel: 'อวัยวะเทียม/อุปกรณ์',
    category: 'rehab_special', href: '/service/dashboard-rcm/funds/instrument', priority: 60,
    seamlessPrefixes: [], repFundKeywords: ['INST', 'CATINST', 'อวัยวะเทียม'], adpCodes: [], adpPrefixes: ['7004', '7005', '8612', '8813', '8814'], icd10Prefixes: [],
  },
  {
    id: 'rehabilitation', code: '11.47', label: 'กองทุนฟื้นฟูสมรรถภาพ / IMC / Disability', shortLabel: 'ฟื้นฟูสมรรถภาพ/IMC',
    category: 'rehab_special', href: '/service/dashboard-rcm/funds/rehabilitation/services/disability-services', priority: 70,
    seamlessPrefixes: ['DDSA'], repFundKeywords: ['DDSA', 'ฟื้นฟูสมรรถภาพ', 'DISABILITY', 'IMC'],
    adpCodes: ['H9449.1','H0489','H9339','H9375.1','H9375.2','H9378.1','H9378.2','H9378.3','H9383.1','H9383.2','H9433.1','H9433.2','H9438.1','H9438.2','H9449.2','H9549'],
    adpPrefixes: ['H9', 'H0489'], icd10Prefixes: [],
  },
  {
    id: 'amed-homeward', code: 'AMED', label: 'ระบบ AMed และ Home Ward', shortLabel: 'AMed / Home Ward',
    category: 'rehab_special', href: '/service/dashboard-rcm/funds/amed-homeward/homeward', priority: 80,
    seamlessPrefixes: ['DAMD'], repFundKeywords: ['DAMD', 'HOMEWARD', 'AMED'], adpCodes: ['HOMEWARD'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'thai-traditional-medicine', code: 'TTM', label: 'บริการแพทย์แผนไทยและการแพทย์ทางเลือก', shortLabel: 'แพทย์แผนไทย (TTM)',
    category: 'rehab_special', href: '/service/dashboard-rcm/funds/thai-traditional-medicine/3', priority: 90,
    seamlessPrefixes: ['DTTM'], repFundKeywords: ['DTTM', 'แพทย์แผนไทย', 'สมุนไพร'], adpCodes: [], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'telemed-drug', code: '11', label: 'ระบบ Telemedicine & ยาไปรษณีย์', shortLabel: 'Telemed & Drug',
    category: 'rehab_special', href: '/service/dashboard-rcm/funds/telemed-drug/telemed', priority: 100,
    seamlessPrefixes: ['DAME', 'DPRX'], repFundKeywords: ['DAME', 'DPRX', 'TELMED', 'TELEMED', 'DRUGP', 'การแพทย์ทางไกล', 'ไปรษณีย์'],
    adpCodes: ['TELMED', 'DRUGP'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'ccs', code: 'CCS', label: 'คัดกรองมะเร็งปากมดลูก (CCS)', shortLabel: 'มะเร็งปากมดลูก',
    category: 'pp', href: '/service/dashboard-rcm/funds/ccs/2', priority: 110,
    seamlessPrefixes: ['DCCS'], repFundKeywords: ['DCCS', 'มะเร็งปากมดลูก', '1B005', '1B004'],
    adpCodes: ['1B005','1B004N','1B004P','1B004_0N','1B004_0P','1B0046_0','1B0046_01','1B0046_1','1B0046_11','1B0046_2','1B0046_21'],
    adpPrefixes: ['1B004', '1B005'], icd10Prefixes: ['Z124'],
  },
  {
    id: 'colorectal-cancer', code: '21', label: 'คัดกรองมะเร็งลำไส้ใหญ่ (Fit test)', shortLabel: 'มะเร็งลำไส้ใหญ่',
    category: 'pp', href: '/service/dashboard-rcm/funds/colorectal-cancer/21-2', priority: 120,
    seamlessPrefixes: ['DCAC'], repFundKeywords: ['DCAC', 'มะเร็งลำไส้ใหญ่', '90005'], adpCodes: ['90005'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'viral-hepatitis', code: '23', label: 'ตรวจคัดกรองไวรัสตับอักเสบ (B & C)', shortLabel: 'ไวรัสตับอักเสบ B&C',
    category: 'pp', href: '/service/dashboard-rcm/funds/viral-hepatitis/23-1', priority: 130,
    seamlessPrefixes: [], repFundKeywords: ['ไวรัสตับอักเสบ', '36318', '36319', '36331', '36333'],
    adpCodes: ['36318', '36319', '36331', '36333'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'thalassemia', code: 'THAL', label: 'คัดกรองธาลัสซีเมียในหญิงตั้งครรภ์', shortLabel: 'ธาลัสซีเมีย (ตั้งครรภ์)',
    category: 'pp', href: '/service/dashboard-rcm/funds/thalassemia/1', priority: 140,
    seamlessPrefixes: ['DTLM'], repFundKeywords: ['DTLM', '30313', '37532'], adpCodes: ['30313', '37532'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'anc', code: 'ANC', label: 'บริการฝากครรภ์ (ANC / 30011)', shortLabel: 'บริการฝากครรภ์',
    category: 'pp', href: '/service/dashboard-rcm/funds/anc/4', priority: 150,
    seamlessPrefixes: ['DANC'], repFundKeywords: ['DANC', 'ฝากครรภ์', '30011'], adpCodes: ['30011'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'postpartum', code: 'PNC', label: 'การตรวจหลังคลอด & ยา Triforine', shortLabel: 'ตรวจหลังคลอด',
    category: 'pp', href: '/service/dashboard-rcm/funds/postpartum/2', priority: 160,
    seamlessPrefixes: [], repFundKeywords: ['หลังคลอด', '30015', '30016'], adpCodes: ['30015', '30016'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'family-planning', code: 'FP', label: 'วางแผนครอบครัว & คุมกำเนิด', shortLabel: 'วางแผนครอบครัว',
    category: 'pp', href: '/service/dashboard-rcm/funds/family-planning/1', priority: 170,
    seamlessPrefixes: [], repFundKeywords: ['FP001', 'FP002', 'FP003', 'วางแผนครอบครัว', 'คุมกำเนิด'],
    adpCodes: ['FP001','FP002','FP002_1','FP002_2','FP003_1','FP003_2','FP003_3','FP003_4','20001','20002','20003','20004','71681','71682','71691'],
    adpPrefixes: ['FP00'], icd10Prefixes: [],
  },
  {
    id: 'pregnancy-test', code: '8.1', label: 'การทดสอบการตั้งครรภ์', shortLabel: 'ทดสอบตั้งครรภ์',
    category: 'pp', href: '/service/dashboard-rcm/funds/pregnancy-test/1', priority: 180,
    seamlessPrefixes: [], repFundKeywords: ['31101', '30014', 'ทดสอบการตั้งครรภ์'], adpCodes: ['31101', '30014'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'oral-cancer', code: '12', label: 'คัดกรองมะเร็งช่องปาก (40 ปี+)', shortLabel: 'มะเร็งช่องปาก',
    category: 'pp', href: '/service/dashboard-rcm/funds/oral-cancer/1', priority: 190,
    seamlessPrefixes: [], repFundKeywords: ['90004', 'มะเร็งช่องปาก'], adpCodes: ['90004'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'health-screening', code: '14', label: 'คัดกรองสุขภาพกาย/จิต (FPG / Cholesterol)', shortLabel: 'คัดกรองสุขภาพ (14)',
    category: 'pp', href: '/service/dashboard-rcm/funds/health-screening/14-5', priority: 200,
    seamlessPrefixes: [], repFundKeywords: ['12003', '12004'], adpCodes: ['12003', '12004'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'anemia-screening', code: '17', label: 'คัดกรองโลหิตจาง (13-24 ปี)', shortLabel: 'คัดกรองโลหิตจาง',
    category: 'pp', href: '/service/dashboard-rcm/funds/anemia-screening/17-1', priority: 210,
    seamlessPrefixes: [], repFundKeywords: ['13001', 'โลหิตจาง'], adpCodes: ['13001'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'iron-supplements', code: '18', label: 'บริการยาเม็ดเสริมธาตุเหล็ก (13-45 ปี)', shortLabel: 'เสริมธาตุเหล็ก',
    category: 'pp', href: '/service/dashboard-rcm/funds/iron-supplements/18-2', priority: 220,
    seamlessPrefixes: [], repFundKeywords: ['14001', 'เสริมธาตุเหล็ก'], adpCodes: ['14001'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'fluoride-varnish', code: '20', label: 'บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง)', shortLabel: 'เคลือบฟลูออไรด์',
    category: 'pp', href: '/service/dashboard-rcm/funds/fluoride-varnish/20-1', priority: 230,
    seamlessPrefixes: [], repFundKeywords: ['15001', 'ฟลูออไรด์'], adpCodes: ['15001'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 't1dm-gdm-pdm', code: 'DM', label: 'กองทุนเบาหวาน T1DM / GDM / PDM', shortLabel: 'T1DM / GDM / PDM',
    category: 'disease_drug', href: '/service/dashboard-rcm/funds/t1dm-gdm-pdm/2', priority: 240,
    seamlessPrefixes: [], repFundKeywords: ['T1DM', 'GDM', 'PDM'], adpCodes: [], adpPrefixes: [], icd10Prefixes: ['O24', 'E10'],
  },
  {
    id: 'walkin', code: 'WALK', label: 'กองทุน Walkin (ADP WALKIN)', shortLabel: 'กองทุน Walkin',
    category: 'rehab_special', href: '/service/dashboard-rcm/funds/walkin/adp', priority: 250,
    seamlessPrefixes: [], repFundKeywords: ['WALKIN'], adpCodes: ['WALKIN'], adpPrefixes: [], icd10Prefixes: [],
  },
  {
    id: 'general', code: 'GEN', label: 'กองทุนทั่วไป / สิทธิหลักอื่น (UCS/OFC/SSS/LGO/Seamless อื่น)', shortLabel: 'กองทุนทั่วไป/อื่นๆ',
    category: 'general', href: '/service/dashboard-rcm/rep-funds', priority: 999,
    seamlessPrefixes: [], repFundKeywords: ['UCS', 'OFC', 'SSS', 'LGO', 'STP', 'OP', 'IP'], adpCodes: [], adpPrefixes: [], icd10Prefixes: [],
  },
]

const FUND_BY_ID = new Map(RCM_FUND_CATALOG.map((f) => [f.id, f]))
const SOURCE_LABELS = {
  repdata: 'REP หลัก (repdata)',
  repeclaim: 'REP e-Claim (repeclaim)',
  seamless: 'Seamless / DMIS (seamless)',
}
const VALID_SOURCES = new Set(['repdata', 'repeclaim', 'seamless'])
const THAI_MONTH_NAMES_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function roundMoney(v) { return Math.round(Number(v || 0) * 100) / 100 }
function normalizeStr(v) { return v == null ? '' : String(v).trim() }
function normalizeNullableStr(v) { const s = normalizeStr(v); return s ? s : null }
function toNum(v) { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0 }

function getDefaultFiscalRange() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: 'numeric' }).formatToParts(new Date())
  let year = new Date().getFullYear()
  let month = new Date().getMonth() + 1
  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10)
    if (p.type === 'month') month = parseInt(p.value, 10)
  }
  const fy = month >= 10 ? year + 1 : year
  return { startDate: `${fy - 1}-10-01`, endDate: `${fy}-09-30` }
}

function getThaiFiscalYear(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})/)
  if (!m) return null
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  return y + 543 + (mo >= 10 ? 1 : 0)
}

function getYearBudgetPruningList(startDate, endDate) {
  if (!startDate || startDate < '2020-10-01') return null
  const fy1 = getThaiFiscalYear(startDate)
  const fy2 = getThaiFiscalYear(endDate)
  if (!fy1 || !fy2) return null
  const list = []
  for (let y = Math.min(fy1, fy2) - 1; y <= Math.max(fy1, fy2) + 1; y++) {
    list.push(String(y))
  }
  return list
}

function formatThaiDate(dateVal, fallback = '-') {
  if (!dateVal) return fallback
  const s = String(dateVal).trim()
  if (!s || s === '-' || s === '—') return fallback
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (!m) return s
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  const day = parseInt(m[3], 10)
  if (!year || month < 1 || month > 12 || !day) return s
  const beYear = year > 2400 ? year : year + 543
  return `${day} ${THAI_MONTH_NAMES_SHORT[month - 1]} ${beYear}`
}

function extractRepPrefixCode(rep) {
  const clean = String(rep || '').trim().toUpperCase()
  const match = clean.match(/^([A-Z]{2,8})\d/)
  return match ? match[1] : null
}

function formatRepTypeLabel(prefix, repFund) {
  if (prefix && SEAMLESS_FUND_MAP[prefix]) return `${prefix} · ${SEAMLESS_FUND_MAP[prefix]}`
  if (prefix) return repFund ? `${prefix} · ${repFund}` : prefix
  return repFund || 'ทั่วไป (e-Claim)'
}

function classifyStatementFund(input) {
  const repPrefix = (input.repPrefix || extractRepPrefixCode(input.rep) || '').toUpperCase()
  const repTagText = [input.repFund, input.repSubFund, input.projectCode].filter(Boolean).join(' ').toUpperCase()
  const adpUpper = (input.adpCodes || []).map((c) => c.trim().toUpperCase()).filter(Boolean)
  const icdUpper = (input.icd10Codes || []).map((c) => c.trim().toUpperCase()).filter(Boolean)

  const explicitMatches = []
  const clinicalMatches = []

  for (const fund of RCM_FUND_CATALOG) {
    if (fund.id === 'general') continue
    if (repPrefix && fund.seamlessPrefixes.includes(repPrefix)) {
      explicitMatches.push({ fund, reason: `REP Prefix ${repPrefix}` })
      continue
    }
    const matchedKeyword = fund.repFundKeywords.find((kw) => repTagText.includes(kw.toUpperCase()))
    if (matchedKeyword) {
      explicitMatches.push({ fund, reason: `REP Fund (${matchedKeyword})` })
      continue
    }
    const exactAdp = adpUpper.find((code) => fund.adpCodes.some((target) => target.toUpperCase() === code))
    if (exactAdp) {
      clinicalMatches.push({ fund, reason: `ADP ${exactAdp}` })
      continue
    }
    const prefixAdp = adpUpper.find((code) => fund.adpPrefixes.some((pfx) => code.startsWith(pfx.toUpperCase())))
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
    const matchedIcd = icdUpper.find((dx) => fund.icd10Prefixes.some((pfx) => dx.startsWith(pfx.toUpperCase())))
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
  return {
    primaryFundId: combined[0].fund.id,
    matchedFundIds: Array.from(new Set(combined.map((m) => m.fund.id))),
    matchReason: combined[0].reason,
  }
}

async function runChunked(items, chunkSize, concurrency, fn) {
  const chunks = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  const results = []
  let idx = 0
  const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, async () => {
    while (idx < chunks.length) {
      const current = chunks[idx++]
      const out = await fn(current)
      if (Array.isArray(out)) results.push(...out)
    }
  })
  await Promise.all(workers)
  return results
}

function buildTargetAdpFilterSql() {
  const exactSet = new Set()
  const prefixSet = new Set()
  for (const fund of RCM_FUND_CATALOG) {
    for (const c of fund.adpCodes) exactSet.add(c)
    for (const p of fund.adpPrefixes) prefixSet.add(p)
  }
  const exactList = Array.from(exactSet)
  const prefixList = Array.from(prefixSet)
  const exactSql = exactList.map((c) => `'${c.replace(/'/g, '')}'`).join(',')
  const prefixSql = prefixList.map((p) => `TRIM(nhso_adp_code) LIKE '${p.replace(/'/g, '')}%'`).join(' OR ')
  return `TRIM(nhso_adp_code) IN (${exactSql}) OR ${prefixSql}`
}

const TARGET_ADP_WHERE = buildTargetAdpFilterSql()

export default async function rcmFundsReconcileRoutes(fastify, { pools, getCached }) {
  const { hosPool } = pools

  // Local SWR Cache for BaseDataset (3 min fresh, 20 min max stale, single-flight dedup)
  const datasetCache = new Map()
  const inFlightBuilds = new Map()
  const STALE_TTL_MS = 3 * 60_000
  const MAX_TTL_MS = 20 * 60_000

  async function getTargetAdpIcodeMap() {
    return getCached('rcm-reconcile-target-adp-icodes-v1', 3600_000, async () => {
      const [[drugRows], [nondrugRows]] = await Promise.all([
        hosPool.query(`SELECT icode, TRIM(nhso_adp_code) AS adp_code FROM s_drugitems WHERE ${TARGET_ADP_WHERE}`),
        hosPool.query(`SELECT icode, TRIM(nhso_adp_code) AS adp_code, nhso_adp_type_id FROM nondrugitems WHERE nhso_adp_type_id = 2 OR ${TARGET_ADP_WHERE}`),
      ])
      const icodeMap = new Map()
      for (const r of drugRows || []) {
        const icode = normalizeStr(r.icode)
        const adp = normalizeStr(r.adp_code)
        if (!icode) continue
        const cur = icodeMap.get(icode) || { adpCodes: [], hasInstType2: false }
        if (adp && !cur.adpCodes.includes(adp)) cur.adpCodes.push(adp)
        icodeMap.set(icode, cur)
      }
      for (const r of nondrugRows || []) {
        const icode = normalizeStr(r.icode)
        const adp = normalizeStr(r.adp_code)
        if (!icode) continue
        const cur = icodeMap.get(icode) || { adpCodes: [], hasInstType2: false }
        if (adp && !cur.adpCodes.includes(adp)) cur.adpCodes.push(adp)
        if (Number(r.nhso_adp_type_id) === 2) cur.hasInstType2 = true
        icodeMap.set(icode, cur)
      }
      return {
        icodes: Array.from(icodeMap.keys()),
        icodeMap,
      }
    })
  }

  async function fetchClinicalMetaOptimized(vns, ans, startDate, endDate) {
    const metaMap = new Map()
    const ensure = (key) => {
      let cur = metaMap.get(key)
      if (!cur) {
        cur = { cid: '', ptname: '', pttypeName: null, exportCode: null, adpCodes: [], hasInstType2: false, icd10Codes: [] }
        metaMap.set(key, cur)
      }
      return cur
    }

    const applyVisitRows = (rows) => {
      for (const r of rows || []) {
        const key = normalizeStr(r.visit_key)
        if (!key) continue
        const m = ensure(key)
        if (r.cid) m.cid = normalizeStr(r.cid)
        if (r.ptname) m.ptname = normalizeStr(r.ptname)
        if (r.pttype_name) m.pttypeName = normalizeNullableStr(r.pttype_name)
        if (r.export_code) m.exportCode = normalizeNullableStr(r.export_code)
        const dxs = [r.pdx, r.dx0, r.dx1, r.dx2, r.dx3, r.dx4, r.dx5].map(normalizeStr).filter(Boolean)
        if (dxs.length > 0) m.icd10Codes = Array.from(new Set([...m.icd10Codes, ...dxs]))
      }
    }

    const { icodes: targetIcodes, icodeMap } = await getTargetAdpIcodeMap()
    const applyOpitemRows = (rows) => {
      for (const r of rows || []) {
        const key = normalizeStr(r.visit_key)
        const icode = normalizeStr(r.icode)
        if (!key || !icode) continue
        const info = icodeMap.get(icode)
        if (!info) continue
        const m = ensure(key)
        for (const c of info.adpCodes) {
          if (!m.adpCodes.includes(c)) m.adpCodes.push(c)
        }
        if (info.hasInstType2) m.hasInstType2 = true
      }
    }

    const tasks = []

    if (vns.length > 0) {
      if (vns.length <= 15000) {
        tasks.push(
          runChunked(vns, 2500, 4, async (chunk) => {
            const ph = chunk.map(() => '?').join(',')
            const [rows] = await hosPool.query(
              `SELECT o.vn AS visit_key, IFNULL(pt.cid, '') AS cid,
                CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
                ptt.name AS pttype_name, IFNULL(ov.export_code, '') AS export_code,
                v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5
              FROM ovst o
              LEFT JOIN ovstist ov ON ov.ovstist = o.ovstist
              LEFT JOIN patient pt ON pt.hn = o.hn
              LEFT JOIN vn_stat v ON v.vn = o.vn
              LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
              WHERE o.vn IN (${ph})`,
              chunk
            )
            return rows
          }).then(applyVisitRows)
        )
      } else {
        tasks.push(
          hosPool.query(
            `SELECT o.vn AS visit_key, IFNULL(pt.cid, '') AS cid,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              ptt.name AS pttype_name, IFNULL(ov.export_code, '') AS export_code,
              v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5
            FROM ovst o
            LEFT JOIN ovstist ov ON ov.ovstist = o.ovstist
            LEFT JOIN patient pt ON pt.hn = o.hn
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
            WHERE o.vstdate >= ? AND o.vstdate < DATE_ADD(?, INTERVAL 1 DAY)`,
            [startDate, endDate]
          ).then(([rows]) => applyVisitRows(rows))
        )
      }

      if (targetIcodes.length > 0) {
        const icodePh = targetIcodes.map(() => '?').join(',')
        if (vns.length <= 4000) {
          tasks.push(
            runChunked(vns, 2000, 3, async (chunk) => {
              const vnPh = chunk.map(() => '?').join(',')
              const [rows] = await hosPool.query(
                `SELECT DISTINCT oo.vn AS visit_key, oo.icode
                FROM opitemrece oo
                WHERE oo.vn IN (${vnPh}) AND oo.icode IN (${icodePh})`,
                [...chunk, ...targetIcodes]
              )
              return rows
            }).then(applyOpitemRows)
          )
        } else {
          tasks.push(
            hosPool.query(
              `SELECT DISTINCT oo.vn AS visit_key, oo.icode
              FROM opitemrece oo
              WHERE oo.vstdate >= ? AND oo.vstdate < DATE_ADD(?, INTERVAL 1 DAY)
                AND IFNULL(oo.vn, '') <> ''
                AND oo.icode IN (${icodePh})`,
              [startDate, endDate, ...targetIcodes]
            ).then(([rows]) => applyOpitemRows(rows))
          )
        }
      }
    }

    if (ans.length > 0) {
      tasks.push(
        runChunked(ans, 2000, 3, async (chunk) => {
          const ph = chunk.map(() => '?').join(',')
          const [rows] = await hosPool.query(
            `SELECT i.an AS visit_key, IFNULL(pt.cid, '') AS cid,
              CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
              ptt.name AS pttype_name,
              a.pdx, a.dx0, a.dx1, a.dx2, a.dx3, a.dx4, a.dx5
            FROM ipt i
            LEFT JOIN patient pt ON pt.hn = i.hn
            LEFT JOIN an_stat a ON a.an = i.an
            LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
            WHERE i.an IN (${ph})`,
            chunk
          )
          return rows
        }).then(applyVisitRows)
      )

      if (targetIcodes.length > 0) {
        const icodePh = targetIcodes.map(() => '?').join(',')
        tasks.push(
          runChunked(ans, 2000, 3, async (chunk) => {
            const anPh = chunk.map(() => '?').join(',')
            const [rows] = await hosPool.query(
              `SELECT DISTINCT oo.an AS visit_key, oo.icode
              FROM opitemrece oo
              WHERE oo.an IN (${anPh}) AND oo.icode IN (${icodePh})`,
              [...chunk, ...targetIcodes]
            )
            return rows
          }).then(applyOpitemRows)
        )
      }
    }

    await Promise.all(tasks)
    return metaMap
  }

  async function buildBaseDataset(startDate, endDate, includePendingRep) {
    const repOnlyFilter = includePendingRep ? '' : "AND IFNULL(TRIM(Rep), '') <> ''"
    const repOnlyAliasFilter = includePendingRep ? '' : "AND IFNULL(TRIM(rep), '') <> ''"
    const ybList = getYearBudgetPruningList(startDate, endDate)
    const ybClause = ybList ? `AND YearBudget IN (${ybList.map(() => '?').join(',')})` : ''
    const ybParams = ybList || []

    const seamlessSql = `
      SELECT ID AS id, TRIM(Rep) AS rep, TRIM(Fund) AS fund, TRIM(Type) AS subfund, TRIM(Period) AS period,
        NULLIF(TRIM(VN), '') AS vn, NULLIF(TRIM(AN), '') AS an, TRIM(HN) AS hn, TRIM(PID) AS cid, TRIM(Ptname) AS ptname,
        DATE_FORMAT(AdmDate, '%Y-%m-%d') AS admdate,
        CASE WHEN Department = 'IP' OR (IFNULL(Department, '') = '' AND IFNULL(AN, '') <> '') THEN 'IP' ELSE 'OP' END AS department,
        TRIM(MainInscl) AS main_inscl, COALESCE(Collected, 0) AS income, COALESCE(Compensated, 0) AS compensated,
        TRIM(Note) AS error_code, TRIM(Status) AS seamless_status, TRIM(PayNo) AS pay_no,
        DATE_FORMAT(PayDate, '%Y-%m-%d') AS pay_date, TRIM(STMID) AS stmid, TRIM(FileName) AS file_name
      FROM rcmdb.seamless
      WHERE AdmDate >= ? AND AdmDate < DATE_ADD(?, INTERVAL 1 DAY)
        ${ybClause}
        ${repOnlyFilter}
      ORDER BY AdmDate DESC, ID DESC
    `

    const repDateClause = `((AdmDate >= ? AND AdmDate < DATE_ADD(?, INTERVAL 1 DAY)) OR (AdmDate IS NULL AND DchDate >= ? AND DchDate < DATE_ADD(?, INTERVAL 1 DAY)))`
    const repdataSql = `
      SELECT ID AS id, TRIM(Rep) AS rep, TRIM(HN) AS hn, NULLIF(TRIM(VN), '') AS vn, NULLIF(TRIM(AN), '') AS an,
        TRIM(EclaimNo) AS eclaim_no, TRIM(PtName) AS ptname, DATE_FORMAT(COALESCE(AdmDate, DchDate), '%Y-%m-%d') AS admdate,
        CASE WHEN Department = 'IP' THEN 'IP' ELSE 'OP' END AS department,
        TRIM(MainInscl) AS main_inscl, TRIM(Fund) AS fund, TRIM(SubFund) AS subfund, TRIM(ProjectCode) AS project_code,
        COALESCE(Income, 0) AS income, COALESCE(Compensated, 0) AS compensated, TRIM(ErrorCode) AS error_code,
        TRIM(Appeal) AS appeal, TRIM(FileName) AS file_name
      FROM rcmdb.repdata
      WHERE ${repDateClause}
        ${ybClause}
        ${repOnlyAliasFilter}
      ORDER BY AdmDate DESC, ID DESC
    `

    const repeclaimSql = `
      SELECT ID AS id, TRIM(Rep) AS rep, TRIM(HN) AS hn, NULLIF(TRIM(VN), '') AS vn, NULLIF(TRIM(AN), '') AS an,
        TRIM(EclaimNo) AS eclaim_no, TRIM(PtName) AS ptname, DATE_FORMAT(COALESCE(AdmDate, DchDate), '%Y-%m-%d') AS admdate,
        CASE WHEN Department = 'IP' THEN 'IP' ELSE 'OP' END AS department,
        TRIM(MainInscl) AS main_inscl, TRIM(Fund) AS fund, TRIM(SubFund) AS subfund, TRIM(ProjectCode) AS project_code,
        COALESCE(Income, 0) AS income, COALESCE(Compensated, 0) AS compensated, TRIM(ErrorCode) AS error_code,
        TRIM(Appeal) AS appeal, TRIM(FileName) AS file_name
      FROM rcmdb.repeclaim
      WHERE ${repDateClause}
        ${ybClause}
        ${repOnlyAliasFilter}
      ORDER BY AdmDate DESC, ID DESC
    `

    const seamlessParams = [startDate, endDate, ...ybParams]
    const repParams = [startDate, endDate, startDate, endDate, ...ybParams]

    const [[seamlessRows], [repdataRows], [repeclaimRows]] = await Promise.all([
      hosPool.query(seamlessSql, seamlessParams),
      hosPool.query(repdataSql, repParams),
      hosPool.query(repeclaimSql, repParams),
    ])

    const vnSet = new Set()
    const anSet = new Set()
    const collectVisit = (r) => {
      const vn = normalizeStr(r.vn)
      const an = normalizeStr(r.an)
      if (vn) vnSet.add(vn)
      if (an) anSet.add(an)
    }
    ;(seamlessRows || []).forEach(collectVisit)
    ;(repdataRows || []).forEach(collectVisit)
    ;(repeclaimRows || []).forEach(collectVisit)

    const clinicalMetaMap = await fetchClinicalMetaOptimized(Array.from(vnSet), Array.from(anSet), startDate, endDate)

    const lines = []
    const seenRepVisitIndex = new Map()
    let dedupRemovedCount = 0

    const upsertCompensationRow = (raw, source, idx) => {
      const rep = normalizeNullableStr(raw.rep)
      const vn = normalizeNullableStr(raw.vn)
      const an = normalizeNullableStr(raw.an)
      const hn = normalizeStr(raw.hn)
      const admdate = normalizeStr(raw.admdate)
      const rawId = normalizeStr(raw.id) || `${source}-${idx}`
      const visitKey = vn || an || `${hn}:${admdate}:${rawId}`
      const dedupKey = rep ? `${rep.toUpperCase()}::${visitKey}` : null

      if (dedupKey && seenRepVisitIndex.has(dedupKey)) {
        const existing = lines[seenRepVisitIndex.get(dedupKey)]
        if (!existing.matchedSources.includes(source)) existing.matchedSources.push(source)
        if (!existing.eclaimNo && normalizeNullableStr(raw.eclaim_no)) existing.eclaimNo = normalizeNullableStr(raw.eclaim_no)
        if (!existing.errorCode && normalizeNullableStr(raw.error_code)) existing.errorCode = normalizeNullableStr(raw.error_code)
        if (existing.income === 0 && toNum(raw.income) > 0) {
          existing.income = roundMoney(toNum(raw.income))
          existing.diff = roundMoney(existing.compensated - existing.income)
        }
        dedupRemovedCount += 1
        return
      }

      const income = roundMoney(toNum(raw.income))
      const compensated = roundMoney(toNum(raw.compensated))
      const diff = roundMoney(compensated - income)
      const percentPay = income > 0 ? Math.round((compensated / income) * 100) : compensated > 0 ? 100 : 0
      const appeal = normalizeStr(raw.appeal).toUpperCase() === 'Y' ? 'Y' : 'N'
      const errorCode = normalizeNullableStr(raw.error_code)
      let status = 'paid'
      if (!rep) status = 'pending_rep'
      else if (appeal === 'Y') status = 'appeal'
      else if (compensated <= 0) status = 'denied'

      const dept = raw.department === 'IP' || (!vn && Boolean(an)) ? 'IP' : 'OP'
      const repPrefix = extractRepPrefixCode(rep)
      const payDate = normalizeNullableStr(raw.pay_date)

      const insertedIdx = lines.length
      lines.push({
        id: `${source}:${rawId}:${rep || 'NO_REP'}:${visitKey}`,
        visitKey, vn, an, hn,
        cid: normalizeStr(raw.cid),
        ptname: normalizeStr(raw.ptname),
        admdate,
        admdateThai: formatThaiDate(admdate, '-'),
        department: dept,
        mainInscl: normalizeStr(raw.main_inscl) || '-',
        pttypeName: null,
        rep, repPrefix, source,
        matchedSources: [source],
        repFund: normalizeNullableStr(raw.fund),
        repSubFund: normalizeNullableStr(raw.subfund),
        projectCode: normalizeNullableStr(raw.project_code),
        income, compensated, diff, percentPay, errorCode, appeal, status,
        eclaimNo: normalizeNullableStr(raw.eclaim_no),
        eclaimStatus: normalizeNullableStr(raw.seamless_status),
        eclaimIncome: 0,
        payNo: normalizeNullableStr(raw.pay_no),
        payDate,
        payDateThai: payDate ? formatThaiDate(payDate, '-') : null,
        stmid: normalizeNullableStr(raw.stmid),
        fileName: normalizeNullableStr(raw.file_name),
      })
      if (dedupKey) seenRepVisitIndex.set(dedupKey, insertedIdx)
    }

    ;(repdataRows || []).forEach((r, i) => upsertCompensationRow(r, 'repdata', i))
    ;(repeclaimRows || []).forEach((r, i) => upsertCompensationRow(r, 'repeclaim', i))
    ;(seamlessRows || []).forEach((r, i) => upsertCompensationRow(r, 'seamless', i))

    const prefixSet = new Set()
    const classifiedItems = lines.map((line) => {
      const clin = clinicalMetaMap.get(line.visitKey)
      const cid = line.cid || clin?.cid || ''
      const ptname = line.ptname || clin?.ptname || '-'
      const pttypeName = clin?.pttypeName || null
      const adpCodes = clin?.adpCodes || []

      const cls = classifyStatementFund({
        rep: line.rep,
        repPrefix: line.repPrefix,
        repFund: line.repFund,
        repSubFund: line.repSubFund,
        projectCode: line.projectCode,
        adpCodes,
        hasInstType2: clin?.hasInstType2 || false,
        icd10Codes: clin?.icd10Codes || [],
        exportCode: clin?.exportCode || null,
      })

      const primaryFund = FUND_BY_ID.get(cls.primaryFundId) || RCM_FUND_CATALOG[RCM_FUND_CATALOG.length - 1]
      const matchedFundLabels = cls.matchedFundIds.map((id) => (FUND_BY_ID.get(id) || RCM_FUND_CATALOG[RCM_FUND_CATALOG.length - 1]).shortLabel)
      if (line.repPrefix) prefixSet.add(line.repPrefix)

      return {
        ...line,
        cid, ptname, pttypeName,
        primaryFundId: primaryFund.id,
        primaryFundCode: primaryFund.code,
        primaryFundLabel: primaryFund.shortLabel,
        matchedFundIds: cls.matchedFundIds,
        matchedFundLabels,
        matchReason: cls.matchReason,
        adpCodes,
      }
    })

    return {
      items: classifiedItems,
      dedupRemovedCount,
      availableRepPrefixes: Array.from(prefixSet).sort((a, b) => a.localeCompare(b, 'en')),
    }
  }

  async function getBaseDatasetSwr(startDate, endDate, includePendingRep, forceRefresh) {
    const key = `${startDate}:${endDate}:${includePendingRep ? 'pending' : 'rep'}`
    if (forceRefresh) {
      datasetCache.delete(key)
    }
    const now = Date.now()
    const hit = datasetCache.get(key)
    if (hit && now - hit.updatedAt < STALE_TTL_MS) {
      return hit.data
    }

    const triggerRefresh = () => {
      let pending = inFlightBuilds.get(key)
      if (!pending) {
        pending = buildBaseDataset(startDate, endDate, includePendingRep)
          .then((data) => {
            datasetCache.set(key, { data, updatedAt: Date.now() })
            if (datasetCache.size > 16) {
              const oldestKey = datasetCache.keys().next().value
              if (oldestKey) datasetCache.delete(oldestKey)
            }
            return data
          })
          .finally(() => {
            inFlightBuilds.delete(key)
          })
        inFlightBuilds.set(key, pending)
      }
      return pending
    }

    if (hit && now - hit.updatedAt < MAX_TTL_MS && !forceRefresh) {
      triggerRefresh().catch(() => {})
      return hit.data
    }

    return triggerRefresh()
  }

  function buildSummary(rows, dedupRemovedCount) {
    const uniqueReps = new Set()
    const uniqueVisits = new Set()
    let totalIncome = 0
    let totalCompensated = 0
    let seamlessCompensated = 0
    let eclaimCompensated = 0
    let errorCount = 0
    let appealCount = 0
    let pendingRepCount = 0

    const sourceMap = new Map()
    const fundMap = new Map()
    const repTypeMap = new Map()

    for (const row of rows) {
      if (row.rep) uniqueReps.add(row.rep)
      uniqueVisits.add(row.visitKey)
      totalIncome += row.income
      totalCompensated += row.compensated
      if (row.source === 'seamless') seamlessCompensated += row.compensated
      else eclaimCompensated += row.compensated
      if (row.errorCode) errorCount += 1
      if (row.appeal === 'Y') appealCount += 1
      if (row.status === 'pending_rep') pendingRepCount += 1

      let sEntry = sourceMap.get(row.source)
      if (!sEntry) {
        sEntry = { source: row.source, label: SOURCE_LABELS[row.source], lineCount: 0, reps: new Set(), totalIncome: 0, totalCompensated: 0 }
        sourceMap.set(row.source, sEntry)
      }
      sEntry.lineCount += 1
      if (row.rep) sEntry.reps.add(row.rep)
      sEntry.totalIncome += row.income
      sEntry.totalCompensated += row.compensated

      let fEntry = fundMap.get(row.primaryFundId)
      if (!fEntry) {
        fEntry = { fundId: row.primaryFundId, reps: new Set(), visits: new Set(), repLineCount: 0, totalIncome: 0, totalCompensated: 0, seamlessCompensated: 0, eclaimCompensated: 0, seamlessLineCount: 0, eclaimLineCount: 0, errorCount: 0 }
        fundMap.set(row.primaryFundId, fEntry)
      }
      fEntry.repLineCount += 1
      if (row.rep) fEntry.reps.add(row.rep)
      fEntry.visits.add(row.visitKey)
      fEntry.totalIncome += row.income
      fEntry.totalCompensated += row.compensated
      if (row.source === 'seamless') { fEntry.seamlessCompensated += row.compensated; fEntry.seamlessLineCount += 1 }
      else { fEntry.eclaimCompensated += row.compensated; fEntry.eclaimLineCount += 1 }
      if (row.errorCode) fEntry.errorCount += 1

      const typeKeyPrefix = row.repPrefix || row.repFund || (row.rep ? 'ECLAIM' : 'PENDING')
      const rtKey = `${row.source}::${typeKeyPrefix}`
      let rtEntry = repTypeMap.get(rtKey)
      if (!rtEntry) {
        rtEntry = { prefix: typeKeyPrefix, label: formatRepTypeLabel(row.repPrefix, row.repFund), source: row.source, reps: new Set(), lineCount: 0, totalCompensated: 0 }
        repTypeMap.set(rtKey, rtEntry)
      }
      rtEntry.lineCount += 1
      if (row.rep) rtEntry.reps.add(row.rep)
      rtEntry.totalCompensated += row.compensated
    }

    const sourceBreakdown = ['repdata', 'repeclaim', 'seamless']
      .map((src) => sourceMap.get(src))
      .filter(Boolean)
      .map((s) => ({
        source: s.source,
        label: s.label,
        lineCount: s.lineCount,
        uniqueRepCount: s.reps.size,
        totalIncome: roundMoney(s.totalIncome),
        totalCompensated: roundMoney(s.totalCompensated),
      }))

    const fundCards = Array.from(fundMap.values())
      .map((f) => {
        const def = FUND_BY_ID.get(f.fundId) || RCM_FUND_CATALOG[RCM_FUND_CATALOG.length - 1]
        const inc = roundMoney(f.totalIncome)
        const comp = roundMoney(f.totalCompensated)
        return {
          fundId: def.id, code: def.code, label: def.label, shortLabel: def.shortLabel, category: def.category, href: def.href,
          repLineCount: f.repLineCount, uniqueRepCount: f.reps.size, uniqueVisitCount: f.visits.size,
          totalIncome: inc, totalCompensated: comp, totalDiff: roundMoney(comp - inc),
          reimbursementRate: inc > 0 ? Math.round((comp / inc) * 1000) / 10 : comp > 0 ? 100 : 0,
          seamlessCompensated: roundMoney(f.seamlessCompensated), eclaimCompensated: roundMoney(f.eclaimCompensated),
          seamlessLineCount: f.seamlessLineCount, eclaimLineCount: f.eclaimLineCount, errorCount: f.errorCount,
        }
      })
      .sort((a, b) => b.totalCompensated - a.totalCompensated || b.repLineCount - a.repLineCount)

    const repTypeBreakdown = Array.from(repTypeMap.values())
      .map((rt) => ({
        prefix: rt.prefix, label: rt.label, source: rt.source,
        repCount: rt.reps.size, lineCount: rt.lineCount, totalCompensated: roundMoney(rt.totalCompensated),
      }))
      .sort((a, b) => b.totalCompensated - a.totalCompensated || b.lineCount - a.lineCount)

    const incTotal = roundMoney(totalIncome)
    const compTotal = roundMoney(totalCompensated)
    return {
      totalLines: rows.length,
      uniqueRepCount: uniqueReps.size,
      uniqueVisitCount: uniqueVisits.size,
      totalIncome: incTotal,
      totalCompensated: compTotal,
      totalDiff: roundMoney(compTotal - incTotal),
      reimbursementRate: incTotal > 0 ? Math.round((compTotal / incTotal) * 1000) / 10 : compTotal > 0 ? 100 : 0,
      seamlessCompensated: roundMoney(seamlessCompensated),
      eclaimCompensated: roundMoney(eclaimCompensated),
      errorCount, appealCount, pendingRepCount, dedupRemovedCount,
      sourceBreakdown, fundCards, repTypeBreakdown,
    }
  }

  // ------------------------------------------------------------------
  // 1. Unified Funds REP Reconcile (repdata + repeclaim + seamless)
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/funds-rep-reconcile', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รวมผลตอบรับ REP ข้ามกองทุน (repdata + repeclaim + seamless) พร้อมจำแนกกองทุนอัตโนมัติ (Optimized Gateway API)',
    }
  }, async (req, reply) => {
    try {
      const q = req.query || {}
      const defRange = getDefaultFiscalRange()
      const startDate = normalizeStr(q.ds1 || q.startDate) || defRange.startDate
      const endDate = normalizeStr(q.ds2 || q.endDate) || defRange.endDate
      const includePendingRep = q.includePendingRep === 'true' || q.includePendingRep === '1'
      const forceRefresh = q.refresh === 'true' || q.refresh === '1'
      const exportAll = q.exportAll === 'true' || q.exportAll === '1'
      const page = Math.max(1, parseInt(q.page || '1', 10) || 1)
      const pageSize = Math.min(200, Math.max(1, parseInt(q.pageSize || '50', 10) || 50))
      const sortBy = normalizeStr(q.sortBy) || 'admdate'
      const sortOrder = q.sortOrder === 'asc' ? 'asc' : 'desc'
      const deptFilter = ['OP', 'IP'].includes(q.department) ? q.department : 'ALL'
      const statusFilter = normalizeStr(q.status) || 'ALL'
      const searchLower = normalizeStr(q.search).toLowerCase()
      const focusFundId = normalizeStr(q.focusFundId)
      const fundFilterSet = new Set(normalizeStr(q.funds).split(',').map((s) => s.trim()).filter(Boolean))
      const sourceFilterSet = new Set(normalizeStr(q.sources).split(',').map((s) => s.trim()).filter((s) => VALID_SOURCES.has(s)))
      const prefixFilterSet = new Set(normalizeStr(q.repPrefixes).split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))

      const base = await getBaseDatasetSwr(startDate, endDate, includePendingRep, forceRefresh)

      const nonFundFiltered = base.items.filter((item) => {
        if (deptFilter !== 'ALL' && item.department !== deptFilter) return false
        if (sourceFilterSet.size > 0) {
          if (!sourceFilterSet.has(item.source) && !item.matchedSources.some((s) => sourceFilterSet.has(s))) return false
        }
        if (prefixFilterSet.size > 0) {
          const tag = (item.repPrefix || item.repFund || 'OTHER').toUpperCase()
          const match = prefixFilterSet.has(tag) || (item.repPrefix ? prefixFilterSet.has(item.repPrefix.toUpperCase()) : false)
          if (!match) return false
        }
        if (statusFilter === 'COMPENSATED' && item.compensated <= 0) return false
        if (statusFilter === 'UNCOMPENSATED' && item.compensated > 0) return false
        if (statusFilter === 'HAS_ERROR' && !item.errorCode) return false
        if (statusFilter === 'APPEAL' && item.appeal !== 'Y') return false
        if (statusFilter === 'PENDING_REP' && item.status !== 'pending_rep') return false
        if (searchLower) {
          const hay = [item.vn, item.an, item.hn, item.cid, item.ptname, item.rep, item.repFund, item.repSubFund, item.primaryFundLabel, item.primaryFundCode, item.eclaimNo, item.payNo, item.errorCode]
            .filter(Boolean).join(' ').toLowerCase()
          if (!hay.includes(searchLower)) return false
        }
        return true
      })

      const catalogCounts = new Map()
      for (const item of nonFundFiltered) {
        const cur = catalogCounts.get(item.primaryFundId) || { lineCount: 0, totalCompensated: 0 }
        cur.lineCount += 1
        cur.totalCompensated += item.compensated
        catalogCounts.set(item.primaryFundId, cur)
      }

      const fundFiltered = fundFilterSet.size > 0
        ? nonFundFiltered.filter((item) => fundFilterSet.has(item.primaryFundId))
        : nonFundFiltered

      const summary = buildSummary(fundFiltered, base.dedupRemovedCount)
      const tableRows = focusFundId ? fundFiltered.filter((item) => item.primaryFundId === focusFundId) : fundFiltered

      const sorted = [...tableRows].sort((a, b) => {
        let cmp = 0
        switch (sortBy) {
          case 'rep': cmp = (a.rep || '').localeCompare(b.rep || '', 'en'); break
          case 'vn': cmp = (a.vn || a.an || '').localeCompare(b.vn || b.an || '', 'en'); break
          case 'hn': cmp = a.hn.localeCompare(b.hn, 'en'); break
          case 'ptname': cmp = a.ptname.localeCompare(b.ptname, 'th'); break
          case 'fund': cmp = a.primaryFundLabel.localeCompare(b.primaryFundLabel, 'th'); break
          case 'income': cmp = a.income - b.income; break
          case 'compensated': cmp = a.compensated - b.compensated; break
          case 'diff': cmp = a.diff - b.diff; break
          case 'admdate':
          default: cmp = a.admdate.localeCompare(b.admdate, 'en'); break
        }
        return sortOrder === 'asc' ? cmp : -cmp
      })

      const totalCount = sorted.length
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
      const safePage = Math.min(page, totalPages)
      const items = exportAll ? sorted : sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

      return {
        success: true,
        data: {
          range: { startDate, endDate },
          summary,
          items,
          totalCount,
          page: safePage,
          pageSize,
          totalPages,
          availableFundCatalog: RCM_FUND_CATALOG.map((f) => {
            const c = catalogCounts.get(f.id)
            return {
              id: f.id, code: f.code, label: f.label, shortLabel: f.shortLabel, category: f.category, href: f.href,
              lineCount: c?.lineCount || 0,
              totalCompensated: roundMoney(c?.totalCompensated || 0),
            }
          }),
          availableRepPrefixes: base.availableRepPrefixes,
        },
      }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // ------------------------------------------------------------------
  // 2. Single Visit (VN / AN) Detail Reconcile Breakdown
  // ------------------------------------------------------------------
  fastify.get('/api/v1/clinical/rcm/funds-rep-reconcile/vn-details', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'รายละเอียดรายการเวชระเบียน ADP และ REP ทั้ง 3 แหล่ง (repdata/repeclaim/seamless) สำหรับ VN/AN เดียว',
    }
  }, async (req, reply) => {
    try {
      const cleanKey = normalizeStr(req.query?.vn)
      if (!cleanKey) {
        reply.code(400)
        return { success: false, error: 'vn parameter is required' }
      }

      const [
        [ovstRows],
        [iptRows],
        [adpRows],
        [repdataRows],
        [repeclaimRows],
        [seamlessRows],
      ] = await Promise.all([
        hosPool.query(
          `SELECT o.vn, o.hn, IFNULL(pt.cid, '') AS cid,
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
            DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS admdate,
            ptt.name AS pttype_name, v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5
          FROM ovst o
          LEFT JOIN patient pt ON pt.hn = o.hn
          LEFT JOIN vn_stat v ON v.vn = o.vn
          LEFT JOIN pttype ptt ON ptt.pttype = o.pttype
          WHERE o.vn = ? LIMIT 1`,
          [cleanKey]
        ),
        hosPool.query(
          `SELECT i.an, i.hn, IFNULL(pt.cid, '') AS cid,
            CONCAT(IFNULL(pt.pname, ''), IFNULL(pt.fname, ''), ' ', IFNULL(pt.lname, '')) AS ptname,
            DATE_FORMAT(i.dchdate, '%Y-%m-%d') AS admdate,
            ptt.name AS pttype_name, a.pdx, a.dx0, a.dx1, a.dx2, a.dx3, a.dx4, a.dx5
          FROM ipt i
          LEFT JOIN patient pt ON pt.hn = i.hn
          LEFT JOIN an_stat a ON a.an = i.an
          LEFT JOIN pttype ptt ON ptt.pttype = i.pttype
          WHERE i.an = ? LIMIT 1`,
          [cleanKey]
        ),
        hosPool.query(
          `SELECT oo.icode, COALESCE(d.name, nd.name, oo.icode) AS name,
            COALESCE(NULLIF(TRIM(d.nhso_adp_code), ''), NULLIF(TRIM(nd.nhso_adp_code), ''), '') AS adp_code,
            COALESCE(oo.qty, 0) AS qty, COALESCE(oo.sum_price, 0) AS sum_price
          FROM opitemrece oo
          LEFT JOIN s_drugitems d ON d.icode = oo.icode
          LEFT JOIN nondrugitems nd ON nd.icode = oo.icode
          WHERE (oo.vn = ? OR oo.an = ?)
            AND (IFNULL(TRIM(d.nhso_adp_code), '') <> '' OR IFNULL(TRIM(nd.nhso_adp_code), '') <> '' OR nd.nhso_adp_type_id = 2)
          ORDER BY oo.sum_price DESC
          LIMIT 50`,
          [cleanKey, cleanKey]
        ),
        hosPool.query(
          `SELECT Rep AS rep, Fund AS fund, SubFund AS subfund, COALESCE(Income, 0) AS income, COALESCE(Compensated, 0) AS compensated,
            ErrorCode AS error_code, Appeal AS appeal, EclaimNo AS eclaim_no, FileName AS file_name, HN AS hn, PtName AS ptname,
            DATE_FORMAT(COALESCE(AdmDate, DchDate), '%Y-%m-%d') AS admdate
          FROM rcmdb.repdata WHERE VN = ? OR AN = ?`,
          [cleanKey, cleanKey]
        ),
        hosPool.query(
          `SELECT Rep AS rep, Fund AS fund, SubFund AS subfund, COALESCE(Income, 0) AS income, COALESCE(Compensated, 0) AS compensated,
            ErrorCode AS error_code, Appeal AS appeal, EclaimNo AS eclaim_no, FileName AS file_name, HN AS hn, PtName AS ptname,
            DATE_FORMAT(COALESCE(AdmDate, DchDate), '%Y-%m-%d') AS admdate
          FROM rcmdb.repeclaim WHERE VN = ? OR AN = ?`,
          [cleanKey, cleanKey]
        ),
        hosPool.query(
          `SELECT Rep AS rep, Fund AS fund, Type AS subfund, COALESCE(Collected, 0) AS income, COALESCE(Compensated, 0) AS compensated,
            Note AS error_code, Status AS eclaim_status, PayNo AS pay_no, DATE_FORMAT(PayDate, '%Y-%m-%d') AS pay_date,
            FileName AS file_name, HN AS hn, PID AS cid, Ptname AS ptname, DATE_FORMAT(AdmDate, '%Y-%m-%d') AS admdate
          FROM rcmdb.seamless WHERE VN = ? OR AN = ?`,
          [cleanKey, cleanKey]
        ),
      ])

      const clin = (ovstRows && ovstRows[0]) || (iptRows && iptRows[0]) || null
      const isIpd = Boolean(iptRows && iptRows[0]) && !(ovstRows && ovstRows[0])
      const fallbackInfo = (seamlessRows && seamlessRows[0]) || (repdataRows && repdataRows[0]) || (repeclaimRows && repeclaimRows[0]) || null

      if (!clin && !fallbackInfo) {
        return { success: true, data: null }
      }

      const dxList = clin
        ? Array.from(new Set([clin.pdx, clin.dx0, clin.dx1, clin.dx2, clin.dx3, clin.dx4, clin.dx5].map(normalizeStr).filter(Boolean)))
        : []

      const allRepLines = [
        ...(repdataRows || []).map((r) => ({
          source: 'repdata', rep: normalizeNullableStr(r.rep), fund: normalizeNullableStr(r.fund), subFund: normalizeNullableStr(r.subfund),
          income: roundMoney(r.income), compensated: roundMoney(r.compensated), errorCode: normalizeNullableStr(r.error_code),
          appeal: normalizeNullableStr(r.appeal), eclaimNo: normalizeNullableStr(r.eclaim_no), eclaimStatus: null, payNo: null, payDateThai: null,
          fileName: normalizeNullableStr(r.file_name),
        })),
        ...(repeclaimRows || []).map((r) => ({
          source: 'repeclaim', rep: normalizeNullableStr(r.rep), fund: normalizeNullableStr(r.fund), subFund: normalizeNullableStr(r.subfund),
          income: roundMoney(r.income), compensated: roundMoney(r.compensated), errorCode: normalizeNullableStr(r.error_code),
          appeal: normalizeNullableStr(r.appeal), eclaimNo: normalizeNullableStr(r.eclaim_no), eclaimStatus: null, payNo: null, payDateThai: null,
          fileName: normalizeNullableStr(r.file_name),
        })),
        ...(seamlessRows || []).map((r) => ({
          source: 'seamless', rep: normalizeNullableStr(r.rep), fund: normalizeNullableStr(r.fund), subFund: normalizeNullableStr(r.subfund),
          income: roundMoney(r.income), compensated: roundMoney(r.compensated), errorCode: normalizeNullableStr(r.error_code),
          appeal: null, eclaimNo: null, eclaimStatus: normalizeNullableStr(r.eclaim_status), payNo: normalizeNullableStr(r.pay_no),
          payDateThai: r.pay_date ? formatThaiDate(String(r.pay_date), '-') : null,
          fileName: normalizeNullableStr(r.file_name),
        })),
      ]

      const admdate = normalizeStr(clin?.admdate || fallbackInfo?.admdate)
      return {
        success: true,
        data: {
          visitKey: cleanKey,
          vn: isIpd ? null : cleanKey,
          an: isIpd ? cleanKey : null,
          hn: normalizeStr(clin?.hn || fallbackInfo?.hn),
          cid: normalizeStr(clin?.cid || seamlessRows?.[0]?.cid),
          ptname: normalizeStr(clin?.ptname || fallbackInfo?.ptname) || '-',
          admdate,
          admdateThai: admdate ? formatThaiDate(admdate, '-') : '-',
          department: isIpd ? 'IP' : 'OP',
          pttypeName: normalizeNullableStr(clin?.pttype_name),
          pdx: normalizeNullableStr(clin?.pdx),
          dxList,
          adpItems: (adpRows || []).map((r) => ({
            icode: normalizeStr(r.icode),
            name: normalizeStr(r.name),
            nhsoAdpCode: normalizeStr(r.adp_code),
            qty: toNum(r.qty),
            sumPrice: roundMoney(r.sum_price),
          })),
          allRepLines,
        },
      }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })
}
