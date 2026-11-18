import { apiGateway } from '@/lib/apiGateway'
import { getSwrCachedData } from '@/lib/cache'
import {
  getCurrentThaiFiscalYear,
  normalizeCid,
  normalizeHn,
  toNullableNumber,
} from './dmRemissionDomain'
import {
  DEFAULT_A1C_MAX,
  DEFAULT_PAGE_SIZE,
  getAvailableLabTrackingFiscalYears,
  getFiscalYearDateRange,
  runLabTrackingPipeline,
} from './dmRemissionLabDomain'
import {
  DM_ANTIDIABETIC_DRUGS,
  DM_ANTIDIABETIC_ICODES,
  type DmLabPatientTimeline,
  type DmLabTrackingFilters,
  type DmLabTrackingRecord,
  type DmLabTrackingResult,
} from './dmRemissionLabTypes'

export interface DmRemissionLabDbDeps {
  appQuery: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>
  clinicalQuery: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>
}

interface LabBaseSqlRow {
  hn: string
  cid: string | null
  patient_name: string | null
  age_years: number | string | null
  sex_label: string | null
  death_flag: number | string | null
  visit_date: string
  vn: string | null
  lab_order_number: number | string
  latest_a1c: number | string
  a1c_test_count: number | string
  prev_entry: string | null
  visit_pttype_code: string | null
  visit_pttype_name: string | null
  is_uc_visit: number | string | null
  current_pttype_code: string | null
  current_pttype_name: string | null
  is_uc_current: number | string | null
  tambon_name: string | null
  village_name: string | null
  village_moo: string | null
}

interface E11AggSqlRow {
  hn: string
  last_e11_date: string | null
  last_e11_icd10: string | null
  in_fy_e11_count: number | string | null
}

interface SameVnE11SqlRow {
  vn: string
}

interface DmDrugVisitSqlRow {
  hn: string
  vn: string | null
  vstdate: string
  icodes: string | null
}

interface CohortLookupSqlRow {
  hn: string | null
  cid: string | null
  summary_remission: string | null
}

interface T1dmLookupSqlRow {
  pid: string | null
  type: string | null
}

interface CachedFiscalYearDataset {
  totalA1cTested: number
  basePool: DmLabTrackingRecord[]
  fetchedAt: string
}

const DRUG_NAME_BY_ICODE = new Map<string, string>(
  DM_ANTIDIABETIC_DRUGS.map((item) => [item.icode, item.name])
)

const HOSXP_CHUNK_SIZE = 900

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return []
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

function buildPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ')
}

function parsePrevEntry(prevEntry: string | null): {
  prevA1c: number | null
  prevA1cDate: string | null
} {
  if (!prevEntry) return { prevA1c: null, prevA1cDate: null }
  const parts = prevEntry.split('|')
  if (parts.length >= 3) {
    return {
      prevA1cDate: parts[0]?.trim() || null,
      prevA1c: toNullableNumber(parts[2]),
    }
  }
  return {
    prevA1cDate: parts[0]?.trim() || null,
    prevA1c: toNullableNumber(parts[1]),
  }
}

function shiftIsoDateDays(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return isoDate
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays))
  return dt.toISOString().slice(0, 10)
}

function createDefaultDeps(): DmRemissionLabDbDeps {
  return {
    appQuery: <T = Record<string, unknown>>(sql: string, params?: unknown[]) =>
      apiGateway.app.query<T>(sql, params),
    clinicalQuery: <T = Record<string, unknown>>(sql: string, params?: unknown[]) =>
      apiGateway.clinical.query<T>(sql, params, { timeoutMs: 90_000 }),
  }
}

export class DmRemissionLabService {
  private readonly deps: DmRemissionLabDbDeps

  constructor(deps?: DmRemissionLabDbDeps) {
    this.deps = deps ?? createDefaultDeps()
  }

