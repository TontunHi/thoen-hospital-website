import rh1Data2570 from '@/data/budget/rh1-2570.json'
import rh1Data2569 from '@/data/budget/rh1-2569.json'

export interface Rh1Hospital {
  c: number // รหัสหน่วยบริการ 5 หลัก (เช่น 11152)
  n: string // ชื่อ รพ. (เช่น รพ.เถิน)
  p: string // จังหวัด (เช่น ลำปาง)
  t: string // ประเภท (เช่น รพช.)
  l: string // ขนาด (เช่น M2, A-F3)
  b: number // จำนวนเตียง (เช่น 81)
  u: number // ประชากร UC (เช่น 39341)
  g: string // กลุ่มระดับบริการ (เช่น รพช.M2 B<=100)
}

export interface Rh1Key {
  id: string
  m: string
  name: string
}

export interface Rh1Main {
  id: string
  name: string
}

export interface Rh1Source {
  keys: Rh1Key[]
  mains: Rh1Main[]
  parts: string[]
  allLabel: string
  flat: boolean
  ordered: boolean
  recs: number[][]
}

export interface Rh1Dataset {
  H: Rh1Hospital[]
  S: Record<string, Rh1Source>
  asof?: string
}

export interface Rh1AggregatedItem {
  key: string
  name: string
  lvl: 'm' | 's'
  main: string
  arr: Float64Array
  sum: number
}

export interface Rh1AggregateResult {
  list: Rh1AggregatedItem[]
  map: Map<string, Rh1AggregatedItem>
  mains: Rh1AggregatedItem[]
  subsBy: Record<string, Rh1AggregatedItem[]>
  total: Float64Array
  flat: boolean
}

export interface ExecItemRow {
  id: string
  src: string
  name: string
  ownAmt: number
  ownPC: number
  mean: number
  sd: number
  max: number
  n: number
  status: 'good' | 'opp' | 'normal' | 'zeroA' | 'zeroB'
  zPeers?: number
  doPeers?: number
  upLow?: number
  upHigh?: number
  perVisit?: boolean
}

export interface ExecutiveSummaryResult {
  year: string
  asof: string
  hospital: Rh1Hospital
  peers: Rh1Hospital[]
  peerGroupLabel: string
  goodItems: ExecItemRow[]
  opportunityItems: ExecItemRow[]
  zeroActionableItems: ExecItemRow[]
  zeroNeutralItems: ExecItemRow[]
  normalCount: number
  totalOpportunityLow: number
  totalOpportunityHigh: number
  stats: {
    totalCompensation: number
    ucPopulation: number
    compensationPerCapita: number
    peerMedianPerCapita: number
    rankInGroup: number
    groupTotalHospitals: number
    rankInRegion: number
    regionTotalHospitals: number
  }
}

export interface FundOverviewItem {
  id: string
  name: string
  level: 'm' | 's'
  mainId?: string
  totalAmountInGroup: number
  hospitalAmount: number
  hospitalPerCapita: number
  peerMeanPerCapita: number
  peerMedianPerCapita: number
  rankInGroup: number
  totalPeersWithAmount: number
  peerValues: {
    hospitalCode: number
    hospitalName: string
    amount: number
    perCapita: number
  }[]
}

export type PeerScope = 'm2' | 'province' | 'all'

export interface GetSourceItemsOptions {
  peerScope?: PeerScope
  search?: string
  limit?: number
}

export const THOEN_HOSPITAL_CODE = 11152

export interface Rh1TabDefinition {
  id: string
  title: string
  sub: string
  name: string
  desc: string
  itemLabel: string
  note: string
}

