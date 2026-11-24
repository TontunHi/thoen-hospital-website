import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData, invalidateCacheKey } from '@/lib/cache'
import { resolveFiscalDateRange, type QueryExecutor } from '../rcmDashboardService'
import { matchesPttypeFilter, isUcEclaimCode } from '../pttypeConstants'
import { enrichItemsWithSeamlessCache, matchesSeamlessRepSearch } from '../rcmSeamlessEnricher'
import { buildRepBreakdownSummary, matchesRepFilter, parseRepFilterParam } from '../rcmRepTagHelper'
import {
  classifyPpSpecialCodes,
  PERSON_SELECT_COLUMNS,
  PERSON_FROM_JOINS,
  chunkArray,
  compareTargetItems,
  compareScreenedItems,
  compareService1B004NItems,
  type CcsTargetPopulationParams,
  type CcsTargetPopulationResult,
  type CcsTargetPopulationItem,
  type CcsTargetPopulationSummary,
  type CcsTargetScreeningFilter,
  type CcsTargetSearchField,
  type CcsTargetSortField,
  type CcsTargetRowMatchType,
  type RepIndividualPersonLookup,
  type CcsScreenedRecipientsParams,
  type CcsScreenedRecipientsResult,
  type CcsScreenedRecipientItem,
  type CcsScreenedRecipientsSummary,
  type CcsMethodFilter,
  type CcsOkFilter,
  type CcsResultStatusFilter,
  type CcsCompensationFilter,
  type CcsScreenedSearchField,
  type CcsScreenedSortField,
  type CcsAdpMappingCheck,
  type CcsAdpMappingItem,
  type CcsService1B004NParams,
  type CcsService1B004NResult,
  type CcsService1B004NItem,
  type CcsService1B004NSummary,
  type CcsService1B004NCompensationFilter,
  type CcsService1B004NSearchField,
  type CcsService1B004NSortField,
  type CcsService1B004PParams,
  type CcsService1B004PResult,
  type CcsService1B004PItem,
  type CcsService1B004PSummary,
  type CcsService1B004PCompensationFilter,
  type CcsService1B004PSearchField,
  type CcsService1B004PSortField,
  type CcsService1B004_0NParams,
  type CcsService1B004_0NResult,
  type CcsService1B004_0NCompensationFilter,
  type CcsService1B004_0NSearchField,
  type CcsService1B004_0NSortField,
  type CcsService1B005Params,
  type CcsService1B005Result,
  type CcsService1B005CompensationFilter,
  type CcsService1B005SearchField,
  type CcsService1B005SortField,
} from './typesAndHelpers'

  /**
   * Look up person demographics by 13-digit CIDs (FoxPro `Proc QueryPerson`).
   */
export async function lookupPersonsByCids(
    cids: string[],
    executor: QueryExecutor = queryClinicalDb
  ): Promise<Map<string, RepIndividualPersonLookup>> {
    const map = new Map<string, RepIndividualPersonLookup>()
    const uniqueCids = Array.from(
      new Set(cids.map((c) => c.replace(/\D/g, '')).filter((c) => c.length === 13))
    )
    if (uniqueCids.length === 0) return map

    for (const chunk of chunkArray(uniqueCids, 400)) {
      const ph = chunk.map(() => '?').join(',')
      const rows = await executor(
        `SELECT ${PERSON_SELECT_COLUMNS} ${PERSON_FROM_JOINS} WHERE p.cid IN (${ph})`,
        chunk,
        { timeoutMs: 45000 }
      )
      for (const r of rows || []) {
        const cid = String(r.cid || '').replace(/\D/g, '')
        if (!cid || map.has(cid)) continue
        map.set(cid, {
          person_id: String(r.person_id || ''),
          hn: String(r.hn || '').trim(),
          cid,
          ptname: String(r.ptname || '').trim(),
          birthdate: r.birthdate ? String(r.birthdate) : null,
          age: r.age != null ? Number(r.age) : null,
          sex: r.sex ? String(r.sex) : null,
          nation: r.nation ? String(r.nation).trim() : null,
          person_discharge_id: r.person_discharge_id != null ? Number(r.person_discharge_id) : null,
          typearea: String(r.typearea || '').trim(),
          address: String(r.address || '').trim(),
        })
      }
    }

    return map
  }

  /**
   * 1. หญิงไทยอายุ 30 - 60 ปี ได้รับการตรวจคัดกรองมะเร็งปากมดลูก
   * Reconciles HOSxP `person` target population (female, Thai, age 30-60, discharge=9)
   * with OPD CCS screening visits (`tmpPapSmear`), `rcmdb.seamless` (`tmpCCS`),
   * `rcmdb.repeclaim` (`nhso` HPV), and CID-level `CheckData` + `QueryPerson`.
   */
