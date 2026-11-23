'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  Award,
  Lightbulb,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  Coins,
  Filter,
  Check,
  Plus,
  X,
} from 'lucide-react'
import {
  Rh1Dataset,
  THOEN_HOSPITAL_CODE,
  RH1_TABS,
  Rh1TabDefinition,
  Rh1Hospital,
  Rh1AggregatedItem,
  Rh1AggregateResult,
  Rh1BudgetService,
} from '@/lib/budget/rh1BudgetService'
import '../budget-tracker.css'

export interface Rh1BudgetTrackerClientProps {
  datasets: Record<string, Rh1Dataset>
  initialYears: string[]
  defaultYear: string
  defaultHospitalCode: number
}

import { ORDER, heatRGB, heatStyle, rankWithin, calcMedian } from './components/rh1Helpers'
import { Rh1ComparisonViews } from './components/Rh1ComparisonViews'

export default function Rh1BudgetTrackerClient({
  datasets,
  initialYears,
  defaultYear,
  defaultHospitalCode,
}: Rh1BudgetTrackerClientProps) {

  // Selected Fiscal Year
  const [year, setYear] = useState<string>(defaultYear)

  // Current active dataset
  const currentDataset = useMemo(() => {
    return datasets[year] || datasets[initialYears[0]] || datasets['2570']
  }, [datasets, year, initialYears])

  const H = currentDataset.H
  const S = currentDataset.S
  const NH = H.length
  const ALL = useMemo(() => Array.from({ length: NH }, (_, i) => i), [NH])

  // Focus hospital index (default: Thoen Hospital)
  const defaultFocusIdx = useMemo(() => {
    const idx = H.findIndex(h => h.c === defaultHospitalCode)
    return idx !== -1 ? idx : 0
  }, [H, defaultHospitalCode])

  const [focusIdx, setFocusIdx] = useState<number>(defaultFocusIdx)

  // 10 Tabs / Data Source Selection (L2, L3, L4, L5, L6, L7, L8, L1, HP, EXEC)
  const [tabSource, setTabSource] = useState<string>('L2')

  // Secondary Source Selection for Tab 9 (HP Detailed view)
  const [dsrc, setDsrc] = useState<string>('L2')
  const [dlvl, setDlvl] = useState<'m' | 's'>('m')

  // Part index for L3
  const [part, setPart] = useState<number>(0)

  // Filter Mode & Scopes
  const [mode, setMode] = useState<'filter' | 'custom'>('filter')
  const [filterP, setFilterP] = useState<string>('all')
  const [filterL, setFilterL] = useState<string>('all')
  const [filterG, setFilterG] = useState<string>('all')
  const [customPeers, setCustomPeers] = useState<number[]>([])

  // Analytics & View States
  const [metric, setMetric] = useState<'pc' | 'amt'>('pc') // 'pc' = per capita / per visit, 'amt' = total amount
  const [selectedItemKey, setSelectedItemKey] = useState<string>('all')
  const [view, setView] = useState<'rk' | 'grp' | 'mx'>('rk') // 'rk' = rank, 'grp' = compare groups, 'mx' = matrix
  const [cdim, setCdim] = useState<'l' | 'p' | 'g'>('l')
  const [matrixLvl, setMatrixLvl] = useState<'m' | 's'>('m')

  // Filter option arrays
  const provinces = useMemo(() => Array.from(new Set(H.map(h => h.p))), [H])
  const levels = useMemo(() => ORDER.l.filter(l => H.some(h => h.l === l)), [H])
  const groups = useMemo(() => ORDER.g.filter(g => H.some(h => h.g === g)), [H])

  // Hospital matching filter rule
  const matchF = useMemo(() => {
    return (i: number, skipDim?: 'p' | 'l' | 'g') => {
      if (skipDim !== 'p' && filterP !== 'all' && H[i].p !== filterP) return false
      if (skipDim !== 'l' && filterL !== 'all' && H[i].l !== filterL) return false
      if (skipDim !== 'g' && filterG !== 'all' && H[i].g !== filterG) return false
      return true
    }
  }, [H, filterP, filterL, filterG])

  // Counts for each filter option
  const cntFilter = (type: 'p' | 'l' | 'g', val: string) => {
    if (val === 'all') return ALL.filter(i => matchF(i, type)).length
    const prop = type === 'p' ? 'p' : type === 'l' ? 'l' : 'g'
    return ALL.filter(i => matchF(i, type) && H[i][prop] === val).length
  }

  // L7 Excluded Hospitals check (A, S, รพ.เชียงคำ, รพ.สันป่าตอง)
  const isExcl7 = useMemo(() => {
    return (h: Rh1Hospital) => h.l === 'A' || h.l === 'S' || h.n === 'รพ.เชียงคำ' || h.n === 'รพ.สันป่าตอง'
  }, [])

  // Base peers calculation
  const basePeerIndices = useMemo(() => {
    let list: number[] = []
    if (mode === 'custom') {
      list = customPeers.slice()
    } else {
      list = ALL.filter(i => matchF(i))
    }
    if (tabSource === 'L7') {
      list = list.filter(i => !isExcl7(H[i]))
    }
    return list
  }, [mode, customPeers, ALL, matchF, tabSource, isExcl7, H])

  // Effective peers list with focused hospital pinned
  const peerIndices = useMemo(() => {
    const list = [...basePeerIndices]
    if (focusIdx !== null && !list.includes(focusIdx)) {
      if (!(tabSource === 'L7' && isExcl7(H[focusIdx]))) {
        list.push(focusIdx)
      }
    }
    return list
  }, [basePeerIndices, focusIdx, tabSource, isExcl7, H])

  // Formatter helpers
  const formatMoney = (val?: number) => {
    if (val === undefined || isNaN(val)) return '0.00'
    return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  }

  const formatShortMoney = (val?: number) => {
    if (!val) return '0 บาท'
    if (val >= 1_000_000) {
      return (val / 1_000_000).toFixed(2) + ' ล้านบาท'
    }
    return new Intl.NumberFormat('th-TH').format(Math.round(val)) + ' บาท'
  }

  const isLM = tabSource === 'L7' || tabSource === 'L8'

  // Build Aggregates for the current source
  const sourceAggregate: Rh1AggregateResult = useMemo(() => {
    const sId = (tabSource === 'EXEC' || tabSource === 'HP') ? 'L1' : tabSource
    const s = S[sId]
    if (!s) {
      return { list: [], map: new Map(), mains: [], subsBy: {}, total: new Float64Array(NH), flat: false }
    }

    const F = new Map<string, Rh1AggregatedItem>()
    const total = new Float64Array(NH)
    const mainInfo: Record<string, { id: string; name: string }> = {}
    s.mains?.forEach(m => {
      mainInfo[m.id] = m
    })

    const getOrInit = (key: string, name: string, lvl: 'm' | 's', main: string) => {
      let f = F.get(key)
      if (!f) {
        f = { key, name, lvl, main, arr: new Float64Array(NH), sum: 0 }
        F.set(key, f)
      }
      return f
    }

    const partIdx = sId === 'L3' ? part : 0
    const vi = 2 + partIdx

    s.recs.forEach(r => {
      if (sId === 'L7' && isExcl7(H[r[0]])) return
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

    return { list, map, mains, subsBy, total, flat: s.flat }
  }, [tabSource, S, NH, H, isExcl7, part])

  // Get active amount vector for the chosen fund/item
  const amtVector = useMemo(() => {
    if (tabSource === 'L7' || tabSource === 'L8') {
      const lm = Rh1BudgetService.getLmMeasurements(year, tabSource)
      return lm.opA
    }
    if (selectedItemKey === 'all') {
      return sourceAggregate.total
    }
    const item = sourceAggregate.map.get(selectedItemKey)
    return item ? item.arr : sourceAggregate.total
  }, [tabSource, year, selectedItemKey, sourceAggregate])

  // Calculate per-capita / per-visit vector
  const pcVector = useMemo(() => {
    if (tabSource === 'L7' || tabSource === 'L8') {
      const lm = Rh1BudgetService.getLmMeasurements(year, tabSource)
      return lm.opVisit
    }
    const pc = new Float64Array(NH)
    for (let i = 0; i < NH; i++) {
      pc[i] = H[i].u ? amtVector[i] / H[i].u : 0
    }
    return pc
  }, [tabSource, year, NH, H, amtVector])

  // Calculate ranks
  const ranksData = useMemo(() => {
    const rkAmt = new Int16Array(NH)
    const nA = rankWithin(amtVector, peerIndices, rkAmt)

    const rkPC = new Int16Array(NH)
    const nP = rankWithin(pcVector, peerIndices, rkPC)

    const primVec = metric === 'pc' ? pcVector : amtVector
    const rkReg = new Int16Array(NH)
    const nR = rankWithin(primVec, ALL, rkReg)

    const nonZeroPCs = peerIndices.filter(i => pcVector[i] !== 0).map(i => pcVector[i])
    const medPC = calcMedian(nonZeroPCs)
    const minPC = nonZeroPCs.length ? Math.min(...nonZeroPCs) : 0
    const maxPC = nonZeroPCs.length ? Math.max(...nonZeroPCs) : 0

    return {
      A: { rk: rkAmt, n: nA },
      P: { rk: rkPC, n: nP, med: medPC, min: minPC, max: maxPC },
      R: { rk: rkReg, n: nR },
    }
  }, [amtVector, pcVector, peerIndices, ALL, metric, NH])

  // Group label text
  const groupLabelText = useMemo(() => {
    if (mode === 'custom') {
      return `รพ. ที่เลือกเอง (${customPeers.length} แห่ง)`
    }
    const parts: string[] = []
    if (filterP !== 'all') parts.push(`จ.${filterP}`)
    if (filterL !== 'all') parts.push(`ขนาด ${filterL}`)
    if (filterG !== 'all') parts.push(filterG)
    return parts.length ? parts.join(' · ') : 'ทั้งเขตสุขภาพที่ 1 (103 แห่ง)'
  }, [mode, customPeers, filterP, filterL, filterG])

  // Tab 9 (HP: สรุปข้อมูลวิเคราะห์รายโรงพยาบาล ทุกแหล่งข้อมูล) Data Engine
  const hpData = useMemo(() => {
    const SIDS = ['L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L1'] as const
    const metricPc = metric === 'pc'

    const SV = SIDS.map(id => {
      let amt: Float64Array
      let pc: Float64Array
      const isSrcLM = id === 'L7' || id === 'L8'

      if (isSrcLM) {
        const lm = Rh1BudgetService.getLmMeasurements(year, id)
        amt = lm.opA
        pc = lm.opVisit
      } else {
        const b = Rh1BudgetService.buildSourceAggregates(year, id, 0)
        amt = b.total
        const pcv = new Float64Array(NH)
        for (let i = 0; i < NH; i++) {
          pcv[i] = H[i].u ? amt[i] / H[i].u : 0
        }
        pc = pcv
      }

      const vals = metricPc ? pc : amt
      const rk = new Int16Array(NH)
      const n = rankWithin(vals, peerIndices, rk)
      const rkRegion = new Int16Array(NH)
      const nRegion = rankWithin(vals, ALL, rkRegion)

      const nonZeroPeerVals = peerIndices.filter(i => vals[i] !== 0).map(i => vals[i])
      const med = calcMedian(nonZeroPeerVals)

      return { id, amt, pc, vals, rk, n, rkRegion, nRegion, med }
    })

    // Section 1: 8 source rows for focused hospital
    const srcRows = SIDS.map((id, k) => {
      const s = SV[k]
      const mineAmt = s.amt[focusIdx] || 0
      const mineVal = s.vals[focusIdx] || 0
      const minePC = s.pc[focusIdx] || 0
      const mineRk = s.rk[focusIdx] || 0
      const mineRkReg = s.rkRegion[focusIdx] || 0
      const med = s.med
      const diffPct = med && mineVal !== 0 ? ((mineVal / med - 1) * 100) : 0
      const normPos = s.n > 1 && mineRk > 0 ? 1 - (mineRk - 1) / (s.n - 1) : 0.5
      const othersWithAmount = peerIndices.filter(j => j !== focusIdx && s.vals[j] !== 0).length

      const tabDef = RH1_TABS.find(t => t.id === id)
      return {
        id,
        title: tabDef?.title || id,
        sub: tabDef?.sub || id,
        name: `${tabDef?.title} (${tabDef?.sub})${id === 'L7' || id === 'L8' ? ' — OP ต่อครั้ง' : ''}`,
        mineAmt,
        mineVal,
        minePC,
        mineRk,
        n: s.n,
        mineRkReg,
        nRegion: s.nRegion,
        med,
        diffPct,
        normPos,
        othersWithAmount,
        hasAmount: mineVal !== 0,
      }
    })

    // Section 2: Detailed breakdown of selected dsrc
    const isDsrcLM = dsrc === 'L7' || dsrc === 'L8'
    let dTot = { name: '', mineAmt: 0, mineVal: 0, rk: 0, n: 0, rkReg: 0, med: 0, diffPct: 0, normPos: 0.5, hasAmount: false }
    let dItems: { name: string; mineAmt: number; mineVal: number; rk: number; n: number; rkReg: number; med: number; diffPct: number; normPos: number; hasAmount: boolean; others: number }[] = []

    if (isDsrcLM) {
      const lm = Rh1BudgetService.getLmMeasurements(year, dsrc as 'L7' | 'L8')
      const rk = new Int16Array(NH)
      const n = rankWithin(lm.opVisit, peerIndices, rk)
      const rkReg = new Int16Array(NH)
      rankWithin(lm.opVisit, ALL, rkReg)
      const med = calcMedian(peerIndices.filter(i => lm.opVisit[i] !== 0).map(i => lm.opVisit[i]))
      const mineVal = lm.opVisit[focusIdx] || 0
      const has = mineVal !== 0
      dTot = {
        name: 'OP ต่อครั้ง (ยอด OP ÷ OP visit)',
        mineAmt: lm.opA[focusIdx] || 0,
        mineVal,
        rk: rk[focusIdx] || 0,
        n,
        rkReg: rkReg[focusIdx] || 0,
        med,
        diffPct: med && has ? ((mineVal / med - 1) * 100) : 0,
        normPos: n > 1 && rk[focusIdx] > 0 ? 1 - (rk[focusIdx] - 1) / (n - 1) : 0.5,
        hasAmount: has,
      }
    } else {
      const b = Rh1BudgetService.buildSourceAggregates(year, dsrc, 0)
      const pcv = new Float64Array(NH)
      for (let i = 0; i < NH; i++) pcv[i] = H[i].u ? b.total[i] / H[i].u : 0
      const rk = new Int16Array(NH)
      const n = rankWithin(pcv, peerIndices, rk)
      const rkReg = new Int16Array(NH)
      rankWithin(pcv, ALL, rkReg)
      const med = calcMedian(peerIndices.filter(i => pcv[i] !== 0).map(i => pcv[i]))
      const mineVal = pcv[focusIdx] || 0
      const has = mineVal !== 0

      dTot = {
        name: S[dsrc]?.allLabel || 'รวมทั้งหมด',
        mineAmt: b.total[focusIdx] || 0,
        mineVal,
        rk: rk[focusIdx] || 0,
        n,
        rkReg: rkReg[focusIdx] || 0,
        med,
        diffPct: med && has ? ((mineVal / med - 1) * 100) : 0,
        normPos: n > 1 && rk[focusIdx] > 0 ? 1 - (rk[focusIdx] - 1) / (n - 1) : 0.5,
        hasAmount: has,
      }

      const activeLvl = b.flat ? 'm' : dlvl
      const candidateItems = b.list.filter(f => f.lvl === activeLvl)
      dItems = candidateItems.map(f => {
        const itemPcv = new Float64Array(NH)
        for (let i = 0; i < NH; i++) itemPcv[i] = H[i].u ? f.arr[i] / H[i].u : 0
        const itemRk = new Int16Array(NH)
        const itemN = rankWithin(itemPcv, peerIndices, itemRk)
        const itemRkReg = new Int16Array(NH)
        rankWithin(itemPcv, ALL, itemRkReg)
        const itemMed = calcMedian(peerIndices.filter(i => itemPcv[i] !== 0).map(i => itemPcv[i]))
        const val = itemPcv[focusIdx] || 0
        const itemHas = val !== 0
        const others = peerIndices.filter(j => j !== focusIdx && itemPcv[j] !== 0).length

        return {
          name: f.name,
          mineAmt: f.arr[focusIdx] || 0,
          mineVal: val,
          rk: itemRk[focusIdx] || 0,
          n: itemN,
          rkReg: itemRkReg[focusIdx] || 0,
          med: itemMed,
          diffPct: itemMed && itemHas ? ((val / itemMed - 1) * 100) : 0,
          normPos: itemN > 1 && itemRk[focusIdx] > 0 ? 1 - (itemRk[focusIdx] - 1) / (itemN - 1) : 0.5,
          hasAmount: itemHas,
          others,
        }
      }).filter(r => r.mineVal !== 0 || r.others > 0)
    }

    // Section 3: Cross-source matrix rows (peer hospitals × 8 sources)
    const mxPeerRows = peerIndices.map(i => {
      return {
        i,
        hospital: H[i],
        sourceCells: SV.map(s => {
          const amt = s.amt[i] || 0
          const pc = s.pc[i] || 0
          const val = metricPc ? pc : amt
          const rk = s.rk[i] || 0
          const n = s.n
          return { id: s.id, amt, pc, val, rk, n }
        }),
      }
    })

    // Focused hospital always at top, then sort by first source
    mxPeerRows.sort((a, b) => {
      if (a.i === focusIdx) return -1
      if (b.i === focusIdx) return 1
      return (b.sourceCells[0]?.val || 0) - (a.sourceCells[0]?.val || 0)
    })

    return { SV, srcRows, dTot, dItems, mxPeerRows }
  }, [year, H, NH, ALL, peerIndices, focusIdx, metric, dsrc, dlvl, S])

  // Tab 10 (EXEC: บทสรุปผู้บริหาร) Data Engine
  const execData = useMemo(() => {
    const focus = focusIdx
    const pop = H[focus]?.u || 1

    const EXEC_SCOPE = [
      { src: 'L1', label: 'L1_budget', only: ['กองทุนเอดส์', 'ค่าบริการฟื้นฟูสมรรถภาพด้านการแพทย์', 'งบแพทย์แผนไทย'] },
      {
        src: 'L2',
        label: 'L2_statementuc',
        minPC: 2,
        exclude: ['OPCS', 'OPLG', 'IPCS', 'IPLG', 'OPKTMN', 'IPKTMN', 'OTKTMN', 'DM22', 'OTCS', 'OTLG'],
      },
      { src: 'L5', label: 'L5_moph_2205' },
      { src: 'L6', label: 'L6_ktp_2263' },
    ]

    const items: { id: string; src: string; name: string; arr: Float64Array }[] = []
    const totalPop = ALL.reduce((s, i) => s + H[i].u, 0)

    EXEC_SCOPE.forEach(sc => {
      const s = S[sc.src]
      if (!s) return
      const F = new Map<string, { main: string; name: string; arr: Float64Array; sum: number }>()
      const mainInfo: Record<string, { id: string; name: string }> = {}
      s.mains?.forEach(m => (mainInfo[m.id] = m))

      s.recs.forEach(r => {
        const k = s.keys[r[1]]
        if (!k) return
        const v = r[2] || 0
        const h = r[0]
        let f = F.get(k.m)
        if (!f) {
          f = { main: k.m, name: mainInfo[k.m]?.name || k.m, arr: new Float64Array(NH), sum: 0 }
          F.set(k.m, f)
        }
        f.arr[h] += v
        f.sum += v
      })

      Array.from(F.values()).forEach(f => {
        if (sc.exclude && sc.exclude.includes(f.main)) return
        items.push({ id: `${sc.src}:${f.main}`, src: sc.label, name: f.name, arr: f.arr })
      })
    })

    const rows = items.map(it => {
      const ownAmt = it.arr[focus]
      const ownPC = pop ? ownAmt / pop : 0
      const peerPCs = peerIndices.map(i => (H[i].u ? it.arr[i] / H[i].u : 0))
      const n = peerPCs.length
      const mean = peerPCs.reduce((a, b) => a + b, 0) / (n || 1)
      const sd = Math.sqrt(peerPCs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n || 1))
      const max = Math.max(0, ...peerPCs)

      if (ownAmt === 0) {
        const zPeers = peerIndices.filter(i => it.arr[i] === 0).length
        return {
          ...it,
          ownAmt,
          ownPC,
          mean,
          max,
          status: zPeers >= n ? 'zeroB' : 'zeroA',
          doPeers: n - zPeers,
          upLow: 0,
          upHigh: Math.round(max * pop),
        }
      }

      const status = ownPC > mean + sd ? 'good' : ownPC < mean ? 'opp' : 'normal'
      return {
        ...it,
        ownAmt,
        ownPC,
        mean,
        max,
        status,
        doPeers: 0,
        upLow: Math.round(Math.max(0, (mean - ownPC) * pop)),
        upHigh: Math.round(Math.max(0, (max - ownPC) * pop)),
      }
    })

    const good = rows.filter(r => r.status === 'good').sort((a, b) => b.ownPC - b.mean - (a.ownPC - a.mean))
    const opp = rows.filter(r => r.status === 'opp').sort((a, b) => (b.upHigh || 0) - (a.upHigh || 0))
    const zeroA = rows.filter(r => r.status === 'zeroA').sort((a, b) => (b.doPeers || 0) - (a.doPeers || 0))
    const totalOppHigh = opp.reduce((s, r) => s + (r.upHigh || 0), 0)

    return { good, opp, zeroA, totalOppHigh }
  }, [focusIdx, H, ALL, S, NH, peerIndices])

  // Sorted Ranking rows
  const rankingRows = useMemo(() => {
    const rows = peerIndices.map(i => {
      const amt = amtVector[i]
      const pc = pcVector[i]
      const ra = ranksData.A.rk[i] || 0
      const rp = ranksData.P.rk[i] || 0
      const rr = ranksData.R.rk[i] || 0
      return { i, amt, pc, ra, rp, rr }
    })

    rows.sort((a, b) => {
      if (metric === 'pc') {
        return (a.rp || 9999) - (b.rp || 9999)
      }
      return (a.ra || 9999) - (b.ra || 9999)
    })

    return rows
  }, [peerIndices, amtVector, pcVector, ranksData, metric])

  // Group comparison rows
  const groupCompareRows = useMemo(() => {
    const dimProp = cdim === 'p' ? 'p' : cdim === 'l' ? 'l' : 'g'
    const dimKeys = cdim === 'p' ? provinces : cdim === 'l' ? levels : groups

    const res = dimKeys.map(k => {
      const grpIndices = ALL.filter(i => H[i][dimProp] === k)
      const grpPop = grpIndices.reduce((s, i) => s + H[i].u, 0)
      const grpAmt = grpIndices.reduce((s, i) => s + amtVector[i], 0)
      const grpPC = grpPop ? grpAmt / grpPop : 0
      return {
        key: k,
        label: cdim === 'l' ? `ขนาด ${k}` : k,
        count: grpIndices.length,
        pop: grpPop,
        amt: grpAmt,
        pc: grpPC,
      }
    })

    res.sort((a, b) => (metric === 'pc' ? b.pc - a.pc : b.amt - a.amt))
    return res
  }, [cdim, provinces, levels, groups, ALL, H, amtVector, metric])

  const focusedHospital = H[focusIdx] || H[0]

  return (
    <div className="bt-rh1-content">
      {/* Compact Focus Hospital Banner with Integrated Fiscal Year Controls */}
      <div className="bt-focus-banner">
        <div className="bt-focus-info">
          <div className="bt-focus-top-badges">
            <span className="bt-focus-pill">หน่วยบริการที่โฟกัส</span>
            <span className="bt-focus-title">
              <span>{focusedHospital.n}</span>
              <span className="bt-focus-level">
                (รหัส {focusedHospital.c}) · จ.{focusedHospital.p} · ขนาด {focusedHospital.l}
              </span>
            </span>
            {currentDataset.asof && <span className="bt-focus-asof">({currentDataset.asof})</span>}
          </div>
          <div className="bt-focus-meta-row">
            <span>
              เตียงจริง: <b className="bt-focus-meta-val">{focusedHospital.b} เตียง</b>
            </span>
            <span>•</span>
            <span>
              ประชากร UC: <b className="bt-focus-meta-val">{new Intl.NumberFormat().format(focusedHospital.u)} คน</b>
            </span>
            <span>•</span>
            <span>
              กลุ่มเปรียบเทียบมาตรฐาน:{' '}
              <b className="bt-focus-meta-highlight">{focusedHospital.g}</b> ({ALL.filter(i => H[i].g === focusedHospital.g).length} แห่งในกลุ่ม)
            </span>
          </div>
        </div>

        {/* Right side: Year Switcher & Quick Reset */}
        <div className="bt-focus-actions">
          {focusIdx !== defaultFocusIdx && (
            <button
              type="button"
              onClick={() => setFocusIdx(defaultFocusIdx)}
              className="bt-focus-reset-btn"
              title="รีเซ็ตกลับมาที่โรงพยาบาลเถิน"
            >
              ↺ กลับมา รพ.เถิน (11152)
            </button>
          )}

          {/* Fiscal Year Switcher */}
          <div className="bt-year-control">
            <span className="bt-year-label">
              <Calendar size={14} />
              <span>ปีงบประมาณ:</span>
            </span>
            <div className="bt-year-buttons">
              {initialYears.map(y => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setYear(y)}
                  className={`bt-year-btn ${year === y ? 'active' : ''}`}
                >
                  <span>{y}</span>
                  {y === '2570' && <span className="bt-year-pill-new">ใหม่</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

            {/* ============================================================ */}
            {/* 10-TAB NAVIGATION BAR (Exact 10 Sources / Views)             */}
            {/* ============================================================ */}
            <div className="bt-tabs-nav" role="tablist" aria-label="10 หมวดข้อมูลและสรุปผลงาน">
              {RH1_TABS.map(tab => {
                const isActive = tabSource === tab.id
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    type="button"
                    aria-selected={isActive}
                    onClick={() => {
                      setTabSource(tab.id)
                      setSelectedItemKey('all')
                    }}
                    className={`bt-tab-nav-btn ${isActive ? 'active' : ''}`}
                  >
                    <b>{tab.title}</b>
                    <small>{tab.sub}</small>
                  </button>
                )
              })}
            </div>

            {/* ============================================================ */}
            {/* COMPLETE MISHOS-RH1 FILTER BAR (Exact Controls)              */}
            {/* ============================================================ */}
            <div className="bt-bar">
              {/* Row 1: Groups, Filter Dimensions, Focus */}
              <div className="bt-ctls">
                {/* 1. หมวดข้อมูล / แหล่งงบประมาณ */}
                <div className="bt-ctl">
                  <label htmlFor="tab-source">หมวดข้อมูล / แหล่งงบประมาณ</label>
                  <select
                    id="tab-source"
                    value={tabSource}
                    onChange={e => {
                      setTabSource(e.target.value)
                      setSelectedItemKey('all')
                    }}
                    className="bt-select"
                    style={{ fontWeight: 700, color: '#0369a1', minWidth: '280px' }}
                  >
                    {RH1_TABS.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. กลุ่มเปรียบเทียบ (Mode) */}
                <div className="bt-ctl">
                  <span className="bt-ctl-label">กลุ่มเปรียบเทียบ</span>
                  <div className="bt-seg" role="group">
                    <button
                      type="button"
                      aria-pressed={mode === 'filter'}
                      onClick={() => setMode('filter')}
                    >
                      ตามตัวกรอง
                    </button>
                    <button
                      type="button"
                      aria-pressed={mode === 'custom'}
                      onClick={() => setMode('custom')}
                    >
                      เลือก รพ. เอง
                    </button>
                  </div>
                </div>

                {mode === 'filter' ? (
                  <>
                    {/* 3. จังหวัด */}
                    <div className="bt-ctl">
                      <label htmlFor="fp">จังหวัด</label>
                      <select
                        id="fp"
                        value={filterP}
                        onChange={e => setFilterP(e.target.value)}
                        className="bt-select"
                      >
                        <option value="all">ทุกจังหวัด ({cntFilter('p', 'all')})</option>
                        {provinces.map(p => {
                          const c = cntFilter('p', p)
                          return (
                            <option key={p} value={p} disabled={c === 0}>
                              {p} ({c})
                            </option>
                          )
                        })}
                      </select>
                    </div>

                    {/* 4. ขนาด (A–F3) */}
                    <div className="bt-ctl">
                      <label htmlFor="fl">ขนาด (A–F3)</label>
                      <select
                        id="fl"
                        value={filterL}
                        onChange={e => setFilterL(e.target.value)}
                        className="bt-select"
                      >
                        <option value="all">ทุกขนาด ({cntFilter('l', 'all')})</option>
                        {levels.map(l => {
                          const c = cntFilter('l', l)
                          return (
                            <option key={l} value={l} disabled={c === 0}>
                              ขนาด {l} ({c})
                            </option>
                          )
                        })}
                      </select>
                    </div>

                    {/* 5. กลุ่มระดับบริการ (GroupName) */}
                    <div className="bt-ctl">
                      <label htmlFor="fg">กลุ่มระดับบริการ (GroupName)</label>
                      <select
                        id="fg"
                        value={filterG}
                        onChange={e => setFilterG(e.target.value)}
                        className="bt-select"
                        style={{ maxWidth: '270px' }}
                      >
                        <option value="all">ทุกกลุ่ม ({cntFilter('g', 'all')})</option>
                        {groups.map(g => {
                          const c = cntFilter('g', g)
                          return (
                            <option key={g} value={g} disabled={c === 0}>
                              {g} ({c})
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  </>
                ) : (
                  /* Custom Hospital Picker */
                  <div className="bt-ctl" style={{ minWidth: '320px' }}>
                    <label htmlFor="add-hosp">เพิ่ม รพ. เข้ากลุ่มเปรียบเทียบ</label>
                    <select
                      id="add-hosp"
                      value=""
                      onChange={e => {
                        const idx = parseInt(e.target.value, 10)
                        if (!isNaN(idx) && !customPeers.includes(idx)) {
                          setCustomPeers([...customPeers, idx])
                        }
                      }}
                      className="bt-select"
                    >
                      <option value="">+ เลือก รพ. เพื่อเพิ่มเข้ากลุ่ม...</option>
                      {ALL.filter(i => !customPeers.includes(i)).map(i => (
                        <option key={H[i].c} value={i}>
                          {H[i].c} · {H[i].n} ({H[i].p})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 6. โฟกัส รพ. */}
                <div className="bt-ctl" style={{ minWidth: '260px' }}>
                  <label htmlFor="focus-in">โฟกัส รพ. (ปักหมุดไว้ซ้าย/บนสุด)</label>
                  <select
                    id="focus-in"
                    value={focusIdx}
                    onChange={e => setFocusIdx(parseInt(e.target.value, 10))}
                    className="bt-select"
                  >
                    <optgroup label="โรงพยาบาลเป้าหมาย">
                      <option value={defaultFocusIdx}>รพ.เถิน (ลำปาง · M2)</option>
                    </optgroup>
                    <optgroup label="โรงพยาบาลทั้งหมด (103 แห่ง)">
                      {ALL.map(i => (
                        <option key={H[i].c} value={i}>
                          {H[i].c} · {H[i].n} ({H[i].p})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Custom Hospital Chips */}
              {mode === 'custom' && customPeers.length > 0 && (
                <div className="bt-chips">
                  {customPeers.map(i => (
                    <span key={H[i].c} className="bt-chip">
                      <span className="bt-chip-code">{H[i].c}</span>
                      <span>{H[i].n}</span>
                      <button
                        type="button"
                        className="bt-chip-del"
                        onClick={() => setCustomPeers(customPeers.filter(p => p !== i))}
                        title="ลบออก"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCustomPeers([])}
                    style={{ fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    ล้างทั้งหมด
                  </button>
                </div>
              )}

              {/* Row 2: Analytics, Fund/Item, Views (for Sources L1-L8) */}
              {tabSource !== 'EXEC' && tabSource !== 'HP' && (
                <div className="bt-ctls" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                  {/* วิเคราะห์แบบ (Metric) */}
                  <div className="bt-ctl">
                    <span className="bt-ctl-label">วิเคราะห์แบบ</span>
                    <div className="bt-seg" role="group">
                      <button
                        type="button"
                        aria-pressed={metric === 'pc'}
                        onClick={() => setMetric('pc')}
                      >
                        {isLM ? 'ยอดชดเชยรายครั้ง OP (บาท/visit)' : 'ต่อหัว UC (บาท/คน)'}
                      </button>
                      <button
                        type="button"
                        aria-pressed={metric === 'amt'}
                        onClick={() => setMetric('amt')}
                      >
                        ยอดเงินรวม (บาท)
                      </button>
                    </div>
                  </div>

                  {/* กองทุน / รายการ */}
                  {!isLM && (
                    <div className="bt-ctl" style={{ minWidth: '280px', flex: '1 1 280px' }}>
                      <label htmlFor="item-select">กองทุน / รายการ</label>
                      <select
                        id="item-select"
                        value={selectedItemKey}
                        onChange={e => setSelectedItemKey(e.target.value)}
                        className="bt-select"
                      >
                        <option value="all">รวมทุกกองทุน / ทั้งหมด</option>
                        {sourceAggregate.flat ? (
                          sourceAggregate.mains.map(m => (
                            <option key={m.key} value={m.key}>
                              {m.name}
                            </option>
                          ))
                        ) : (
                          sourceAggregate.mains.map(m => {
                            const subs = sourceAggregate.subsBy[m.main] || []
                            if (subs.length <= 1) {
                              return (
                                <option key={m.key} value={m.key}>
                                  {m.name}
                                </option>
                              )
                            }
                            return (
                              <optgroup key={m.key} label={m.name}>
                                <option value={m.key}>ทั้งกองทุน ({m.name})</option>
                                {subs.map(s => (
                                  <option key={s.key} value={s.key}>
                                    {s.name}
                                  </option>
                                ))}
                              </optgroup>
                            )
                          })
                        )}
                      </select>
                    </div>
                  )}

                  {/* L3 Parts selector */}
                  {tabSource === 'L3' && S.L3?.parts && S.L3.parts.length > 1 && (
                    <div className="bt-ctl">
                      <label htmlFor="part-sel">ส่วนข้อมูล</label>
                      <select
                        id="part-sel"
                        value={part}
                        onChange={e => setPart(parseInt(e.target.value, 10))}
                        className="bt-select"
                      >
                        {S.L3.parts.map((p, idx) => (
                          <option key={idx} value={idx}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* มุมมอง (View) */}
                  <div className="bt-ctl">
                    <span className="bt-ctl-label">มุมมอง</span>
                    <div className="bt-seg" role="group">
                      <button
                        type="button"
                        aria-pressed={view === 'rk'}
                        onClick={() => setView('rk')}
                      >
                        อันดับ รพ.
                      </button>
                      <button
                        type="button"
                        aria-pressed={view === 'grp'}
                        onClick={() => setView('grp')}
                      >
                        เทียบระหว่างกลุ่ม
                      </button>
                      <button
                        type="button"
                        aria-pressed={view === 'mx'}
                        onClick={() => setView('mx')}
                      >
                        {isLM ? 'ตัวชี้วัด × รพ.' : 'รายการ × รพ. (Heatmap)'}
                      </button>
                    </div>
                  </div>

                  {/* เทียบระหว่างกลุ่มตาม */}
                  {view === 'grp' && (
                    <div className="bt-ctl">
                      <label htmlFor="cdim">เทียบระหว่างกลุ่มตาม</label>
                      <select
                        id="cdim"
                        value={cdim}
                        onChange={e => setCdim(e.target.value as 'l' | 'p' | 'g')}
                        className="bt-select"
                      >
                        <option value="l">ตามขนาด (A–F3)</option>
                        <option value="p">ตามจังหวัด</option>
                        <option value="g">ตามกลุ่มระดับบริการ (GroupName)</option>
                      </select>
                    </div>
                  )}

                  {/* Matrix: ระดับกองทุน */}
                  {view === 'mx' && !sourceAggregate.flat && !isLM && (
                    <div className="bt-ctl">
                      <span className="bt-ctl-label">ระดับกองทุน</span>
                      <div className="bt-seg" role="group">
                        <button
                          type="button"
                          aria-pressed={matrixLvl === 'm'}
                          onClick={() => setMatrixLvl('m')}
                        >
                          กองทุนหลัก
                        </button>
                        <button
                          type="button"
                          aria-pressed={matrixLvl === 's'}
                          onClick={() => setMatrixLvl('s')}
                        >
                          รายการย่อย
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Context Summary Line */}
              <div className="bt-ctx">
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div>
                    {tabSource === 'EXEC' ? (
                      <span>
                        <b>บทสรุปผู้บริหารรายโรงพยาบาล: {focusedHospital.n}</b> · กลุ่มเปรียบเทียบมาตรฐาน: <b>{focusedHospital.g}</b> ({peerIndices.length} แห่ง)
                      </span>
                    ) : tabSource === 'HP' ? (
                      <span>
                        <b>สรุปข้อมูลวิเคราะห์รายโรงพยาบาล: {focusedHospital.n}</b> · ทุกแหล่งข้อมูล · กลุ่มเปรียบเทียบ: <b>{groupLabelText}</b> ({peerIndices.length} แห่ง) · วิเคราะห์แบบ <b>{metric === 'pc' ? 'ต่อหัว UC / OP ต่อครั้ง' : 'ยอดเงินรวม'}</b>
                      </span>
                    ) : (
                      <span>
                        <b>{RH1_TABS.find(t => t.id === tabSource)?.title}</b> ({RH1_TABS.find(t => t.id === tabSource)?.sub}) · {RH1_TABS.find(t => t.id === tabSource)?.itemLabel}:{' '}
                        <b>{selectedItemKey === 'all' ? (sourceAggregate.flat ? 'รวมทุกรายการ' : 'รวมทุกกองทุน / ทั้งหมด') : (sourceAggregate.map.get(selectedItemKey)?.name || selectedItemKey)}</b> · กลุ่มเปรียบเทียบ: <b>{groupLabelText}</b> ({peerIndices.length} แห่ง)
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {RH1_TABS.find(t => t.id === tabSource)?.note}
                  </span>
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* CONTENT AREA: 10 Tabs Dispatcher                               */}
            {/* ============================================================== */}

            {tabSource === 'EXEC' ? (
              /* --- TAB 10: บทสรุปผู้บริหารรายโรงพยาบาล (EXEC) --- */
              <div>
                {/* 4 Stat KPI Cards */}
                <div className="bt-stat-grid">
                  <div className="bt-stat-card bt-stat-card-sky">
                    <div className="bt-stat-label-row">
                      <span>ยอดชดเชยรวม (ปี {year})</span>
                    </div>
                    <div className="bt-stat-value">
                      {formatMoney(amtVector[focusIdx])}
                      <span className="bt-stat-unit">บาท</span>
                    </div>
                    <div className="bt-stat-footer">
                      เฉลี่ยต่อหัว UC: <b className="bt-stat-strong">{formatMoney(pcVector[focusIdx])}</b> บาท/คน
                    </div>
                  </div>

                  <div className="bt-stat-card bt-stat-card-emerald">
                    <div className="bt-stat-label-row">
                      <span>อันดับในกลุ่มเปรียบเทียบ</span>
                    </div>
                    <div className="bt-stat-value">
                      อันดับ {ranksData.P.rk[focusIdx] || '–'}
                      <span className="bt-stat-unit">/ {ranksData.P.n} รพ.</span>
                    </div>
                    <div className="bt-stat-footer">
                      มัธยฐานกลุ่ม: <b className="bt-stat-strong">{formatMoney(ranksData.P.med)}</b> บาท/คน
                    </div>
                  </div>

                  <div className="bt-stat-card bt-stat-card-indigo">
                    <div className="bt-stat-label-row">
                      <span>อันดับทั้งเขตสุขภาพที่ 1</span>
                    </div>
                    <div className="bt-stat-value">
                      อันดับ {ranksData.R.rk[focusIdx] || '–'}
                      <span className="bt-stat-unit">/ {ranksData.R.n} แห่ง</span>
                    </div>
                    <div className="bt-stat-footer">เทียบเคียง 103 แห่ง ทุกระดับ</div>
                  </div>

                  <div className="bt-stat-card bt-stat-card-amber">
                    <div className="bt-stat-label-row bt-stat-label-amber">
                      <span>โอกาสเพิ่มรายได้รวม (High Target)</span>
                    </div>
                    <div className="bt-stat-value bt-stat-val-amber">
                      +{formatShortMoney(execData.totalOppHigh)}
                    </div>
                    <div className="bt-stat-footer">
                      พบ {execData.opp.length + execData.zeroA.length} รายการที่มีศักยภาพ
                    </div>
                  </div>
                </div>

                {/* Section 1: จุดเด่นที่ทำได้ดี */}
                <div className="bt-panel">
                  <div className="bt-panel-header">
                    <div className="bt-panel-title-area">
                      <div className="bt-panel-icon bt-panel-icon-emerald">
                        <Award size={20} />
                      </div>
                      <div>
                        <h3 className="bt-panel-title">
                          จุดเด่นที่ทำได้ดี ({execData.good.length} รายการ)
                        </h3>
                        <p className="bt-panel-desc">
                          กองทุนที่ รพ. ได้ยอดต่อหัวสูงกว่าค่าเฉลี่ยเพื่อนในกลุ่มเกิน 1 SD (ผลงานระดับแนวหน้า)
                        </p>
                      </div>
                    </div>
                    <span className="bt-badge bt-badge-emerald">ผลงานเด่น</span>
                  </div>

                  {execData.good.length === 0 ? (
                    <div className="bt-empty-state">ยังไม่พบรายการที่เกินค่า Mean + 1 SD ในรอบปีนี้</div>
                  ) : (
                    <div className="bt-table-wrapper">
                      <table className="bt-table">
                        <thead>
                          <tr>
                            <th className="t">กองทุน / รายการ</th>
                            <th className="t">แหล่งข้อมูล</th>
                            <th>ยอดชดเชย รพ. (บาท)</th>
                            <th>ต่อหัว UC รพ.</th>
                            <th>ค่าเฉลี่ยกลุ่มเพื่อน</th>
                            <th style={{ textAlign: 'center' }}>ผลลัพธ์เทียบกลุ่ม</th>
                          </tr>
                        </thead>
                        <tbody>
                          {execData.good.map(item => (
                            <tr key={item.id}>
                              <td className="t" style={{ fontWeight: 600 }}>{item.name}</td>
                              <td className="t" style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.src}</td>
                              <td style={{ fontWeight: 600 }}>{formatMoney(item.ownAmt)}</td>
                              <td style={{ color: '#047857', fontWeight: 700 }}>{formatMoney(item.ownPC)}</td>
                              <td style={{ color: '#64748b' }}>{formatMoney(item.mean)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="bt-badge bt-badge-emerald">
                                  +{formatMoney(item.ownPC - item.mean)} บาท/คน
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Section 2: โอกาสพัฒนาเพิ่มรายได้ */}
                <div className="bt-panel">
                  <div className="bt-panel-header">
                    <div className="bt-panel-title-area">
                      <div className="bt-panel-icon bt-panel-icon-amber">
                        <TrendingUp size={20} />
                      </div>
                      <div>
                        <h3 className="bt-panel-title">
                          โอกาสพัฒนาเพิ่มรายได้ ({execData.opp.length} รายการ)
                        </h3>
                        <p className="bt-panel-desc">
                          กองทุนที่ รพ. ได้ยอดต่อหัวต่ำกว่าค่าเฉลี่ยเพื่อนในกลุ่ม (เป้าหมายเพิ่มรายได้หากทำได้เท่าค่าเฉลี่ยหรือระดับบนของเพื่อน)
                        </p>
                      </div>
                    </div>
                    <span className="bt-badge bt-badge-amber">โอกาสเติบโต</span>
                  </div>

                  {execData.opp.length === 0 ? (
                    <div className="bt-empty-state">ไม่มีรายการที่ต่ำกว่าค่าเฉลี่ย</div>
                  ) : (
                    <div className="bt-table-wrapper">
                      <table className="bt-table">
                        <thead>
                          <tr>
                            <th className="t">กองทุน / รายการ</th>
                            <th className="t">แหล่งข้อมูล</th>
                            <th>ยอดชดเชย รพ. (บาท)</th>
                            <th>ต่อหัว UC รพ.</th>
                            <th>ค่าเฉลี่ยกลุ่มเพื่อน</th>
                            <th>โอกาสเพิ่ม (เทียบ Mean)</th>
                            <th>โอกาสเพิ่มสูงสุด (บาท)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {execData.opp.map(item => (
                            <tr key={item.id}>
                              <td className="t" style={{ fontWeight: 600 }}>{item.name}</td>
                              <td className="t" style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.src}</td>
                              <td style={{ fontWeight: 600 }}>{formatMoney(item.ownAmt)}</td>
                              <td style={{ color: '#b45309', fontWeight: 700 }}>{formatMoney(item.ownPC)}</td>
                              <td style={{ color: '#64748b' }}>{formatMoney(item.mean)}</td>
                              <td style={{ color: '#64748b' }}>+{formatMoney(item.upLow)}</td>
                              <td style={{ color: '#b45309', fontWeight: 700 }}>+{formatMoney(item.upHigh)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Section 3: รายการที่ยังไม่ได้เบิกชดเชย */}
                <div className="bt-panel">
                  <div className="bt-panel-header">
                    <div className="bt-panel-title-area">
                      <div className="bt-panel-icon bt-panel-icon-rose">
                        <AlertCircle size={20} />
                      </div>
                      <div>
                        <h3 className="bt-panel-title">
                          รายการที่ยังไม่ได้เริ่มเบิกชดเชย ({execData.zeroA.length} รายการ)
                        </h3>
                        <p className="bt-panel-desc">
                          กองทุน/บริการที่ รพ. อื่นในกลุ่มเปรียบเทียบเบิกได้แล้ว แต่ รพ. ของเรายังไม่มียอดเบิกชดเชย
                        </p>
                      </div>
                    </div>
                    <span className="bt-badge bt-badge-rose">ควรติดตาม</span>
                  </div>

                  {execData.zeroA.length === 0 ? (
                    <div className="bt-empty-state">ไม่มีรายการที่ศูนย์ขณะที่เพื่อนเบิกได้</div>
                  ) : (
                    <div className="bt-table-wrapper">
                      <table className="bt-table">
                        <thead>
                          <tr>
                            <th className="t">กองทุน / รายการ</th>
                            <th className="t">แหล่งข้อมูล</th>
                            <th style={{ textAlign: 'center' }}>เพื่อนในกลุ่มที่เบิกได้</th>
                            <th>ค่าเฉลี่ยเพื่อน (บาท/คน)</th>
                            <th>ศักยภาพสร้างรายได้ (บาท)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {execData.zeroA.map(item => (
                            <tr key={item.id}>
                              <td className="t" style={{ fontWeight: 600 }}>{item.name}</td>
                              <td className="t" style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.src}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="bt-badge bt-badge-blue">
                                  {item.doPeers} จาก {peerIndices.length} แห่ง
                                </span>
                              </td>
                              <td style={{ fontWeight: 600 }}>{formatMoney(item.mean)}</td>
                              <td style={{ color: '#be123c', fontWeight: 700 }}>
                                +{formatMoney((item.mean || 0) * (focusedHospital.u || 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : tabSource === 'HP' ? (
              /* --- TAB 9: สรุปข้อมูลวิเคราะห์รายโรงพยาบาล (HP) --- */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Section 1: ผลงานของ รพ. แยกตามแหล่งข้อมูล */}
                <div className="bt-panel">
                  <div className="bt-panel-header">
                    <div className="bt-panel-title-area">
                      <div className="bt-panel-icon bt-panel-icon-sky">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <h3 className="bt-panel-title">
                          ผลงานของ {focusedHospital.n} แยกตามแหล่งข้อมูล (8 แหล่งข้อมูล)
                        </h3>
                        <p className="bt-panel-desc">
                          สรุปยอดเงิน ต่อหัว UC และตำแหน่งในกลุ่มเปรียบเทียบ "{groupLabelText}"
                        </p>
                      </div>
                    </div>
                    <div className="legend">
                      <span>
                        <i className="bt-sw bt-sw-s" /> ตำแหน่งในกลุ่ม (ขวา = อันดับสูง, ขีดกลาง = ค่ากลาง)
                      </span>
                      <span>
                        เฉดสี: น้อย <span className="grad" /> มาก
                      </span>
                    </div>
                  </div>

                  <div className="bt-table-wrapper bt-table-wrapper-max">
                    <table className="bt-table">
                      <thead>
                        <tr>
                          <th className="t">แหล่งข้อมูล</th>
                          <th>เงินที่ได้รับ (บาท)</th>
                          <th>ต่อหัว UC / OP ต่อครั้ง (บาท)</th>
                          <th style={{ textAlign: 'center' }}>อันดับในกลุ่ม</th>
                          <th style={{ textAlign: 'center' }}>อันดับทั้งเขต</th>
                          <th>มัธยฐานกลุ่ม</th>
                          <th style={{ textAlign: 'center' }}>เทียบมัธยฐาน</th>
                          <th style={{ minWidth: '130px', textAlign: 'center' }}>ตำแหน่งในกลุ่ม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hpData.srcRows.map(r => (
                          <tr key={r.id}>
                            <td className="t">
                              <button
                                type="button"
                                onClick={() => {
                                  setTabSource(r.id)
                                  setSelectedItemKey('all')
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#0284c7',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  padding: 0,
                                  textAlign: 'left',
                                  textDecoration: 'underline',
                                }}
                              >
                                {r.name}
                              </button>
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {r.mineAmt ? formatMoney(r.mineAmt) : '–'}
                            </td>
                            <td
                              data-hc="1"
                              style={{
                                fontWeight: 700,
                                ...(r.hasAmount && r.mineRk > 0 ? heatStyle(r.mineRk, r.n) : {}),
                              }}
                            >
                              {r.hasAmount ? formatMoney(r.mineVal) : '–'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {r.hasAmount ? (
                                <span>
                                  <b style={{ color: '#0f172a' }}>{r.mineRk}</b>
                                  <small style={{ color: '#64748b' }}> / {r.n}</small>
                                </span>
                              ) : r.othersWithAmount > 0 ? (
                                <span className="bt-badge bt-badge-rose">
                                  ไม่มียอด (กลุ่มมี {r.othersWithAmount} แห่ง)
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>–</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {r.hasAmount ? (
                                <span>
                                  <b style={{ color: '#0f172a' }}>{r.mineRkReg}</b>
                                  <small style={{ color: '#64748b' }}> / {r.nRegion}</small>
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>–</span>
                              )}
                            </td>
                            <td style={{ color: '#64748b' }}>
                              {r.med ? formatMoney(r.med) : '–'}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>
                              {r.hasAmount && r.med ? (
                                <span style={{ color: r.diffPct >= 0 ? '#047857' : '#e11d48' }}>
                                  {r.diffPct >= 0 ? `+${Math.round(r.diffPct)}%` : `${Math.round(r.diffPct)}%`}
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>–</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {r.hasAmount ? (
                                <div className="bt-ptrack" title={`ตำแหน่งในกลุ่ม: อันดับ ${r.mineRk} จาก ${r.n}`}>
                                  <i style={{ left: `${(r.normPos * 100).toFixed(0)}%` }} />
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>–</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 2: รายละเอียดแหล่งข้อมูลที่เลือกเทียบกับกลุ่ม */}
                <div className="bt-panel">
                  <div className="bt-panel-header">
                    <div className="bt-panel-title-area">
                      <div className="bt-panel-icon bt-panel-icon-indigo">
                        <Layers size={20} />
                      </div>
                      <div>
                        <h3 className="bt-panel-title">
                          รายละเอียด: {RH1_TABS.find(t => t.id === dsrc)?.title} ({dsrc}) ของ {focusedHospital.n} เทียบกับกลุ่ม
                        </h3>
                        <p className="bt-panel-desc">
                          เจาะลึกรายการย่อยของแหล่งข้อมูลที่เลือก เปรียบเทียบกับค่ามัธยฐานและอันดับในกลุ่ม
                        </p>
                      </div>
                    </div>

                    {/* dsrc Selector & Level Toggle */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.775rem', fontWeight: 700, color: '#475569' }}>เลือกแหล่งข้อมูล:</span>
                        <select
                          value={dsrc}
                          onChange={e => setDsrc(e.target.value)}
                          className="bt-select"
                          style={{ minWidth: '220px' }}
                        >
                          {RH1_TABS.filter(t => t.id !== 'HP' && t.id !== 'EXEC').map(t => (
                            <option key={t.id} value={t.id}>
                              {t.title} ({t.sub})
                            </option>
                          ))}
                        </select>
                      </div>

                      {dsrc !== 'L7' && dsrc !== 'L8' && !S[dsrc]?.flat && (
                        <div className="bt-seg" role="group">
                          <button
                            type="button"
                            aria-pressed={dlvl === 'm'}
                            onClick={() => setDlvl('m')}
                          >
                            กองทุนหลัก
                          </button>
                          <button
                            type="button"
                            aria-pressed={dlvl === 's'}
                            onClick={() => setDlvl('s')}
                          >
                            รายการย่อย
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bt-table-wrapper bt-table-wrapper-max">
                    <table className="bt-table">
                      <thead>
                        <tr>
                          <th className="t">รายการ</th>
                          <th>เงินที่ได้รับ (บาท)</th>
                          <th>ต่อหัว UC / รายครั้ง (บาท)</th>
                          <th style={{ textAlign: 'center' }}>อันดับในกลุ่ม</th>
                          <th style={{ textAlign: 'center' }}>อันดับทั้งเขต</th>
                          <th>มัธยฐานกลุ่ม</th>
                          <th style={{ textAlign: 'center' }}>เทียบมัธยฐาน</th>
                          <th style={{ minWidth: '130px', textAlign: 'center' }}>ตำแหน่งในกลุ่ม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hpData.dTot.hasAmount && (
                          <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                            <td className="t"><b>{hpData.dTot.name}</b></td>
                            <td>{formatMoney(hpData.dTot.mineAmt)}</td>
                            <td
                              data-hc="1"
                              style={{
                                ...(hpData.dTot.rk > 0 ? heatStyle(hpData.dTot.rk, hpData.dTot.n) : {}),
                              }}
                            >
                              {formatMoney(hpData.dTot.mineVal)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {hpData.dTot.rk} / {hpData.dTot.n}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {hpData.dTot.rkReg} / {NH}
                            </td>
                            <td>{formatMoney(hpData.dTot.med)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ color: hpData.dTot.diffPct >= 0 ? '#047857' : '#e11d48' }}>
                                {hpData.dTot.diffPct >= 0 ? `+${Math.round(hpData.dTot.diffPct)}%` : `${Math.round(hpData.dTot.diffPct)}%`}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div className="bt-ptrack">
                                <i style={{ left: `${(hpData.dTot.normPos * 100).toFixed(0)}%` }} />
                              </div>
                            </td>
                          </tr>
                        )}

                        {hpData.dItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="t" style={{ fontWeight: 600 }}>{item.name}</td>
                            <td>{item.mineAmt ? formatMoney(item.mineAmt) : '–'}</td>
                            <td
                              data-hc="1"
                              style={{
                                fontWeight: 700,
                                ...(item.hasAmount && item.rk > 0 ? heatStyle(item.rk, item.n) : {}),
                              }}
                            >
                              {item.hasAmount ? formatMoney(item.mineVal) : '–'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {item.hasAmount ? (
                                <span>
                                  <b>{item.rk}</b>
                                  <small style={{ color: '#64748b' }}> / {item.n}</small>
                                </span>
                              ) : item.others > 0 ? (
                                <span className="bt-badge bt-badge-rose">ไม่มียอด (กลุ่มมี {item.others} แห่ง)</span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>–</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {item.hasAmount ? `${item.rkReg} / ${NH}` : '–'}
                            </td>
                            <td>{item.med ? formatMoney(item.med) : '–'}</td>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>
                              {item.hasAmount && item.med ? (
                                <span style={{ color: item.diffPct >= 0 ? '#047857' : '#e11d48' }}>
                                  {item.diffPct >= 0 ? `+${Math.round(item.diffPct)}%` : `${Math.round(item.diffPct)}%`}
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>–</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {item.hasAmount ? (
                                <div className="bt-ptrack">
                                  <i style={{ left: `${(item.normPos * 100).toFixed(0)}%` }} />
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8' }}>–</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 3: เปรียบเทียบทุก รพ. ในกลุ่ม ข้ามแหล่งข้อมูล */}
                <div className="bt-panel">
                  <div className="bt-panel-header">
                    <div className="bt-panel-title-area">
                      <div className="bt-panel-icon bt-panel-icon-emerald">
                        <Award size={20} />
                      </div>
                      <div>
                        <h3 className="bt-panel-title">
                          เปรียบเทียบทุก รพ. ในกลุ่ม "{groupLabelText}" ข้ามแหล่งข้อมูล
                        </h3>
                        <p className="bt-panel-desc">
                          แสดง{metric === 'pc' ? 'ยอดต่อหัว UC (บาท/คน)' : 'ยอดเงินชดเชย (บาท)'} ข้าม 8 แหล่งข้อมูล · รพ. ที่โฟกัสอยู่บนสุดพร้อมกรอบไฮไลท์
                        </p>
                      </div>
                    </div>
                    <div className="legend">
                      <span>เฉดสี: น้อย <span className="grad" /> มาก</span>
                      <span>#n = อันดับในกลุ่ม</span>
                    </div>
                  </div>

                  <div className="bt-table-wrapper bt-table-wrapper-max">
                    <table className="bt-table bt-mx">
                      <thead>
                        <tr>
                          <th className="f">หน่วยบริการ</th>
                          <th className="t" style={{ width: '80px' }}>รหัส</th>
                          <th className="t" style={{ width: '90px' }}>จังหวัด</th>
                          <th style={{ width: '60px' }}>ขนาด</th>
                          <th style={{ width: '100px' }}>ประชากร UC</th>
                          {hpData.SV.map(s => {
                            const tabDef = RH1_TABS.find(t => t.id === s.id)
                            return (
                              <th key={s.id} style={{ minWidth: '130px', textAlign: 'right' }}>
                                {tabDef?.title.replace(/^[0-9.]+\s*/, '')}
                                <br />
                                <span style={{ fontWeight: 400, fontSize: '0.7rem', color: '#64748b' }}>
                                  {tabDef?.sub}
                                </span>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {hpData.mxPeerRows.map(row => {
                          const isFocus = row.i === focusIdx
                          return (
                            <tr key={row.hospital.c} className={isFocus ? 'focus' : ''}>
                              <td className="f" style={{ fontWeight: isFocus ? 600 : 400 }}>
                                {row.hospital.n}
                              </td>
                              <td className="t">{row.hospital.c}</td>
                              <td className="t">{row.hospital.p}</td>
                              <td>{row.hospital.l}</td>
                              <td>{new Intl.NumberFormat().format(row.hospital.u)}</td>
                              {row.sourceCells.map(cell => {
                                const has = cell.amt !== 0
                                return (
                                  <td
                                    key={cell.id}
                                    data-hc="1"
                                    style={{
                                      textAlign: 'right',
                                      fontWeight: 600,
                                      ...(has && cell.rk > 0 ? heatStyle(cell.rk, cell.n) : {}),
                                    }}
                                  >
                                    {has ? (
                                      <div>
                                        <b>{formatMoney(cell.val)}</b>
                                        <i style={{ display: 'block', fontSize: '0.675rem', opacity: 0.85 }}>#{cell.rk}</i>
                                      </div>
                                    ) : (
                                      <span style={{ color: '#94a3b8' }}>–</span>
                                    )}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <Rh1ComparisonViews
                view={view}
                H={H}
                NH={NH}
                peerIndices={peerIndices}
                focusIdx={focusIdx}
                focusedHospital={focusedHospital}
                isLM={isLM}
                metric={metric}
                cdim={cdim}
                matrixLvl={matrixLvl}
                amtVector={amtVector}
                pcVector={pcVector}
                ranksData={ranksData}
                rankingRows={rankingRows}
                groupCompareRows={groupCompareRows}
                sourceAggregate={sourceAggregate}
                formatMoney={formatMoney}
              />
            )}
    </div>
  )
}