export const RH1_TABS: Rh1TabDefinition[] = [
  {
    id: 'L2',
    title: '1. ข้อมูลรายกองทุนย่อย',
    sub: 'L2_statementuc',
    name: '1. ข้อมูลรายกองทุนย่อย (L2_statementuc)',
    desc: 'ยอดชดเชยรายกองทุนย่อยจาก Statement UC — ใช้คอลัมน์ ACT_AMT',
    itemLabel: 'กองทุน',
    note: 'ยอดชดเชยรายกองทุนย่อยจาก Statement UC — ใช้คอลัมน์ ACT_AMT',
  },
  {
    id: 'L3',
    title: '2. ข้อมูลการเบิกชดเชยอวัยวะเทียม',
    sub: 'L3_instrument',
    name: '2. ข้อมูลการเบิกชดเชยอวัยวะเทียม (L3_instrument)',
    desc: 'ยอดเบิกชดเชยอุปกรณ์/อวัยวะเทียมรายรหัสรายการ (SUM_AMT)',
    itemLabel: 'รายการอุปกรณ์',
    note: 'ยอดเบิกชดเชยอุปกรณ์/อวัยวะเทียมรายรหัสรายการ (SUM_AMT)',
  },
  {
    id: 'L4',
    title: '3. ข้อมูลการเบิกชดเชยกองทุนโรคไต',
    sub: 'L4_ckd_2203',
    name: '3. ข้อมูลการเบิกชดเชยกองทุนโรคไต (L4_ckd_2203)',
    desc: 'ยอดเบิกชดเชยโรคไตวายเรื้อรัง (ACT_AMT) — มีเฉพาะ รพ. ที่จัดบริการ',
    itemLabel: 'รายการ',
    note: 'ยอดเบิกชดเชยโรคไตวายเรื้อรัง (ACT_AMT) — มีเฉพาะ รพ. ที่จัดบริการ',
  },
  {
    id: 'L5',
    title: '4. ข้อมูลการเบิกชดเชยผ่าน MOPH CLAIM',
    sub: 'L5_moph_2205',
    name: '4. ข้อมูลการเบิกชดเชยผ่าน MOPH CLAIM (L5_moph_2205)',
    desc: 'ยอดเบิกชดเชยบริการส่งเสริมป้องกันผ่าน MOPH Claim (ACT_AMT)',
    itemLabel: 'รายการ',
    note: 'ยอดเบิกชดเชยบริการส่งเสริมป้องกันผ่าน MOPH Claim (ACT_AMT)',
  },
  {
    id: 'L6',
    title: '5. ข้อมูลการเบิกชดเชยผ่าน KTB Platform',
    sub: 'L6_ktp_2263',
    name: '5. ข้อมูลการเบิกชดเชยผ่าน KTB Platform (L6_ktp_2263)',
    desc: 'ยอดเบิกชดเชยบริการผ่าน KTB Platform รายรหัสบริการ (ACT_AMT)',
    itemLabel: 'รายการ',
    note: 'ยอดเบิกชดเชยบริการผ่าน KTB Platform รายรหัสบริการ (ACT_AMT)',
  },
  {
    id: 'L7',
    title: '6. ข้อมูลการเบิกชดเชยกรมบัญชีกลาง',
    sub: 'L7_csmbs',
    name: '6. ข้อมูลการเบิกชดเชยกรมบัญชีกลาง (L7_csmbs)',
    desc: 'ยอดเบิกชดเชยสิทธิข้าราชการ — จัดลำดับตามยอดชดเชย OP ต่อ visit',
    itemLabel: 'ตัวชี้วัด',
    note: 'ยอดเบิกชดเชยสิทธิข้าราชการ — จัดลำดับตามยอดชดเชย OP ต่อ visit (NUMPT_OP) · ไม่นำ รพ. ขนาด A, S, รพ.เชียงคำ และ รพ.สันป่าตอง มาคำนวณ',
  },
  {
    id: 'L8',
    title: '7. ข้อมูลการเบิกชดเชย อปท.',
    sub: 'L8_lgo',
    name: '7. ข้อมูลการเบิกชดเชย อปท. (L8_lgo)',
    desc: 'ยอดเบิกชดเชยสิทธิ อปท. — จัดลำดับตามยอดชดเชย OP ต่อ visit',
    itemLabel: 'ตัวชี้วัด',
    note: 'ยอดเบิกชดเชยสิทธิ อปท. — จัดลำดับตามยอดชดเชย OP ต่อ visit (NUMPT_OP)',
  },
  {
    id: 'L1',
    title: '8. ภาพรวมการโอนเงิน',
    sub: 'L1_budget',
    name: '8. ภาพรวมการโอนเงิน (L1_budget)',
    desc: 'เงินที่ รพ. ได้รับ แยกกองทุนหลัก/รายการย่อย (คอลัมน์ BUDGET)',
    itemLabel: 'กองทุน',
    note: 'เงินที่ รพ. ได้รับ แยกกองทุนหลัก/รายการย่อย (คอลัมน์ BUDGET)',
  },
  {
    id: 'HP',
    title: '9. สรุปข้อมูลวิเคราะห์รายโรงพยาบาล',
    sub: 'ทุกแหล่งข้อมูล',
    name: '9. สรุปข้อมูลวิเคราะห์รายโรงพยาบาล (ทุกแหล่งข้อมูล)',
    desc: 'สรุปผลงาน รพ. แยกตามแหล่งข้อมูล รายละเอียดเจาะลึก และ Heatmap ข้ามแหล่ง',
    itemLabel: 'แหล่งข้อมูล',
    note: 'สรุปผลงานของ รพ. ที่โฟกัส แยกตามแหล่งข้อมูล (L1–L8), รายละเอียดเทียบกลุ่ม และ Heatmap ข้ามแหล่งข้อมูล',
  },
  {
    id: 'EXEC',
    title: '10. บทสรุปผู้บริหารรายโรงพยาบาล',
    sub: 'ทำได้ดี / โอกาสพัฒนา',
    name: '10. บทสรุปผู้บริหารรายโรงพยาบาล (ทำได้ดี / โอกาสพัฒนา)',
    desc: 'วิเคราะห์จุดเด่นที่ทำได้ดี โอกาสพัฒนาเพิ่มรายได้ และรายการที่ยังไม่ได้เริ่มเบิก',
    itemLabel: 'รายการวิเคราะห์',
    note: 'วิเคราะห์จุดเด่นที่ทำได้ดี (> Mean + 1 SD) โอกาสพัฒนาเพิ่มรายได้ (< Mean) และรายการที่ยังไม่ได้เริ่มเบิกชดเชย',
  },
]