export async function getTargetPopulationReport(
    params: CcsTargetPopulationParams = {},
    executor: QueryExecutor = queryClinicalDb
  ): Promise<CcsTargetPopulationResult> {
    const { startDate: ds1, endDate: ds2 } = resolveFiscalDateRange(params)
    const screeningFilter: CcsTargetScreeningFilter = params.screeningFilter || 'ALL'
    const typeareaFilter: 'ALL' | '1_3' = params.typeareaFilter || 'ALL'
    const searchField: CcsTargetSearchField = params.searchField || 'ALL'
    const search = (params.search || '').trim().toLowerCase()
    const sortBy: CcsTargetSortField = params.sortBy || 'hn'
    const sortOrder: 'asc' | 'desc' = params.sortOrder || 'asc'
    const page = Math.max(1, Number(params.page || 1))
    const pageSize = Math.max(1, Number(params.pageSize || 50))
    const exportAll = Boolean(params.exportAll)

    const cacheKey = `rcm-ccs-p1-target-${ds1}-${ds2}`
    if (params.refresh) {
      invalidateCacheKey(cacheKey)
    }

    const allRows = await getCachedData(
      cacheKey,
      async () => {
        const [personRows, visitRows, seamlessRows, hpvRepRows] = await Promise.all([
          executor(
            `
            SELECT ${PERSON_SELECT_COLUMNS}
            ${PERSON_FROM_JOINS}
            WHERE TIMESTAMPDIFF(YEAR, p.birthdate, NOW()) BETWEEN 30 AND 60
              AND p.sex = '2'
              AND p.nationality = '99'
              AND p.person_discharge_id = 9
            ORDER BY p.patient_hn ASC, p.person_id ASC
            `,
            [],
            { timeoutMs: 90000 }
          ),
          executor(
            `
            SELECT
              o.vn,
              o.hn,
              DATE_FORMAT(o.vstdate, '%Y-%m-%d') AS vstdate,
              NULLIF(TRIM(s.cc), '') AS cc,
              CONCAT_WS(',', NULLIF(v.pdx,''), NULLIF(v.dx0,''), NULLIF(v.dx1,''), NULLIF(v.dx2,''), NULLIF(v.dx3,''), NULLIF(v.dx4,''), NULLIF(v.dx5,'')) AS icd10,
              GROUP_CONCAT(DISTINCT IFNULL(hc.name, NULLIF(pp.dest_hospcode, ''))) AS hospital,
              GROUP_CONCAT(DISTINCT doc.name) AS doctorname,
              GROUP_CONCAT(DISTINCT t.pp_special_code) AS pp_codes
            FROM ovst o
            LEFT JOIN vn_stat v ON v.vn = o.vn
            LEFT JOIN opdscreen s ON s.vn = o.vn
            LEFT JOIN pp_special pp ON pp.vn = o.vn
            LEFT JOIN pp_special_type t ON t.pp_special_type_id = pp.pp_special_type_id
            LEFT JOIN hospcode hc ON hc.hospcode = pp.dest_hospcode
            LEFT JOIN doctor doc ON doc.code = pp.doctor
            WHERE o.vstdate BETWEEN ? AND ?
              AND (
                t.pp_special_code REGEXP '^1B004|^1B30|^1B40|^0320277'
                OR CONCAT_WS(',', v.pdx, v.dx0, v.dx1, v.dx2, v.dx3, v.dx4, v.dx5) REGEXP 'Z124'
              )
            GROUP BY o.vn
            ORDER BY o.vn ASC
            `,
            [ds1, ds2],
            { timeoutMs: 60000 }
          ),
          executor(
            `
            SELECT
              VN AS vn,
              HN AS hn,
              PID AS cid,
              Ptname AS ptname,
              Rep AS rep,
              DATE_FORMAT(AdmDate, '%Y-%m-%d') AS admdate,
              PayNo AS payno,
              Status AS status,
              IFNULL(Compensated, 0) AS compensated,
              HSub AS hsub,
              Note AS note
            FROM rcmdb.seamless
            WHERE Rep REGEXP 'CCS'
              AND AdmDate >= ? AND AdmDate < DATE_ADD(?, INTERVAL 1 DAY)
              AND IFNULL(Compensated, 0) > 0
            `,
            [ds1, ds2],
            { timeoutMs: 60000 }
          ),
          executor(
            `
            SELECT
              VN AS vn,
              HN AS hn,
              PID AS cid,
              Rep AS rep,
              IFNULL(Compensated, 0) AS compensated
            FROM rcmdb.repeclaim
            WHERE AdmDate >= ? AND AdmDate < DATE_ADD(?, INTERVAL 1 DAY)
              AND FileName REGEXP 'HPV'
            `,
            [ds1, ds2],
            { timeoutMs: 60000 }
          ),
        ])

        // Group screening visits by HN (ordered by o.vn ASC)
        const visitsByHn = new Map<string, Record<string, unknown>[]>()
        for (const v of visitRows || []) {
          const hn = String(v.hn || '').trim()
          if (!hn) continue
          const arr = visitsByHn.get(hn) || []
          arr.push(v)
          visitsByHn.set(hn, arr)
        }

        // Index seamless (tmpCCS) by VN, HN, and CID (for FoxPro CheckData reconciliation)
        const seamlessByVn = new Map<string, Record<string, unknown>[]>()
        const seamlessByHn = new Map<string, Record<string, unknown>[]>()
        const seamlessByCid = new Map<string, Record<string, unknown>[]>()
        for (const s of seamlessRows || []) {
          const vn = String(s.vn || '').trim()
          if (vn) {
            const arr = seamlessByVn.get(vn) || []
            arr.push(s)
            seamlessByVn.set(vn, arr)
          }
          const hn = String(s.hn || '').trim()
          if (hn) {
            const arr = seamlessByHn.get(hn) || []
            arr.push(s)
            seamlessByHn.set(hn, arr)
          }
          const cid = String(s.cid || '').replace(/\D/g, '')
          if (cid.length === 13) {
            const arr = seamlessByCid.get(cid) || []
            arr.push(s)
            seamlessByCid.set(cid, arr)
          }
        }

        // Index NHSO HPV repeclaim by VN and HN
        const hpvByVn = new Map<string, Record<string, unknown>[]>()
        const hpvByHn = new Map<string, Record<string, unknown>[]>()
        for (const h of hpvRepRows || []) {
          const vn = String(h.vn || '').trim()
          if (vn) {
            const arr = hpvByVn.get(vn) || []
            arr.push(h)
            hpvByVn.set(vn, arr)
          }
          const hn = String(h.hn || '').trim()
          if (hn) {
            const arr = hpvByHn.get(hn) || []
            arr.push(h)
            hpvByHn.set(hn, arr)
          }
        }

        const seenCids = new Set<string>()
        const items: CcsTargetPopulationItem[] = []

        for (const p of personRows || []) {
          const hn = String(p.hn || '').trim()
          const cid = String(p.cid || '').trim()
          const cleanCid = cid.replace(/\D/g, '')
          if (cleanCid) seenCids.add(cleanCid)

          const visits = hn ? visitsByHn.get(hn) || [] : []
          const vDates: string[] = []
          const ccs: string[] = []
          const icd10s: string[] = []
          const hospitals = new Set<string>()
          const doctors = new Set<string>()
          const allPpCodes: string[] = []
          let latestVn: string | null = null

          const matchedSeamlessSet = new Set<Record<string, unknown>>()
          const matchedHpvSet = new Set<Record<string, unknown>>()

          for (const v of visits) {
            const vn = String(v.vn || '').trim()
            if (vn) {
              latestVn = vn
              for (const sm of seamlessByVn.get(vn) || []) matchedSeamlessSet.add(sm)
              for (const hp of hpvByVn.get(vn) || []) matchedHpvSet.add(hp)
            }
            if (v.vstdate && !vDates.includes(String(v.vstdate))) {
              vDates.push(String(v.vstdate))
            }
            if (v.cc && !ccs.includes(String(v.cc))) {
              ccs.push(String(v.cc))
            }
            if (v.icd10 && !icd10s.includes(String(v.icd10))) {
              icd10s.push(String(v.icd10))
            }
            if (v.hospital) {
              String(v.hospital)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .forEach((h) => hospitals.add(h))
            }
            if (v.doctorname) {
              String(v.doctorname)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .forEach((d) => doctors.add(d))
            }
            if (v.pp_codes) {
              allPpCodes.push(...String(v.pp_codes).split(','))
            }
          }

          // Also match seamless/repeclaim by HN (for visits in range without PP code) and CID (FoxPro CheckData)
          if (hn) {
            for (const sm of seamlessByHn.get(hn) || []) matchedSeamlessSet.add(sm)
            for (const hp of hpvByHn.get(hn) || []) matchedHpvSet.add(hp)
          }
          if (cleanCid) {
            for (const sm of seamlessByCid.get(cleanCid) || []) matchedSeamlessSet.add(sm)
          }

          const combinedSeamless = Array.from(matchedSeamlessSet)
          const combinedHpv = Array.from(matchedHpvSet)

          if (!latestVn) {
            const smWithVn = combinedSeamless.find((s) => s.vn)
            const hpWithVn = combinedHpv.find((h) => h.vn)
            if (smWithVn?.vn) latestVn = String(smWithVn.vn).trim()
            else if (hpWithVn?.vn) latestVn = String(hpWithVn.vn).trim()
          }

          const ppClass = classifyPpSpecialCodes(allPpCodes)
          const isScreenedInHosxp = visits.length > 0

          const reps = new Set<string>()
          const comebackDates = new Set<string>()
          const paynos = new Set<string>()
          const statuses = new Set<string>()
          const hsubs = new Set<string>()
          const remarks = new Set<string>()
          let compensated = 0

          // Populate seamless metadata (comeback_date, payno, status, hsub, remark)
          for (const sm of combinedSeamless) {
            if (sm.admdate) comebackDates.add(String(sm.admdate).trim())
            if (sm.payno) paynos.add(String(sm.payno).trim())
            if (sm.status) statuses.add(String(sm.status).trim())
            if (sm.hsub) hsubs.add(String(sm.hsub).trim())
            if (sm.note) remarks.add(String(sm.note).trim())
          }

          // FoxPro: if(nhso.vn is not null, nhso.rep / nhso.compensated, ss.rep / ss.compensated)
          // plus CheckData updating seamless rep/compensated when seamless exists
          if (combinedSeamless.length > 0) {
            for (const sm of combinedSeamless) {
              if (sm.rep) reps.add(String(sm.rep).trim())
              compensated += Number(sm.compensated || 0)
            }
          } else if (combinedHpv.length > 0) {
            for (const hr of combinedHpv) {
              if (hr.rep) reps.add(String(hr.rep).trim())
              compensated += Number(hr.compensated || 0)
            }
          }

          const hasSeamlessRep = combinedSeamless.length > 0
          const comeback: 'Y' | null = hasSeamlessRep ? 'Y' : null
          const vstdateStr = vDates.length > 0 ? vDates.join(',') : null
          const comebackDateStr = comebackDates.size > 0 ? Array.from(comebackDates).join(',') : null

          // FoxPro tmpPapSmear: concat_ws(',','HOSxP', if(ss.rep is not null,'Rep',null))
          const note = hasSeamlessRep ? 'HOSxP,Rep' : 'HOSxP'

          const hasSameDayMatch =
            comeback === 'Y' &&
            ((vstdateStr !== null && comebackDateStr !== null && vstdateStr === comebackDateStr) ||
              vDates.some((d) => comebackDates.has(d)))

          let matchType: CcsTargetRowMatchType = 'unscreened'
          if (hasSameDayMatch) {
            matchType = 'matched_same_day'
          } else if (comeback === 'Y') {
            matchType = 'matched_diff_day'
          } else if (isScreenedInHosxp || combinedHpv.length > 0) {
            matchType = 'hosxp_only'
          }

          items.push({
            no: 0,
            person_id: String(p.person_id || ''),
            vn: latestVn,
            hn,
            cid,
            ptname: String(p.ptname || '').trim(),
            birthdate: p.birthdate ? String(p.birthdate) : null,
            age: p.age != null ? Number(p.age) : null,
            sex: String(p.sex || 'หญิง'),
            nation: String(p.nation || 'ไทย').trim(),
            person_discharge_id: p.person_discharge_id != null ? Number(p.person_discharge_id) : null,
            typearea: String(p.typearea || '').trim(),
            address: String(p.address || '').trim(),
            vstdate: vstdateStr,
            pttypename: isScreenedInHosxp ? String(p.person_pttypename || '').trim() || null : null,
            cc: ccs.length > 0 ? ccs.join(' | ') : null,
            icd10: icd10s.length > 0 ? icd10s.join(' | ') : null,
            hospital: hospitals.size > 0 ? Array.from(hospitals).join(', ') : null,
            doctorname: doctors.size > 0 ? Array.from(doctors).join(', ') : null,
            papsmear: ppClass.papsmear,
            papsmear_result: ppClass.papsmear_result,
            via: ppClass.via,
            via_result: ppClass.via_result,
            hpv: ppClass.hpv,
            hpv_result: ppClass.hpv_result,
            other: ppClass.other,
            other_result: ppClass.other_result,
            rep: reps.size > 0 ? Array.from(reps).join(',') : null,
            comeback,
            comeback_date: comebackDateStr,
            payno: paynos.size > 0 ? Array.from(paynos).join(',') : null,
            note,
            status: statuses.size > 0 ? Array.from(statuses).join(',') : null,
            compensated,
            hsub: hsubs.size > 0 ? Array.from(hsubs).join(',') : null,
            remark: remarks.size > 0 ? Array.from(remarks).join(' | ') : null,
            hasAbnormalResult: ppClass.hasAbnormalResult,
            matchType,
          })
        }

        // FoxPro CheckData + QueryPerson: reconcile Seamless CIDs not in the 30-60 active target table
        const unmatchedCids: string[] = []
        for (const cidKey of seamlessByCid.keys()) {
          if (!seenCids.has(cidKey)) {
            unmatchedCids.push(cidKey)
          }
        }

        const extraPersonMap =
          unmatchedCids.length > 0
            ? await lookupPersonsByCids(unmatchedCids, executor)
            : new Map<string, RepIndividualPersonLookup>()

        for (const cidKey of unmatchedCids) {
          const smGroup = seamlessByCid.get(cidKey) || []
          if (smGroup.length === 0) continue
          const first = smGroup[0]
          const foundPerson = extraPersonMap.get(cidKey)
          const totalComp = smGroup.reduce((acc, r) => acc + Number(r.compensated || 0), 0)

          items.push({
            no: 0,
            person_id: foundPerson?.person_id || '',
            vn: first.vn ? String(first.vn).trim() : null,
            hn: foundPerson?.hn || String(first.hn || '').trim(),
            cid: cidKey,
            ptname: foundPerson?.ptname || String(first.ptname || '').trim(),
            birthdate: foundPerson?.birthdate ?? null,
            age: foundPerson?.age ?? null,
            sex: foundPerson?.sex ?? null,
            nation: foundPerson?.nation ?? null,
            person_discharge_id: foundPerson?.person_discharge_id ?? null,
            typearea: foundPerson?.typearea || '',
            address: foundPerson?.address || '',
            vstdate: null,
            pttypename: null,
            cc: null,
            icd10: null,
            hospital: null,
            doctorname: null,
            papsmear: null,
            papsmear_result: null,
            via: null,
            via_result: null,
            hpv: null,
            hpv_result: null,
            other: null,
            other_result: null,
            rep:
              Array.from(new Set(smGroup.map((s) => String(s.rep || '').trim()).filter(Boolean))).join(',') ||
              null,
            comeback: 'Y',
            comeback_date:
              Array.from(new Set(smGroup.map((s) => String(s.admdate || '').trim()).filter(Boolean))).join(
                ','
              ) || null,
            payno:
              Array.from(new Set(smGroup.map((s) => String(s.payno || '').trim()).filter(Boolean))).join(',') ||
              null,
            note: 'Rep',
            status:
              Array.from(new Set(smGroup.map((s) => String(s.status || '').trim()).filter(Boolean))).join(
                ','
              ) || null,
            compensated: totalComp,
            hsub:
              Array.from(new Set(smGroup.map((s) => String(s.hsub || '').trim()).filter(Boolean))).join(',') ||
              null,
            remark:
              Array.from(new Set(smGroup.map((s) => String(s.note || '').trim()).filter(Boolean))).join(
                ' | '
              ) || null,
            hasAbnormalResult: false,
            matchType: 'rep_only',
          })
        }

        return items
      },
      300000 // 5 minutes cache TTL
    )

    let workingRows = allRows
    if (params.extraRepRows && params.extraRepRows.length > 0) {
      const excelDatesByCid = new Map<string, Set<string>>()
      for (const er of params.extraRepRows) {
        const cid = String(er.cid || '').replace(/\D/g, '')
        if (cid.length !== 13) continue
        const set = excelDatesByCid.get(cid) || new Set<string>()
        if (er.comebackDate) set.add(er.comebackDate)
        excelDatesByCid.set(cid, set)
      }

      if (excelDatesByCid.size > 0) {
        const matchedExcelCids = new Set<string>()
        workingRows = allRows.map((row) => {
          const cleanCid = row.cid.replace(/\D/g, '')
          const excelDates = excelDatesByCid.get(cleanCid)
          if (!excelDates) return row
          matchedExcelCids.add(cleanCid)

          const mergedDates = new Set<string>(
            (row.comeback_date || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          )
          for (const d of excelDates) mergedDates.add(d)
          const comebackDateStr = mergedDates.size > 0 ? Array.from(mergedDates).join(',') : row.comeback_date

          const vDates = (row.vstdate || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          const hasSameDay =
            (row.vstdate !== null && comebackDateStr !== null && row.vstdate === comebackDateStr) ||
            vDates.some((d) => mergedDates.has(d))

          const nextNote = row.note === 'Rep' ? 'Rep' : 'HOSxP,Rep'
          const nextMatchType: CcsTargetRowMatchType =
            nextNote === 'Rep' ? 'rep_only' : hasSameDay ? 'matched_same_day' : 'matched_diff_day'

          return {
            ...row,
            comeback: 'Y',
            comeback_date: comebackDateStr,
            note: nextNote,
            matchType: nextMatchType,
          }
        })

        const newExcelCids = Array.from(excelDatesByCid.keys()).filter((c) => !matchedExcelCids.has(c))
        if (newExcelCids.length > 0) {
          const personLookup = await lookupPersonsByCids(newExcelCids, executor)
          for (const cidKey of newExcelCids) {
            const found = personLookup.get(cidKey)
            const dates = Array.from(excelDatesByCid.get(cidKey) || [])
            workingRows.push({
              no: 0,
              person_id: found?.person_id || '',
              vn: null,
              hn: found?.hn || '',
              cid: cidKey,
              ptname: found?.ptname || '(พบในไฟล์ Rep Individual)',
              birthdate: found?.birthdate ?? null,
              age: found?.age ?? null,
              sex: found?.sex ?? null,
              nation: found?.nation ?? null,
              person_discharge_id: found?.person_discharge_id ?? null,
              typearea: found?.typearea || '',
              address: found?.address || '',
              vstdate: null,
              pttypename: null,
              cc: null,
              icd10: null,
              hospital: null,
              doctorname: null,
              papsmear: null,
              papsmear_result: null,
              via: null,
              via_result: null,
              hpv: null,
              hpv_result: null,
              other: null,
              other_result: null,
              rep: 'Rep_Individual',
              comeback: 'Y',
              comeback_date: dates.length > 0 ? dates.join(',') : null,
              payno: null,
              note: 'Rep',
              status: null,
              compensated: 0,
              hsub: null,
              remark: 'เทียบจากไฟล์ Rep_Individual',
              hasAbnormalResult: false,
              matchType: 'rep_only',
            })
          }
        }
      }
    }

    // Apply TypeArea scope filter before computing summary KPIs
    let scoped = workingRows
    if (typeareaFilter === '1_3') {
      scoped = scoped.filter(
        (r) => r.typearea === '1' || r.typearea === '3' || r.matchType === 'rep_only'
      )
    }

    const totalTarget = scoped.length
    const typearea13Count = workingRows.filter((r) => r.typearea === '1' || r.typearea === '3').length
    const screenedCount = scoped.filter(
      (r) => r.vstdate !== null || r.comeback === 'Y' || r.compensated > 0
    ).length
    const unscreenedCount = totalTarget - screenedCount
    const coverageRate = totalTarget > 0 ? Number(((screenedCount / totalTarget) * 100).toFixed(2)) : 0
    const abnormalCount = scoped.filter((r) => r.hasAbnormalResult).length
    const compensatedCount = scoped.filter((r) => r.comeback === 'Y' || r.compensated > 0).length
    const matchedSameDayCount = scoped.filter((r) => r.matchType === 'matched_same_day').length
    const matchedDiffDayCount = scoped.filter((r) => r.matchType === 'matched_diff_day').length
    const repOnlyCount = scoped.filter((r) => r.matchType === 'rep_only').length
    const totalCompensated = scoped.reduce((acc, r) => acc + r.compensated, 0)

    const summary: CcsTargetPopulationSummary = {
      totalTarget,
      typearea13Count,
      screenedCount,
      unscreenedCount,
      coverageRate,
      abnormalCount,
      compensatedCount,
      matchedSameDayCount,
      matchedDiffDayCount,
      repOnlyCount,
      totalCompensated,
    }

    const repBreakdown = buildRepBreakdownSummary(scoped)
    const selectedReps = parseRepFilterParam(params.reps)

    // Apply screening status filter
    let filtered = scoped
    if (screeningFilter === 'SCREENED') {
      filtered = filtered.filter((r) => r.vstdate !== null || r.comeback === 'Y' || r.compensated > 0)
    } else if (screeningFilter === 'UNSCREENED') {
      filtered = filtered.filter((r) => r.vstdate === null && r.comeback !== 'Y' && r.compensated === 0)
    } else if (screeningFilter === 'ABNORMAL') {
      filtered = filtered.filter((r) => r.hasAbnormalResult)
    } else if (screeningFilter === 'COMPENSATED') {
      filtered = filtered.filter((r) => r.comeback === 'Y' || r.compensated > 0)
    } else if (screeningFilter === 'MATCHED_SAME_DAY') {
      filtered = filtered.filter((r) => r.matchType === 'matched_same_day')
    } else if (screeningFilter === 'MATCHED_DIFF_DAY') {
      filtered = filtered.filter((r) => r.matchType === 'matched_diff_day')
    } else if (screeningFilter === 'REP_ONLY') {
      filtered = filtered.filter((r) => r.matchType === 'rep_only')
    }

    // Apply search filter (FoxPro lblFind / txtFind: HN, CID, PTNAME, or ALL)
    if (selectedReps.length > 0) {
      filtered = filtered.filter((r) => matchesRepFilter(r, selectedReps))
    }

    if (search) {
      filtered = filtered.filter((r) => {
        if (searchField === 'HN') {
          return r.hn.toLowerCase().includes(search)
        }
        if (searchField === 'CID') {
          const cleanQ = search.replace(/\D/g, '') || search
          return r.cid.includes(cleanQ)
        }
        if (searchField === 'PTNAME') {
          return r.ptname.toLowerCase().includes(search)
        }
        return (
          r.hn.toLowerCase().includes(search) ||
          r.cid.includes(search) ||
          r.ptname.toLowerCase().includes(search) ||
          r.address.toLowerCase().includes(search) ||
          (r.rep && r.rep.toLowerCase().includes(search))
        )
      })
    }

    // Sort (FoxPro ToClick)
    const sorted =
      sortBy === 'hn' && sortOrder === 'asc'
        ? filtered
        : [...filtered].sort((a, b) => compareTargetItems(a, b, sortBy, sortOrder))

    const totalCount = sorted.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const safePage = Math.min(page, totalPages)

    const slice = exportAll ? sorted : sorted.slice((safePage - 1) * pageSize, safePage * pageSize)
    const offset = exportAll ? 0 : (safePage - 1) * pageSize

    const numberedItems = slice.map((item, idx) => ({
      ...item,
      no: offset + idx + 1,
    }))

    return {
      ds1,
      ds2,
      screeningFilter,
      typeareaFilter,
      searchField,
      sortBy,
      sortOrder,
      summary,
      totalCount,
      page: safePage,
      pageSize,
      totalPages,
      items: numberedItems,
      repBreakdown,
    }
  }

