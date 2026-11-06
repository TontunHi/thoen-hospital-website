import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export interface LongTermCareRecord {
  id: number
  hn: string
  cid: string | null
  patientName: string
  address: string | null
  moo: string | null
  tambon: string | null
  age: number | null
  adlScore: number | null
  areaZone: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface LtcListParams {
  search?: string
  areaZone?: string
  page?: number
  limit?: number
  exportAll?: boolean
}

export interface LtcListResult {
  items: LongTermCareRecord[]
  total: number
  page: number
  limit: number
  totalPages: number
  availableAreaZones: string[]
  stats: {
    total: number
    avgAdl: number
    zoneCounts: Record<string, number>
  }
}

export interface LtcPatientLookupResult {
  hn: string
  cid: string | null
  patientName: string
  address: string | null
  moo: string | null
  tambon: string | null
  age: number | null
  isAlreadyInLtc: boolean
  existingLtcId?: number
  isPalliative: boolean
}

export interface LtcMutationContext {
  username?: string
  email?: string
}

// In-memory cache for LTC HNs to provide ultra-fast cross-checks
let ltcHnCache: { set: Set<string>; timestamp: number } | null = null
const LTC_CACHE_TTL_MS = 30 * 1000 // 30 seconds

export class LtcRegistryService {
  /**
   * Invalidate LTC cache on create/update/delete.
   */
  static invalidateCache() {
    ltcHnCache = null
  }

  /**
   * Retrieves a Set of all HNs currently in LTC registry for fast cross-validation.
   */
  static async getAllLtcHnSet(): Promise<Set<string>> {
    const now = Date.now()
    if (ltcHnCache && now - ltcHnCache.timestamp < LTC_CACHE_TTL_MS) {
      return ltcHnCache.set
    }

    try {
      const rows = await apiGateway.app.query<{ hn: string }>(
        'SELECT hn FROM long_term_care_registries WHERE hn IS NOT NULL'
      )
      const set = new Set<string>()
      for (const r of rows) {
        if (r.hn) {
          const cleanHn = String(r.hn).trim().padStart(7, '0')
          set.add(cleanHn)
          set.add(String(r.hn).trim())
        }
      }
      ltcHnCache = { set, timestamp: now }
      return set
    } catch (err) {
      logger.error({ err }, 'Failed to fetch LTC HNs')
      return ltcHnCache?.set || new Set<string>()
    }
  }

  /**
   * Checks if a patient HN exists in LTC registry.
   */
  static async isPatientInLtc(hn: string): Promise<boolean> {
    if (!hn) return false
    const cleanHn = String(hn).trim().padStart(7, '0')
    const rawHn = String(hn).trim()
    const set = await this.getAllLtcHnSet()
    return set.has(cleanHn) || set.has(rawHn)
  }

  /**
   * Look up patient demographic details from HOSxP and check LTC & Palliative Care status.
   */
  static async lookupPatientByHn(hn: string): Promise<LtcPatientLookupResult | null> {
    const rawInput = (hn || '').trim()
    if (!rawInput) return null

    const cleanHn = /^\d+$/.test(rawInput) ? rawInput.padStart(7, '0') : rawInput

    const ptSql = `
      SELECT 
        pt.hn,
        pt.cid,
        CONCAT(IFNULL(pt.pname,''), IFNULL(pt.fname,''), ' ', IFNULL(pt.lname,'')) AS ptname,
        IFNULL(pt.addrpart, '') AS address,
        IFNULL(pt.moopart, '') AS moo,
        IFNULL(t.name, '') AS tambon,
        TIMESTAMPDIFF(YEAR, pt.birthday, CURDATE()) AS age
      FROM patient pt
      LEFT JOIN thaiaddress t ON t.chwpart = pt.chwpart AND t.amppart = pt.amppart AND t.tmbpart = pt.tmbpart
      WHERE pt.hn = ?
      LIMIT 1;
    `

    const ptRows = await apiGateway.clinical.query<any>(ptSql, [cleanHn])
    if (!ptRows || ptRows.length === 0) {
      return null
    }

    const pt = ptRows[0]

    // Check if patient is already in LTC
    const existingLtc = await this.getRegistryByHn(cleanHn)

    // Check if patient is in Palliative Care registry
    let isPalliative = false
    try {
      const palRows = await apiGateway.app.query<{ id: number }>(
        'SELECT id FROM palliative_care_registries WHERE hn = ? LIMIT 1',
        [cleanHn]
      )
      if (palRows && palRows.length > 0) {
        isPalliative = true
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to check palliative care status for LTC lookup')
    }

    return {
      hn: pt.hn,
      cid: pt.cid || null,
      patientName: pt.ptname || '',
      address: pt.address || null,
      moo: pt.moo || null,
      tambon: pt.tambon || null,
      age: pt.age !== null && pt.age !== undefined ? Number(pt.age) : null,
      isAlreadyInLtc: Boolean(existingLtc),
      existingLtcId: existingLtc ? existingLtc.id : undefined,
      isPalliative,
    }
  }

  /**
   * Retrieves a list of LTC records with search, filters, pagination, and summary statistics.
   */
  static async listRegistries(params: LtcListParams = {}): Promise<LtcListResult> {
    const page = Math.max(1, Number(params.page) || 1)
    const limit = Math.max(1, Math.min(1000, Number(params.limit) || 20))
    const search = (params.search || '').trim().toLowerCase()
    const areaZone = (params.areaZone || '').trim()

    // Query all records from Website DB
    const sql = `
      SELECT 
        id,
        hn,
        cid,
        patient_name AS patientName,
        address,
        moo,
        tambon,
        age,
        adl_score AS adlScore,
        area_zone AS areaZone,
        created_by AS createdBy,
        updated_by AS updatedBy,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM long_term_care_registries
      ORDER BY id DESC
    `

    const rows = await apiGateway.app.query<LongTermCareRecord>(sql)

    // Extract unique available area zones
    const zoneSet = new Set<string>()
    for (const r of rows) {
      if (r.areaZone && r.areaZone.trim()) {
        zoneSet.add(r.areaZone.trim())
      }
    }
    const availableAreaZones = Array.from(zoneSet).sort()

    // Filter in-memory
    let filtered = rows
    if (search) {
      filtered = filtered.filter((r) => {
        const hnMatch = r.hn?.toLowerCase().includes(search)
        const cidMatch = r.cid?.toLowerCase().includes(search)
        const nameMatch = r.patientName?.toLowerCase().includes(search)
        const tambonMatch = r.tambon?.toLowerCase().includes(search)
        return hnMatch || cidMatch || nameMatch || tambonMatch
      })
    }

    if (areaZone && areaZone !== 'ALL') {
      filtered = filtered.filter((r) => r.areaZone === areaZone)
    }

    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / limit))

    // Calculate stats
    let totalAdl = 0
    let countWithAdl = 0
    const zoneCounts: Record<string, number> = {}

    for (const r of filtered) {
      if (r.adlScore !== null && r.adlScore !== undefined) {
        totalAdl += Number(r.adlScore)
        countWithAdl++
      }
      const z = r.areaZone || 'ไม่ระบุเขต'
      zoneCounts[z] = (zoneCounts[z] || 0) + 1
    }

    const avgAdl = countWithAdl > 0 ? Math.round((totalAdl / countWithAdl) * 10) / 10 : 0

    const pagedItems = params.exportAll
      ? filtered
      : filtered.slice((page - 1) * limit, page * limit)

    return {
      items: pagedItems,
      total,
      page,
      limit,
      totalPages,
      availableAreaZones,
      stats: {
        total,
        avgAdl,
        zoneCounts,
      },
    }
  }

  /**
   * Retrieves a single LTC record by its primary key ID.
   */
  static async getRegistryById(id: number): Promise<LongTermCareRecord | null> {
    const rows = await apiGateway.app.query<LongTermCareRecord>(
      `
      SELECT 
        id,
        hn,
        cid,
        patient_name AS patientName,
        address,
        moo,
        tambon,
        age,
        adl_score AS adlScore,
        area_zone AS areaZone,
        created_by AS createdBy,
        updated_by AS updatedBy,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM long_term_care_registries
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    )

    return rows && rows.length > 0 ? rows[0] : null
  }

  /**
   * Retrieves an LTC record by patient HN.
   */
  static async getRegistryByHn(hn: string): Promise<LongTermCareRecord | null> {
    const cleanHn = String(hn).trim().padStart(7, '0')
    const rawHn = String(hn).trim()

    const rows = await apiGateway.app.query<LongTermCareRecord>(
      `
      SELECT 
        id,
        hn,
        cid,
        patient_name AS patientName,
        address,
        moo,
        tambon,
        age,
        adl_score AS adlScore,
        area_zone AS areaZone,
        created_by AS createdBy,
        updated_by AS updatedBy,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM long_term_care_registries
      WHERE hn = ? OR hn = ?
      LIMIT 1
      `,
      [cleanHn, rawHn]
    )

    return rows && rows.length > 0 ? rows[0] : null
  }

  /**
   * Creates a new LTC registry entry.
   * Cross-validation: Patient cannot be added if already in LTC.
   */
  static async createRegistry(
    payload: {
      hn: string
      cid?: string | null
      patientName: string
      address?: string | null
      moo?: string | null
      tambon?: string | null
      age?: number | null
      adlScore?: number | null
      areaZone?: string | null
    },
    context?: LtcMutationContext
  ): Promise<LongTermCareRecord> {
    const rawHn = (payload.hn || '').trim()
    if (!rawHn) {
      throw new Error('HN is required')
    }
    const cleanHn = /^\d+$/.test(rawHn) ? rawHn.padStart(7, '0') : rawHn

    if (!payload.patientName || !payload.patientName.trim()) {
      throw new Error('Patient name is required')
    }

    // 1. Check duplicate in LTC
    const existing = await this.getRegistryByHn(cleanHn)
    if (existing) {
      throw new Error(`ผู้ป่วย HN: ${cleanHn} มีรายชื่อในทะเบียน Long Term Care (LTC) อยู่แล้ว`)
    }

    // 2. Insert into long_term_care_registries
    const insertSql = `
      INSERT INTO long_term_care_registries (
        hn, cid, patient_name, address, moo, tambon, age, adl_score, area_zone, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

    const user = context?.username || 'system'
    const res = await apiGateway.app.execute(insertSql, [
      cleanHn,
      payload.cid?.trim() || null,
      payload.patientName.trim(),
      payload.address?.trim() || null,
      payload.moo?.trim() || null,
      payload.tambon?.trim() || null,
      payload.age !== null && payload.age !== undefined ? Number(payload.age) : null,
      payload.adlScore !== null && payload.adlScore !== undefined ? Number(payload.adlScore) : null,
      payload.areaZone?.trim() || null,
      user,
      user,
    ])

    this.invalidateCache()

    const created = await this.getRegistryById(res.insertId || 0)
    if (!created) {
      // Fallback lookup by HN if insertId wasn't returned
      const byHn = await this.getRegistryByHn(cleanHn)
      if (!byHn) throw new Error('Failed to retrieve newly created LTC record')
      return byHn
    }

    try {
      await logAudit(
        'CREATE',
        'long_term_care_registries',
        `Created LTC registry record ID: ${created.id} (HN: ${cleanHn}, Name: ${created.patientName})`,
        { username: context?.username, email: context?.email }
      )
    } catch (auditErr) {
      logger.error({ auditErr }, 'Failed to write LTC create audit log')
    }

    return created
  }

  /**
   * Updates an existing LTC registry entry.
   */
  static async updateRegistry(
    id: number,
    payload: Partial<{
      cid: string | null
      patientName: string
      address: string | null
      moo: string | null
      tambon: string | null
      age: number | null
      adlScore: number | null
      areaZone: string | null
    }>,
    context?: LtcMutationContext
  ): Promise<LongTermCareRecord> {
    const existing = await this.getRegistryById(id)
    if (!existing) {
      throw new Error(`ไม่พบข้อมูลทะเบียน LTC รหัส ${id}`)
    }

    const updates: string[] = []
    const values: unknown[] = []

    if (payload.cid !== undefined) {
      updates.push('cid = ?')
      values.push(payload.cid ? payload.cid.trim() : null)
    }
    if (payload.patientName !== undefined) {
      updates.push('patient_name = ?')
      values.push(payload.patientName.trim())
    }
    if (payload.address !== undefined) {
      updates.push('address = ?')
      values.push(payload.address ? payload.address.trim() : null)
    }
    if (payload.moo !== undefined) {
      updates.push('moo = ?')
      values.push(payload.moo ? payload.moo.trim() : null)
    }
    if (payload.tambon !== undefined) {
      updates.push('tambon = ?')
      values.push(payload.tambon ? payload.tambon.trim() : null)
    }
    if (payload.age !== undefined) {
      updates.push('age = ?')
      values.push(payload.age !== null ? Number(payload.age) : null)
    }
    if (payload.adlScore !== undefined) {
      updates.push('adl_score = ?')
      values.push(payload.adlScore !== null ? Number(payload.adlScore) : null)
    }
    if (payload.areaZone !== undefined) {
      updates.push('area_zone = ?')
      values.push(payload.areaZone ? payload.areaZone.trim() : null)
    }

    updates.push('updated_by = ?')
    values.push(context?.username || 'system')

    values.push(id)

    const updateSql = `
      UPDATE long_term_care_registries 
      SET ${updates.join(', ')}
      WHERE id = ?
    `

    await apiGateway.app.execute(updateSql, values)
    this.invalidateCache()

    const updated = await this.getRegistryById(id)
    if (!updated) {
      throw new Error('Failed to retrieve updated LTC record')
    }

    try {
      await logAudit(
        'UPDATE',
        'long_term_care_registries',
        `Updated LTC registry record ID: ${id} (HN: ${updated.hn})`,
        { username: context?.username, email: context?.email }
      )
    } catch (auditErr) {
      logger.error({ auditErr }, 'Failed to write LTC update audit log')
    }

    return updated
  }

  /**
   * Deletes an LTC registry entry.
   */
  static async deleteRegistry(id: number, context?: LtcMutationContext): Promise<void> {
    const existing = await this.getRegistryById(id)
    if (!existing) {
      throw new Error(`ไม่พบข้อมูลทะเบียน LTC รหัส ${id}`)
    }

    await apiGateway.app.execute('DELETE FROM long_term_care_registries WHERE id = ?', [id])
    this.invalidateCache()

    try {
      await logAudit(
        'DELETE',
        'long_term_care_registries',
        `Deleted LTC registry record ID: ${id} (HN: ${existing.hn}, Name: ${existing.patientName})`,
        { username: context?.username, email: context?.email }
      )
    } catch (auditErr) {
      logger.error({ auditErr }, 'Failed to write LTC delete audit log')
    }
  }

  /**
   * Syncs and verifies CID and demographic details from HOSxP for LTC registries.
   * Compares patient names with HOSxP to ensure it's the correct person.
   */
  static async syncWithHosxp(
    recordId?: number,
    context?: LtcMutationContext
  ): Promise<{
    totalChecked: number
    updatedCount: number
    mismatches: Array<{ hn: string; currentName: string; hosName: string; cid: string }>
  }> {
    let records: LongTermCareRecord[] = []
    if (recordId) {
      const rec = await this.getRegistryById(recordId)
      if (rec) records = [rec]
    } else {
      records = await apiGateway.app.query<LongTermCareRecord>(
        'SELECT id, hn, cid, patient_name AS patientName, address, moo, tambon, age, adl_score AS adlScore, area_zone AS areaZone FROM long_term_care_registries'
      )
    }

    if (!records || records.length === 0) {
      return { totalChecked: 0, updatedCount: 0, mismatches: [] }
    }

    const hns = records.map((r) => String(r.hn).trim().padStart(7, '0'))
    const hosMap = new Map<string, { cid: string; ptname: string; fname: string; lname: string; age?: number }>()

    const CHUNK_SIZE = 50
    for (let i = 0; i < hns.length; i += CHUNK_SIZE) {
      const chunk = hns.slice(i, i + CHUNK_SIZE)
      const placeholders = chunk.map(() => '?').join(',')
      const hosxpPatients = await apiGateway.clinical.query<any>(
        `SELECT 
          hn, 
          cid, 
          fname, 
          lname, 
          CONCAT(IFNULL(pname,''), IFNULL(fname,''), ' ', IFNULL(lname,'')) AS ptname,
          TIMESTAMPDIFF(YEAR, birthday, CURDATE()) AS age
        FROM patient 
        WHERE hn IN (${placeholders})`,
        chunk
      )
      for (const hp of hosxpPatients) {
        hosMap.set(String(hp.hn).trim().padStart(7, '0'), {
          cid: String(hp.cid || '').replace(/[^0-9]/g, '').trim(),
          ptname: String(hp.ptname || '').trim(),
          fname: String(hp.fname || '').trim(),
          lname: String(hp.lname || '').trim(),
          age: hp.age !== null && hp.age !== undefined ? Number(hp.age) : undefined,
        })
      }
    }

    const mismatches: Array<{ hn: string; currentName: string; hosName: string; cid: string }> = []
    const statements: Array<{ sql: string; params: unknown[] }> = []
    let updatedCount = 0

    for (const rec of records) {
      const cleanHn = String(rec.hn).trim().padStart(7, '0')
      const hp = hosMap.get(cleanHn)
      if (!hp) continue

      // Verify name
      const currentNameClean = String(rec.patientName || '').replace(/^(นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.|ว่าที่ร้อยตรี)/, '').trim()
      const isMatch = currentNameClean.includes(hp.fname) || currentNameClean.includes(hp.lname)
      if (!isMatch) {
        mismatches.push({
          hn: rec.hn,
          currentName: rec.patientName,
          hosName: hp.ptname,
          cid: hp.cid,
        })
      }

      const currentCleanCid = (rec.cid || '').replace(/[^0-9]/g, '').trim()
      if (hp.cid && currentCleanCid !== hp.cid) {
        statements.push({
          sql: 'UPDATE long_term_care_registries SET cid = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
          params: [hp.cid, context?.username || 'hosxp_sync', rec.id],
        })
        updatedCount++
      }
    }

    if (statements.length > 0) {
      const BATCH_SIZE = 50
      for (let i = 0; i < statements.length; i += BATCH_SIZE) {
        const batch = statements.slice(i, i + BATCH_SIZE)
        await apiGateway.app.transaction(batch)
      }
      this.invalidateCache()
    }

    try {
      await logAudit(
        'UPDATE',
        'long_term_care_registries',
        `Synced LTC records with HOSxP (Checked: ${records.length}, Updated: ${updatedCount}, Mismatches: ${mismatches.length})`,
        { username: context?.username, email: context?.email }
      )
    } catch (auditErr) {
      logger.error({ auditErr }, 'Failed to write LTC sync audit log')
    }

    return {
      totalChecked: records.length,
      updatedCount,
      mismatches,
    }
  }
}