export const RH1_SOURCES = RH1_TABS

// Static Registry of supported Fiscal Years
const DATASETS: Record<string, Rh1Dataset> = {
  '2570': rh1Data2570 as unknown as Rh1Dataset,
  '2569': rh1Data2569 as unknown as Rh1Dataset,
}

// In-memory cache for computed aggregates
const buildCache = new Map<string, Rh1AggregateResult>()

export class Rh1BudgetService {
  /**
   * คืนค่าปีงบประมาณทั้งหมดที่มีในระบบ เรียงจากปีล่าสุดไปปีย้อนหลัง
   */
  static getAvailableFiscalYears(): string[] {
    return Object.keys(DATASETS).sort((a, b) => Number(b) - Number(a))
  }

  /**
   * ลงทะเบียนปีงบประมาณเพิ่มเติม (Dynamic Plug-and-Play)
   */
  static registerFiscalYear(year: string, dataset: Rh1Dataset): void {
    DATASETS[year] = dataset
    for (const key of buildCache.keys()) {
      if (key.startsWith(`${year}:`)) {
        buildCache.delete(key)
      }
    }
  }

  /**
   * ดึงชุดข้อมูลของปีงบประมาณที่ระบุ
   */
  static getDataset(year: string): Rh1Dataset {
    const data = DATASETS[year]
    if (!data) {
      const fallbackYear = this.getAvailableFiscalYears()[0] || '2570'
      return DATASETS[fallbackYear]
    }
    return data
  }

  /**
   * ดึงรายชื่อโรงพยาบาลทั้งหมด 103 แห่ง
   */
  static getAllHospitals(year: string): Rh1Hospital[] {
    return this.getDataset(year).H
  }

  /**
   * ดึงข้อมูลโรงพยาบาลเถิน หรือโรงพยาบาลเป้าหมาย
   */
  static getHospitalByCode(year: string, code: number = THOEN_HOSPITAL_CODE): { hospital: Rh1Hospital; index: number } {
    const H = this.getAllHospitals(year)
    const index = H.findIndex(h => h.c === code)
    if (index === -1) {
      const fallbackIdx = H.findIndex(h => h.c === THOEN_HOSPITAL_CODE)
      const finalIdx = fallbackIdx !== -1 ? fallbackIdx : 0
      return { hospital: H[finalIdx], index: finalIdx }
    }
    return { hospital: H[index], index }
  }

