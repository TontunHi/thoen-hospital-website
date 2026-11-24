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

let ltcHnCache: { set: Set<string>; timestamp: number } | null = null
const LTC_CACHE_TTL_MS = 30 * 1000

export class LtcRegistryService {
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
      const res = await apiGateway.app.getLtcHns()
      const hns: string[] = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : []

      const set = new Set<string>()
      for (const hn of hns) {
        if (hn) {
          const cleanHn = String(hn).trim().padStart(7, '0')
          set.add(cleanHn)
          set.add(String(hn).trim())
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
   * Look up patient demographic details from HOSxP and check LTC & Palliative Care status via Gateway.
   */
  static async lookupPatientByHn(hn: string): Promise<LtcPatientLookupResult | null> {
    const rawInput = (hn || '').trim()
    if (!rawInput) return null

    const cleanHn = /^\d+$/.test(rawInput) ? rawInput.padStart(7, '0') : rawInput
    const res = await apiGateway.app.lookupLtcPatientByHn(cleanHn)
    if (!res) return null
    const data = ('data' in res && res.data !== undefined ? res.data : res) as LtcPatientLookupResult | null
    if (!data || !data.hn) return null
    return data
  }

  /**
   * Retrieves a list of LTC records with search, filters, pagination, and summary statistics.
   */
  static async listRegistries(params: LtcListParams = {}): Promise<LtcListResult> {
    const page = Math.max(1, Number(params.page) || 1)
    const limit = Math.max(1, Number(params.limit) || 20)
    const search = (params.search || '').trim().toLowerCase()
    const areaZone = (params.areaZone || '').trim()

    const res = await apiGateway.app.getLtcRegistries({
      search,
      areaZone,
      page,
      limit,
      exportAll: params.exportAll,
    })

    return {
      items: (res?.items || []) as LongTermCareRecord[],
      total: Number(res?.total || 0),
      page: Number(res?.page || page),
      limit: Number(res?.limit || limit),
      totalPages: Number(res?.totalPages || 1),
      availableAreaZones: res?.availableAreaZones || [],
      stats: res?.stats || { total: Number(res?.total || 0), avgAdl: 0, zoneCounts: {} },
    }
  }

  /**
   * Retrieves a single LTC record by its primary key ID.
   */
  static async getRegistryById(id: number): Promise<LongTermCareRecord | null> {
    const res = await apiGateway.app.getLtcRegistryById(id)
    if (!res) return null
    const record = ('data' in res && res.data !== undefined ? res.data : res) as LongTermCareRecord | null
    return record && record.id ? record : null
  }

  /**
   * Retrieves an LTC record by patient HN.
   */
  static async getRegistryByHn(hn: string): Promise<LongTermCareRecord | null> {
    const cleanHn = String(hn).trim().padStart(7, '0')
    const res = await apiGateway.app.getLtcRegistryByHn(cleanHn)
    if (!res) return null
    if (res.exists === false) return null
    if (res.exists && res.data) return res.data as LongTermCareRecord
    if ('id' in (res as Record<string, unknown>)) return res as unknown as LongTermCareRecord
    return null
  }

  /**
   * Creates a new LTC registry entry.
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

    const existing = await this.getRegistryByHn(cleanHn)
    if (existing) {
      throw new Error(`ผู้ป่วย HN: ${cleanHn} มีรายชื่อในทะเบียน Long Term Care (LTC) อยู่แล้ว`)
    }

    const user = context?.username || 'system'
    const createRes = await apiGateway.app.createLtcRegistry({
      hn: cleanHn,
      cid: payload.cid?.trim() || null,
      patientName: payload.patientName.trim(),
      address: payload.address?.trim() || null,
      moo: payload.moo?.trim() || null,
      tambon: payload.tambon?.trim() || null,
      age: payload.age !== null && payload.age !== undefined ? Number(payload.age) : null,
      adlScore: payload.adlScore !== null && payload.adlScore !== undefined ? Number(payload.adlScore) : null,
      areaZone: payload.areaZone?.trim() || null,
      createdBy: user,
    })

    const insertId = Number(createRes?.insertId || 0)
    this.invalidateCache()

    const created = insertId ? await this.getRegistryById(insertId) : null
    const resolved = created || (await this.getRegistryByHn(cleanHn))
    if (!resolved) {
      throw new Error('Failed to retrieve newly created LTC record')
    }

    try {
      await logAudit(
        'CREATE',
        'long_term_care_registries',
        `Created LTC registry record ID: ${resolved.id} (HN: ${cleanHn}, Name: ${resolved.patientName})`,
        { username: context?.username, email: context?.email }
      )
    } catch (auditErr) {
      logger.error({ auditErr }, 'Failed to write LTC create audit log')
    }

    return resolved
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

    const updatePayload: Record<string, unknown> = {
      updatedBy: context?.username || 'system',
    }
    if (payload.patientName !== undefined) updatePayload.patientName = payload.patientName.trim()
    if (payload.cid !== undefined) updatePayload.cid = payload.cid ? payload.cid.trim() : null
    if (payload.address !== undefined) updatePayload.address = payload.address ? payload.address.trim() : null
    if (payload.moo !== undefined) updatePayload.moo = payload.moo ? payload.moo.trim() : null
    if (payload.tambon !== undefined) updatePayload.tambon = payload.tambon ? payload.tambon.trim() : null
    if (payload.age !== undefined) updatePayload.age = payload.age !== null ? Number(payload.age) : null
    if (payload.adlScore !== undefined) updatePayload.adlScore = payload.adlScore !== null ? Number(payload.adlScore) : null
    if (payload.areaZone !== undefined) updatePayload.areaZone = payload.areaZone ? payload.areaZone.trim() : null

    await apiGateway.app.updateLtcRegistry(id, updatePayload)
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

    await apiGateway.app.deleteLtcRegistry(id)
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
   * Syncs and verifies CID and demographic details from HOSxP for LTC registries via Gateway.
   */
  static async syncWithHosxp(
    recordId?: number,
    context?: LtcMutationContext
  ): Promise<{
    totalChecked: number
    updatedCount: number
    mismatches: Array<{ hn: string; currentName: string; hosName: string; cid: string }>
  }> {
    const res = await apiGateway.app.syncLtcWithHosxp({
      recordId,
      actor: context?.username || 'hosxp_sync',
    })
    const totalChecked = Number(res?.totalChecked || 0)
    const updatedCount = Number(res?.updatedCount || 0)
    const mismatches = Array.isArray(res?.mismatches) ? res.mismatches : []

    if (updatedCount > 0) {
      this.invalidateCache()
    }

    if (totalChecked > 0) {
      try {
        await logAudit(
          'UPDATE',
          'long_term_care_registries',
          `Synced LTC records with HOSxP (Checked: ${totalChecked}, Updated: ${updatedCount}, Mismatches: ${mismatches.length})`,
          { username: context?.username, email: context?.email }
        )
      } catch (auditErr) {
        logger.error({ auditErr }, 'Failed to write LTC sync audit log')
      }
    }

    return {
      totalChecked,
      updatedCount,
      mismatches,
    }
  }
}