  private async loadFiscalYearDataset(
    fiscalYear: number,
    a1cMax: number
  ): Promise<CachedFiscalYearDataset> {
    const { startDate, endDate } = getFiscalYearDateRange(fiscalYear)

    const totalQuerySql = `
      SELECT COUNT(DISTINCT lh.hn) AS total_tested
      FROM lab_head lh
      INNER JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
      WHERE lh.order_date >= ?
        AND lh.order_date <= ?
        AND lo.lab_items_code = 3073
        AND lo.confirm = 'Y'
        AND lo.lab_order_result REGEXP '^[0-9]+(\\.[0-9]+)?$'
    `

    const basePoolSql = `
      SELECT
        t.hn,
        p.cid,
        CONCAT(COALESCE(p.pname, ''), COALESCE(p.fname, ''), ' ', COALESCE(p.lname, '')) AS patient_name,
        TIMESTAMPDIFF(YEAR, p.birthday, t.visit_date) AS age_years,
        CASE p.sex WHEN '1' THEN 'ชาย' WHEN '2' THEN 'หญิง' ELSE NULL END AS sex_label,
        CASE WHEN COALESCE(p.death, 'N') = 'Y' OR COALESCE(MAX(ps.death), 'N') = 'Y' THEN 1 ELSE 0 END AS death_flag,
        t.visit_date,
        t.latest_vn AS vn,
        t.lab_order_number,
        t.latest_a1c,
        t.a1c_test_count,
        t.prev_entry,
        o.pttype AS visit_pttype_code,
        pt_v.name AS visit_pttype_name,
        CASE WHEN pt_v.hipdata_code = 'UCS' THEN 1 ELSE 0 END AS is_uc_visit,
        p.pttype AS current_pttype_code,
        pt_p.name AS current_pttype_name,
        CASE WHEN pt_p.hipdata_code = 'UCS' THEN 1 ELSE 0 END AS is_uc_current,
        MAX(ta.name) AS tambon_name,
        MAX(v.village_name) AS village_name,
        MAX(v.village_moo) AS village_moo
      FROM (
        SELECT
          raw_agg.hn,
          raw_agg.a1c_test_count,
          SUBSTRING_INDEX(SUBSTRING_INDEX(raw_agg.entries_csv, ',', 1), '|', 1) AS visit_date,
          CAST(
            SUBSTRING_INDEX(
              SUBSTRING_INDEX(
                SUBSTRING_INDEX(raw_agg.entries_csv, ',', 1),
                '|',
                2
              ),
              '|',
              -1
            ) AS UNSIGNED
          ) AS lab_order_number,
          CAST(
            SUBSTRING_INDEX(
              SUBSTRING_INDEX(
                SUBSTRING_INDEX(raw_agg.entries_csv, ',', 1),
                '|',
                3
              ),
              '|',
              -1
            ) AS DECIMAL(5,2)
          ) AS latest_a1c,
          SUBSTRING_INDEX(SUBSTRING_INDEX(raw_agg.entries_csv, ',', 1), '|', -1) AS latest_vn,
          CASE
            WHEN raw_agg.a1c_test_count >= 2 THEN
              SUBSTRING_INDEX(SUBSTRING_INDEX(raw_agg.entries_csv, ',', 2), ',', -1)
            ELSE NULL
          END AS prev_entry
        FROM (
          SELECT
            lh.hn,
            COUNT(*) AS a1c_test_count,
            GROUP_CONCAT(
              CONCAT(DATE_FORMAT(lh.order_date, '%Y-%m-%d'), '|', lh.lab_order_number, '|', TRIM(lo.lab_order_result), '|', COALESCE(lh.vn, ''))
              ORDER BY lh.order_date DESC, lh.lab_order_number DESC
              SEPARATOR ','
            ) AS entries_csv
          FROM lab_head lh
          INNER JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
          WHERE lh.order_date >= ?
            AND lh.order_date <= ?
            AND lo.lab_items_code = 3073
            AND lo.confirm = 'Y'
            AND lo.lab_order_result REGEXP '^[0-9]+(\\.[0-9]+)?$'
          GROUP BY lh.hn
        ) raw_agg
        HAVING latest_a1c <= ?
      ) t
      INNER JOIN patient p ON p.hn = t.hn
      LEFT JOIN ovst o ON o.vn = t.latest_vn
      LEFT JOIN pttype pt_v ON pt_v.pttype = o.pttype
      LEFT JOIN pttype pt_p ON pt_p.pttype = p.pttype
      LEFT JOIN person ps ON ps.patient_hn = p.hn
      LEFT JOIN village v ON v.village_id = ps.village_id
      LEFT JOIN thaiaddress ta
        ON ta.chwpart = p.chwpart
        AND ta.amppart = p.amppart
        AND ta.tmbpart = p.tmbpart
        AND ta.codetype = '3'
      GROUP BY
        t.hn, p.cid, p.pname, p.fname, p.lname, p.birthday, p.sex, p.death,
        t.visit_date, t.latest_vn, t.lab_order_number, t.latest_a1c, t.a1c_test_count, t.prev_entry,
        o.pttype, pt_v.name, pt_v.hipdata_code, p.pttype, pt_p.name, pt_p.hipdata_code
    `

    const [totalRows, baseRows] = await Promise.all([
      this.deps.clinicalQuery<{ total_tested: number | string }>(totalQuerySql, [
        startDate,
        endDate,
      ]),
      this.deps.clinicalQuery<LabBaseSqlRow>(basePoolSql, [startDate, endDate, a1cMax]),
    ])

    const totalA1cTested = Number(totalRows[0]?.total_tested ?? 0)
    const fetchedAt = new Date().toISOString()

    if (baseRows.length === 0) {
      return { totalA1cTested, basePool: [], fetchedAt }
    }

    const hns = Array.from(new Set(baseRows.map((r) => r.hn).filter(Boolean)))
    const vns = Array.from(
      new Set(baseRows.map((r) => r.vn?.trim()).filter((v): v is string => Boolean(v)))
    )
    const cids = Array.from(
      new Set(
        baseRows.flatMap((r) => {
          const raw = r.cid?.trim()
          const norm = normalizeCid(raw)
          return [raw, norm].filter((v): v is string => Boolean(v))
        })
      )
    )

    const hnChunks = chunkArray(hns, HOSXP_CHUNK_SIZE)
    const vnChunks = chunkArray(vns, HOSXP_CHUNK_SIZE)
    const cidChunks = chunkArray(cids, HOSXP_CHUNK_SIZE)
    const icodePlaceholders = buildPlaceholders(DM_ANTIDIABETIC_ICODES.length)

    const [
      e11ChunkResults,
      sameVnChunkResults,
      rxChunkResults,
      cohortRows,
      t1dmChunkResults,
      t1dmMirrorRows,
    ] = await Promise.all([
      Promise.all(
        hnChunks.map((chunk) =>
          this.deps.clinicalQuery<E11AggSqlRow>(
            `
              SELECT
                od.hn,
                DATE_FORMAT(MAX(od.vstdate), '%Y-%m-%d') AS last_e11_date,
                SUBSTRING_INDEX(GROUP_CONCAT(od.icd10 ORDER BY od.vstdate DESC, od.vn DESC SEPARATOR ','), ',', 1) AS last_e11_icd10,
                SUM(CASE WHEN od.vstdate >= ? AND od.vstdate <= ? THEN 1 ELSE 0 END) AS in_fy_e11_count
              FROM ovstdiag od
              WHERE od.hn IN (${buildPlaceholders(chunk.length)})
                AND od.icd10 LIKE 'E11%'
              GROUP BY od.hn
            `,
            [startDate, endDate, ...chunk]
          )
        )
      ),
      Promise.all(
        vnChunks.map((chunk) =>
          this.deps.clinicalQuery<SameVnE11SqlRow>(
            `
              SELECT DISTINCT od.vn
              FROM ovstdiag od
              WHERE od.vn IN (${buildPlaceholders(chunk.length)})
                AND od.icd10 LIKE 'E11%'
            `,
            chunk
          )
        )
      ),
      Promise.all(
        hnChunks.map((chunk) =>
          this.deps.clinicalQuery<DmDrugVisitSqlRow>(
            `
              SELECT
                op.hn,
                op.vn,
                DATE_FORMAT(op.vstdate, '%Y-%m-%d') AS vstdate,
                GROUP_CONCAT(DISTINCT op.icode SEPARATOR ',') AS icodes
              FROM opitemrece op
              WHERE op.vstdate >= DATE_SUB(?, INTERVAL 90 DAY)
                AND op.vstdate <= ?
                AND op.icode IN (${icodePlaceholders})
                AND op.hn IN (${buildPlaceholders(chunk.length)})
              GROUP BY op.hn, op.vn, op.vstdate
            `,
            [startDate, endDate, ...DM_ANTIDIABETIC_ICODES, ...chunk]
          )
        )
      ),
      this.deps
        .appQuery<CohortLookupSqlRow>(
          `
            SELECT hn, cid, summary_remission
            FROM dm_remission_cohorts
            WHERE fiscal_year = ?
          `,
          [fiscalYear]
        )
        .catch(() => [] as CohortLookupSqlRow[]),
      Promise.all(
        cidChunks.map((chunk) =>
          this.deps
            .clinicalQuery<T1dmLookupSqlRow>(
              `
                SELECT
                  TRIM(PID) AS pid,
                  MAX(NULLIF(TRIM(Type), '')) AS type
                FROM rcmdb.t1dm
                WHERE PID IN (${buildPlaceholders(chunk.length)})
                GROUP BY TRIM(PID)
              `,
              chunk
            )
            .catch(() => [] as T1dmLookupSqlRow[])
        )
      ),
      this.deps
        .appQuery<T1dmLookupSqlRow>(
          `
            SELECT
              TRIM(pid) AS pid,
              MAX(NULLIF(TRIM(type), '')) AS type
            FROM t1dm_registries
            WHERE pid IS NOT NULL AND pid <> ''
            GROUP BY TRIM(pid)
          `
        )
        .catch(() => [] as T1dmLookupSqlRow[]),
    ])

    const e11ByHn = new Map<string, E11AggSqlRow>()
    for (const rows of e11ChunkResults) {
      for (const row of rows) {
        e11ByHn.set(row.hn, row)
      }
    }

    const sameVnE11Set = new Set<string>()
    for (const rows of sameVnChunkResults) {
      for (const row of rows) {
        if (row.vn) sameVnE11Set.add(row.vn)
      }
    }

    const rxByHn = new Map<string, DmDrugVisitSqlRow[]>()
    for (const rows of rxChunkResults) {
      for (const row of rows) {
        const list = rxByHn.get(row.hn) ?? []
        list.push(row)
        rxByHn.set(row.hn, list)
      }
    }

    const cohortByHn = new Map<string, string | null>()
    const cohortByCid = new Map<string, string | null>()
    for (const row of cohortRows ?? []) {
      const normHn = normalizeHn(row.hn)
      if (normHn) cohortByHn.set(normHn, row.summary_remission ?? null)
      const normCid = normalizeCid(row.cid)
      if (normCid) cohortByCid.set(normCid, row.summary_remission ?? null)
    }

    // Match the registration source of /service/dashboard-rcm/funds/t1dm-gdm-pdm/2
    // (rcmdb.t1dm + Website DB mirror table t1dm_registries by PID/CID).
    const t1dmByCid = new Map<string, string | null>()
    for (const rows of t1dmChunkResults) {
      for (const row of rows ?? []) {
        const normPid = normalizeCid(row.pid)
        if (normPid) {
          t1dmByCid.set(normPid, row.type?.trim() || null)
        }
      }
    }
    for (const row of t1dmMirrorRows ?? []) {
      const normPid = normalizeCid(row.pid)
      if (normPid) {
        const existing = t1dmByCid.get(normPid) ?? null
        t1dmByCid.set(normPid, row.type?.trim() || existing)
      }
    }

    const basePool: DmLabTrackingRecord[] = baseRows.map((row) => {
      const e11 = e11ByHn.get(row.hn)
      const rxList = rxByHn.get(row.hn) ?? []
      const labVisitDate = row.visit_date
      const labMinus90 = shiftIsoDateDays(labVisitDate, -90)
      const vnStr = row.vn?.trim() || ''

      let hasDmDrugInFy = false
      let hasDmDrug90dBeforeLab = false
      let hasDmDrugOnLabVisit = false
      let lastDmDrugDate: string | null = null
      const fyDrugNames = new Set<string>()

      for (const rx of rxList) {
        if (!lastDmDrugDate || rx.vstdate > lastDmDrugDate) {
          lastDmDrugDate = rx.vstdate
        }
        if (rx.vstdate >= startDate && rx.vstdate <= endDate) {
          hasDmDrugInFy = true
          for (const code of (rx.icodes || '').split(',')) {
            const trimmedCode = code.trim()
            if (trimmedCode) {
              fyDrugNames.add(DRUG_NAME_BY_ICODE.get(trimmedCode) ?? trimmedCode)
            }
          }
        }
        if (rx.vstdate >= labMinus90 && rx.vstdate <= labVisitDate) {
          hasDmDrug90dBeforeLab = true
        }
        if (vnStr && rx.vn && rx.vn.trim() === vnStr) {
          hasDmDrugOnLabVisit = true
        }
      }

      const normHn = normalizeHn(row.hn)
      const normCid = normalizeCid(row.cid)
      const matchedByHn = normHn ? cohortByHn.has(normHn) : false
      const matchedByCid = normCid ? cohortByCid.has(normCid) : false
      const matchedInCohort = matchedByHn || matchedByCid
      const matchedInT1dm = normCid ? t1dmByCid.has(normCid) : false
      const inCohortRegistry = matchedInCohort || matchedInT1dm
      const cohortStatus = matchedByHn
        ? (cohortByHn.get(normHn!) ?? null)
        : matchedByCid
          ? (cohortByCid.get(normCid!) ?? null)
          : null
      const t1dmType = matchedInT1dm ? (t1dmByCid.get(normCid!) ?? null) : null
      const cohortRemissionStatus = matchedInCohort
        ? cohortStatus
        : matchedInT1dm
          ? t1dmType || 'ลงทะเบียนแล้ว'
          : null

      const { prevA1c, prevA1cDate } = parsePrevEntry(row.prev_entry)

      return {
        hn: row.hn,
        cid: row.cid?.trim() || null,
        patientName: (row.patient_name || '').trim() || `HN ${row.hn}`,
        ageYears: toNullableNumber(row.age_years),
        sexLabel: row.sex_label ?? null,
        deathFlag: Number(row.death_flag ?? 0) === 1,
        visitDate: labVisitDate,
        vn: vnStr,
        labOrderNumber: Number(row.lab_order_number),
        latestA1c: Number(row.latest_a1c),
        a1cTestCount: Number(row.a1c_test_count ?? 1),
        prevA1c,
        prevA1cDate,
        visitPttypeCode: row.visit_pttype_code ?? null,
        visitPttypeName: row.visit_pttype_name ?? null,
        currentPttypeCode: row.current_pttype_code ?? null,
        currentPttypeName: row.current_pttype_name ?? null,
        isUcVisit: Number(row.is_uc_visit ?? 0) === 1,
        isUcCurrent: Number(row.is_uc_current ?? 0) === 1,
        lastE11Date: e11?.last_e11_date ?? null,
        lastE11Icd10: e11?.last_e11_icd10 ?? null,
        inFyE11Count: Number(e11?.in_fy_e11_count ?? 0),
        sameVnE11: vnStr ? sameVnE11Set.has(vnStr) : false,
        hasDmDrugInFy,
        hasDmDrug90dBeforeLab,
        hasDmDrugOnLabVisit,
        lastDmDrugDate,
        dmDrugsInFy: Array.from(fyDrugNames),
        tambonName: row.tambon_name?.trim() || null,
        villageName: row.village_name?.trim() || null,
        villageMoo: row.village_moo?.trim() || null,
        inCohortRegistry,
        cohortRemissionStatus,
        inDmRemissionCohort: matchedInCohort,
        inT1dmRegistry: matchedInT1dm,
        t1dmRegistryType: t1dmType,
      }
    })

    return { totalA1cTested, basePool, fetchedAt }
  }