  /**
   * ดึงรายชื่อกลุ่มเปรียบเทียบของโรงพยาบาลตาม Scope ที่เลือก
   */
  static getPeersByScope(
    year: string,
    hospitalCode: number = THOEN_HOSPITAL_CODE,
    scope: PeerScope = 'm2'
  ): { hospital: Rh1Hospital; index: number }[] {
    const H = this.getAllHospitals(year)
    const { hospital } = this.getHospitalByCode(year, hospitalCode)

    if (scope === 'm2') {
      return H.map((h, idx) => ({ hospital: h, index: idx })).filter(p => p.hospital.g === hospital.g)
    }

    if (scope === 'province') {
      return H.map((h, idx) => ({ hospital: h, index: idx })).filter(p => p.hospital.p === hospital.p)
    }

    // 'all': ทั้งหมด 103 รพ.
    return H.map((h, idx) => ({ hospital: h, index: idx }))
  }

  /**
   * ดึงรายชื่อกลุ่มเปรียบเทียบตาม GroupName (backward compatibility)
   */
  static getPeerHospitals(year: string, groupName: string): { hospital: Rh1Hospital; index: number }[] {
    const H = this.getAllHospitals(year)
    return H.map((h, idx) => ({ hospital: h, index: idx })).filter(p => p.hospital.g === groupName)
  }

  /**
   * สร้าง Aggregate Matrix ของแหล่งข้อมูล (Source เช่น L1, L2, L3)
   */
  static buildSourceAggregates(year: string, sourceId: string, partIndex: number = 0): Rh1AggregateResult {
    const cacheKey = `${year}:${sourceId}|${partIndex}`
    if (buildCache.has(cacheKey)) {
      return buildCache.get(cacheKey)!
    }

    const data = this.getDataset(year)
    const s = data.S[sourceId]
    if (!s) {
      return {
        list: [],
        map: new Map(),
        mains: [],
        subsBy: {},
        total: new Float64Array(data.H.length),
        flat: false,
      }
    }

    const NH = data.H.length
    const vi = 2 + partIndex
    const mainInfo: Record<string, Rh1Main> = {}
    s.mains?.forEach(m => {
      mainInfo[m.id] = m
    })

    const F = new Map<string, Rh1AggregatedItem>()
    const total = new Float64Array(NH)

    const getOrInit = (key: string, name: string, lvl: 'm' | 's', main: string) => {
      let f = F.get(key)
      if (!f) {
        f = { key, name, lvl, main, arr: new Float64Array(NH), sum: 0 }
        F.set(key, f)
      }
      return f
    }

    const EX7 = new Set(
      data.H.map((h, i) => (h.l === 'A' || h.l === 'S' || h.n === 'รพ.เชียงคำ' || h.n === 'รพ.สันป่าตอง' ? i : -1)).filter(
        i => i !== -1
      )
    )

    s.recs.forEach(r => {
      if (sourceId === 'L7' && EX7.has(r[0])) return
      const k = s.keys[r[1]]
      if (!k) return
      const v = r[vi] || 0
      const h = r[0]

      if (!s.flat) {
        getOrInit('s:' + k.id, k.name, 's', k.m).arr[h] += v
      }
      const mainName = mainInfo[k.m]?.name || k.m
      getOrInit('m:' + k.m, mainName, 'm', k.m).arr[h] += v
      total[h] += v
    })

    const list = Array.from(F.values()).filter(f => {
      let sm = 0
      let nz = false
      for (let i = 0; i < NH; i++) {
        sm += f.arr[i]
        if (f.arr[i] !== 0) nz = true
      }
      f.sum = sm
      return nz
    })

    list.sort((a, b) => b.sum - a.sum)
    const map = new Map(list.map(f => [f.key, f]))
    const mains = list.filter(f => f.lvl === 'm')
    const subsBy: Record<string, Rh1AggregatedItem[]> = {}
    list.filter(f => f.lvl === 's').forEach(f => {
      ;(subsBy[f.main] ||= []).push(f)
    })

    const res: Rh1AggregateResult = { list, map, mains, subsBy, total, flat: s.flat }
    buildCache.set(cacheKey, res)
    return res
  }

  /**
   * คำนวณตัวชี้วัดกองทุนสิทธิข้าราชการ (L7) หรือ อปท. (L8) เช่น ยอดชดเชย OP, IP, Visit และ OP ต่อครั้ง
   */
  static getLmMeasurements(year: string, sourceId: 'L7' | 'L8') {
    const data = this.getDataset(year)
    const s = data.S[sourceId]
    const NH = data.H.length
    const opA = new Float64Array(NH)
    const ipA = new Float64Array(NH)
    const opN = new Float64Array(NH)
    const ipN = new Float64Array(NH)
    const tot = new Float64Array(NH)

    const EX7 = new Set(
      data.H.map((h, i) => (h.l === 'A' || h.l === 'S' || h.n === 'รพ.เชียงคำ' || h.n === 'รพ.สันป่าตอง' ? i : -1)).filter(
        i => i !== -1
      )
    )

    if (s && s.recs) {
      s.recs.forEach(r => {
        const h = r[0]
        if (sourceId === 'L7' && EX7.has(h)) return
        opA[h] += r[3] || 0
        ipA[h] += r[4] || 0
        opN[h] += r[5] || 0
        ipN[h] += r[6] || 0
      })
    }

    const opVisit = new Float64Array(NH)
    for (let i = 0; i < NH; i++) {
      tot[i] = opA[i] + ipA[i]
      opVisit[i] = opN[i] > 0 ? opA[i] / opN[i] : 0
    }

    return { opA, ipA, opN, ipN, tot, opVisit, EX7 }
  }

  /**
   * คำนวณ Executive Summary (จุดเด่น, โอกาสเพิ่มรายได้, รายการที่ยังไม่เริ่มเบิก)
   */
  static getExecutiveSummary(
    year: string,
    hospitalCode: number = THOEN_HOSPITAL_CODE,
    peerScope: PeerScope = 'm2'
  ): ExecutiveSummaryResult {
    const data = this.getDataset(year)
    const { hospital, index: focusIdx } = this.getHospitalByCode(year, hospitalCode)
    const H = data.H
    const peers = this.getPeersByScope(year, hospitalCode, peerScope)
    const peerIndices = peers.map(p => p.index)
    const pop = hospital.u || 1

    const EXEC_SCOPE = [
      { src: 'L1', label: 'L1 ภาพรวมการโอนเงิน', only: ['กองทุนเอดส์', 'ค่าบริการฟื้นฟูสมรรถภาพด้านการแพทย์', 'งบแพทย์แผนไทย'] },
      {
        src: 'L2',
        label: 'L2 กองทุนย่อย',
        minPC: 2,
        exclude: ['OPCS', 'OPLG', 'IPCS', 'IPLG', 'OPKTMN', 'IPKTMN', 'OTKTMN', 'DM22', 'OTCS', 'OTLG'],
      },
      { src: 'L5', label: 'L5 MOPH Claim' },
      { src: 'L6', label: 'L6 Krungthai Platform' },
    ]

    const items: { id: string; src: string; name: string; arr: Float64Array; visitArr?: Float64Array; pvArr?: Float64Array; perVisit?: boolean }[] = []
    const totalRegionPop = H.reduce((sum, h) => sum + h.u, 0)

    EXEC_SCOPE.forEach(sc => {
      const b = this.buildSourceAggregates(year, sc.src, 0)
      b.list
        .filter((f: Rh1AggregatedItem) => (sc.only ? f.lvl === 's' && sc.only.includes(f.name) : f.lvl === 'm'))
        .forEach((f: Rh1AggregatedItem) => {
          if (sc.minPC && totalRegionPop && f.sum / totalRegionPop < sc.minPC) return
          const rawKey = f.key.split(':')[1]
          if (sc.exclude && sc.exclude.includes(rawKey)) return

          let arr = f.arr
          let nm = f.name
          if (sc.src === 'L1' && f.name === 'งบแพทย์แผนไทย') {
            const hc22 = this.buildSourceAggregates(year, 'L2', 0).map.get('m:HC22')
            if (hc22) {
              const adjusted = new Float64Array(H.length)
              for (let i = 0; i < H.length; i++) {
                adjusted[i] = Math.max(0, arr[i] - hc22.arr[i])
              }
              arr = adjusted
              nm = 'งบแพทย์แผนไทย (หัก HC22 ยาสมุนไพร FS แล้ว)'
            }
          }

          items.push({
            id: `${sc.src}:${rawKey}`,
            src: sc.label,
            name: nm,
            arr,
          })
        })
    })

    const rows: ExecItemRow[] = items.map(it => {
      const arr = it.arr
      const ownAmt = arr[focusIdx]
      const ownPC = pop ? ownAmt / pop : 0
      const peerPC = peerIndices.map(i => (H[i].u ? arr[i] / H[i].u : 0))
      const n = peerPC.length
      const mean = peerPC.reduce((a, b) => a + b, 0) / (n || 1)
      const sd = Math.sqrt(peerPC.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n || 1))
      const max = Math.max(0, ...peerPC)

      if (ownAmt === 0) {
        const zPeers = peerIndices.filter(i => arr[i] === 0).length
        const doPeers = n - zPeers
        return {
          ...it,
          ownAmt,
          ownPC,
          mean,
          sd,
          max,
          n,
          status: zPeers >= n ? 'zeroB' : 'zeroA',
          zPeers,
          doPeers,
        }
      }

      const status: 'good' | 'opp' | 'normal' = ownPC > mean + sd ? 'good' : ownPC < mean ? 'opp' : 'normal'
      const upLow = Math.round(Math.max(0, (mean - ownPC) * pop))
      const upHigh = Math.round(Math.max(0, (max - ownPC) * pop))

      return {
        ...it,
        ownAmt,
        ownPC,
        mean,
        sd,
        max,
        n,
        status,
        upLow,
        upHigh,
      }
    })