  async getLabTracking(filters: DmLabTrackingFilters = {}): Promise<DmLabTrackingResult> {
    const fiscalYear = filters.fiscalYear ?? getCurrentThaiFiscalYear()
    const a1cMax = filters.a1cMax ?? DEFAULT_A1C_MAX
    const ucScope = filters.ucScope ?? 'visit'
    const diagScope = filters.diagScope ?? 'ever'
    const drugScope = filters.drugScope ?? 'fy'
    const cohortStatus = filters.cohortStatus ?? 'all'
    const includeDeceased = filters.includeDeceased ?? false
    const page = filters.page ?? 1
    const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
    const exportAll = filters.exportAll ?? false

    const cacheCeiling = Math.max(7.0, a1cMax)
    const cacheKey = `dm_remission_lab:fy:${fiscalYear}:a1c:${cacheCeiling.toFixed(2)}`

    const dataset = await getSwrCachedData(
      cacheKey,
      () => this.loadFiscalYearDataset(fiscalYear, cacheCeiling),
      {
        staleTtlMs: 120_000,
        maxTtlMs: 600_000,
        forceRefresh: filters.refresh,
      }
    )

    const pipelineResult = runLabTrackingPipeline({
      totalA1cTested: dataset.totalA1cTested,
      basePool: dataset.basePool,
      a1cMax,
      ucScope,
      diagScope,
      drugScope,
      cohortStatus,
      tambon: filters.tambon,
      search: filters.search,
      includeDeceased,
      page,
      pageSize,
      exportAll,
    })

    return {
      fiscalYear,
      fiscalYearRange: getFiscalYearDateRange(fiscalYear),
      availableFiscalYears: getAvailableLabTrackingFiscalYears(),
      availableTambons: pipelineResult.availableTambons,
      appliedFilters: {
        fiscalYear,
        a1cMax,
        ucScope,
        diagScope,
        drugScope,
        cohortStatus,
        tambon: filters.tambon?.trim() || null,
        search: filters.search?.trim() || null,
        includeDeceased,
      },
      summary: pipelineResult.summary,
      items: pipelineResult.items,
      pagination: pipelineResult.pagination,
      fetchedAt: dataset.fetchedAt,
    }
  }