    const goodItems = rows.filter(r => r.status === 'good').sort((a, b) => b.ownPC - b.mean - (a.ownPC - a.mean))
    const opportunityItems = rows.filter(r => r.status === 'opp').sort((a, b) => (b.upHigh || 0) - (a.upHigh || 0))
    const zeroActionableItems = rows.filter(r => r.status === 'zeroA').sort((a, b) => (b.doPeers || 0) - (a.doPeers || 0))
    const zeroNeutralItems = rows.filter(r => r.status === 'zeroB')
    const normalCount = rows.filter(r => r.status === 'normal').length

    const totalOpportunityLow = opportunityItems.reduce((acc, r) => acc + (r.upLow || 0), 0)
    const totalOpportunityHigh = opportunityItems.reduce((acc, r) => acc + (r.upHigh || 0), 0)

    const l1Agg = this.buildSourceAggregates(year, 'L1', 0)
    const l2Agg = this.buildSourceAggregates(year, 'L2', 0)
    const totalCompensation = l1Agg.total[focusIdx] > 0 ? l1Agg.total[focusIdx] : l2Agg.total[focusIdx]
    const compensationPerCapita = pop ? totalCompensation / pop : 0

    const peerTotals = peerIndices.map(i => (l1Agg.total[i] > 0 ? l1Agg.total[i] : l2Agg.total[i]))
    const peerPerCapitas = peerIndices.map((i, idx) => (H[i].u ? peerTotals[idx] / H[i].u : 0))
    const sortedPeerPC = [...peerPerCapitas].sort((a, b) => a - b)
    const midIdx = Math.floor(sortedPeerPC.length / 2)
    const peerMedianPerCapita =
      sortedPeerPC.length % 2 !== 0 ? sortedPeerPC[midIdx] : (sortedPeerPC[midIdx - 1] + sortedPeerPC[midIdx]) / 2

    const rankedPeers = [...peerPerCapitas].sort((a, b) => b - a)
    const rankInGroup = rankedPeers.indexOf(compensationPerCapita) + 1

    const allPC = H.map((h, i) => {
      const tot = l1Agg.total[i] > 0 ? l1Agg.total[i] : l2Agg.total[i]
      return h.u ? tot / h.u : 0
    })
    const sortedAllPC = [...allPC].sort((a, b) => b - a)
    const rankInRegion = sortedAllPC.indexOf(compensationPerCapita) + 1

    const peerGroupLabel =
      peerScope === 'm2' ? hospital.g : peerScope === 'province' ? `จังหวัด${hospital.p}` : 'ทั้งเขตสุขภาพที่ 1'