  async getPatientLabTimeline(rawHn: string): Promise<DmLabPatientTimeline | null> {
    const hn = normalizeHn(rawHn) ?? rawHn.trim()
    const icodePlaceholders = buildPlaceholders(DM_ANTIDIABETIC_ICODES.length)

    const [patientRows, labRows, diagRows, rxRows] = await Promise.all([
      this.deps.clinicalQuery<{
        hn: string
        cid: string | null
        patient_name: string | null
        age_years: number | string | null
        pttype_name: string | null
      }>(
        `
          SELECT
            p.hn,
            p.cid,
            CONCAT(COALESCE(p.pname, ''), COALESCE(p.fname, ''), ' ', COALESCE(p.lname, '')) AS patient_name,
            TIMESTAMPDIFF(YEAR, p.birthday, CURDATE()) AS age_years,
            pt.name AS pttype_name
          FROM patient p
          LEFT JOIN pttype pt ON pt.pttype = p.pttype
          WHERE p.hn = ?
          LIMIT 1
        `,
        [hn]
      ),
      this.deps.clinicalQuery<{
        lab_order_number: number | string
        order_date: string
        vn: string | null
        a1c_result: string | null
        fpg_result: string | null
      }>(
        `
          SELECT
            lh.lab_order_number,
            DATE_FORMAT(lh.order_date, '%Y-%m-%d') AS order_date,
            lh.vn,
            MAX(CASE WHEN lo.lab_items_code = 3073 AND lo.confirm = 'Y' THEN TRIM(lo.lab_order_result) ELSE NULL END) AS a1c_result,
            MAX(CASE WHEN lo.lab_items_code = 3324 AND lo.confirm = 'Y' THEN TRIM(lo.lab_order_result) ELSE NULL END) AS fpg_result
          FROM lab_head lh
          INNER JOIN lab_order lo ON lo.lab_order_number = lh.lab_order_number
          WHERE lh.hn = ?
            AND lo.lab_items_code IN (3073, 3324)
            AND lo.confirm = 'Y'
          GROUP BY lh.lab_order_number, lh.order_date, lh.vn
          HAVING a1c_result IS NOT NULL OR fpg_result IS NOT NULL
          ORDER BY lh.order_date DESC, lh.lab_order_number DESC
          LIMIT 15
        `,
        [hn]
      ),
      this.deps.clinicalQuery<{
        vstdate: string
        vn: string
        icd10: string
        diagtype: string | null
      }>(
        `
          SELECT
            DATE_FORMAT(od.vstdate, '%Y-%m-%d') AS vstdate,
            od.vn,
            od.icd10,
            od.diagtype
          FROM ovstdiag od
          WHERE od.hn = ?
            AND od.icd10 LIKE 'E11%'
          ORDER BY od.vstdate DESC, od.vn DESC
          LIMIT 15
        `,
        [hn]
      ),
      this.deps.clinicalQuery<{
        vstdate: string
        vn: string
        icode: string
        drug_name: string | null
        qty: number | string | null
      }>(
        `
          SELECT
            DATE_FORMAT(op.vstdate, '%Y-%m-%d') AS vstdate,
            op.vn,
            op.icode,
            d.name AS drug_name,
            op.qty
          FROM opitemrece op
          LEFT JOIN drugitems d ON d.icode = op.icode
          WHERE op.hn = ?
            AND op.icode IN (${icodePlaceholders})
          ORDER BY op.vstdate DESC, op.vn DESC
          LIMIT 25
        `,
        [hn, ...DM_ANTIDIABETIC_ICODES]
      ),
    ])

    if (!patientRows || patientRows.length === 0) {
      return null
    }

    const patient = patientRows[0]

    return {
      hn: patient.hn,
      patientName: (patient.patient_name || '').trim() || `HN ${patient.hn}`,
      cid: patient.cid?.trim() || null,
      ageYears: toNullableNumber(patient.age_years),
      currentPttypeName: patient.pttype_name ?? null,
      labHistory: (labRows ?? []).map((r) => ({
        labOrderNumber: Number(r.lab_order_number),
        orderDate: r.order_date,
        vn: r.vn ?? '',
        a1c: toNullableNumber(r.a1c_result),
        fpg: toNullableNumber(r.fpg_result),
      })),
      e11Diagnoses: (diagRows ?? []).map((r) => ({
        vstdate: r.vstdate,
        vn: r.vn,
        icd10: r.icd10,
        diagType: r.diagtype ?? null,
      })),
      dmPrescriptions: (rxRows ?? []).map((r) => ({
        vstdate: r.vstdate,
        vn: r.vn,
        icode: r.icode,
        drugName: r.drug_name?.trim() || DRUG_NAME_BY_ICODE.get(r.icode) || r.icode,
        qty: toNullableNumber(r.qty),
      })),
    }
  }
}

export const dmRemissionLabService = new DmRemissionLabService()