    return {
      year,
      asof: data.asof || '',
      hospital,
      peers: peers.map(p => p.hospital),
      peerGroupLabel,
      goodItems,
      opportunityItems,
      zeroActionableItems,
      zeroNeutralItems,
      normalCount,
      totalOpportunityLow,
      totalOpportunityHigh,
      stats: {
        totalCompensation,
        ucPopulation: hospital.u,
        compensationPerCapita,
        peerMedianPerCapita,
        rankInGroup: rankInGroup > 0 ? rankInGroup : 1,
        groupTotalHospitals: peers.length,
        rankInRegion: rankInRegion > 0 ? rankInRegion : 1,
        regionTotalHospitals: H.length,
      },
    }
  }

  /**
   * ดึงรายการกองทุนตามแหล่งข้อมูล (L1 - L8) พร้อมการเปรียบเทียบในกลุ่ม Scope ที่เลือก
   */
  static getSourceItems(
    year: string,
    sourceId: string,
    hospitalCode: number = THOEN_HOSPITAL_CODE,
    options?: GetSourceItemsOptions
  ): FundOverviewItem[] {
    const data = this.getDataset(year)
    const { hospital, index: focusIdx } = this.getHospitalByCode(year, hospitalCode)
    const peers = this.getPeersByScope(year, hospitalCode, options?.peerScope || 'm2')
    const agg = this.buildSourceAggregates(year, sourceId, 0)

    // สำหรับ L1 ให้ใช้ mains เป็นค่าเริ่มต้น สำหรับแหล่งอื่นใช้ list
    let items = sourceId === 'L1' ? agg.mains : agg.list

    if (options?.search) {
      const q = options.search.toLowerCase()
      items = items.filter((it: Rh1AggregatedItem) => it.name.toLowerCase().includes(q) || it.key.toLowerCase().includes(q))
    }

    if (options?.limit && options.limit > 0) {
      items = items.slice(0, options.limit)
    }

    return items.map((m: Rh1AggregatedItem) => {
      const hospitalAmount = m.arr[focusIdx] || 0
      const hospitalPerCapita = hospital.u ? hospitalAmount / hospital.u : 0

      const peerValues = peers.map(p => {
        const amt = m.arr[p.index] || 0
        const pc = p.hospital.u ? amt / p.hospital.u : 0
        return {
          hospitalCode: p.hospital.c,
          hospitalName: p.hospital.n,
          amount: amt,
          perCapita: pc,
        }
      })

      const totalPeersWithAmount = peerValues.filter(p => p.amount > 0).length
      const peerPCs = peerValues.map(p => p.perCapita)
      const peerMeanPerCapita = peerPCs.reduce((a, b) => a + b, 0) / (peerPCs.length || 1)

      const sortedPC = [...peerPCs].sort((a, b) => a - b)
      const mid = Math.floor(sortedPC.length / 2)
      const peerMedianPerCapita = sortedPC.length % 2 !== 0 ? sortedPC[mid] : (sortedPC[mid - 1] + sortedPC[mid]) / 2

      const sortedDesc = [...peerPCs].sort((a, b) => b - a)
      const rankInGroup = hospitalAmount > 0 ? sortedDesc.indexOf(hospitalPerCapita) + 1 : 0

      return {
        id: m.key,
        name: m.name,
        level: m.lvl,
        mainId: m.main,
        totalAmountInGroup: peerValues.reduce((s, p) => s + p.amount, 0),
        hospitalAmount,
        hospitalPerCapita,
        peerMeanPerCapita,
        peerMedianPerCapita,
        rankInGroup,
        totalPeersWithAmount,
        peerValues,
      }
    })
  }

  // Backward-compatible aliases
  static getFundOverviewL1(year: string, hospitalCode: number = THOEN_HOSPITAL_CODE): FundOverviewItem[] {
    return this.getSourceItems(year, 'L1', hospitalCode, { peerScope: 'm2' })
  }

  static getFundDetailsL2(
    year: string,
    hospitalCode: number = THOEN_HOSPITAL_CODE,
    options?: { search?: string; limit?: number }
  ): FundOverviewItem[] {
    return this.getSourceItems(year, 'L2', hospitalCode, { peerScope: 'm2', search: options?.search, limit: options?.limit })
  }
}
