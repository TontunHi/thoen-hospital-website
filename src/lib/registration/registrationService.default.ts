import { apiGateway } from '@/lib/apiGateway'
import { checkRateLimit, secondsUntil } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { createRegistrationService, type RegistrationRecord } from './RegistrationService'

function mapDbRowToRegistration(row: Record<string, any>): RegistrationRecord {
  let vehicles = row.vehicles
  if (typeof vehicles === 'string') {
    try {
      vehicles = JSON.parse(vehicles)
    } catch {
      vehicles = []
    }
  }

  return {
    id: row.id,
    citizenId: row.citizen_id,
    title: row.title,
    firstNameTh: row.first_name_th,
    lastNameTh: row.last_name_th,
    firstNameEn: row.first_name_en,
    lastNameEn: row.last_name_en,
    nickname: row.nickname,
    licenseNo: row.license_no || null,
    birthDate: row.birth_date,
    startDate: row.start_date,
    containDate: row.contain_date || null,
    department: row.department,
    position: row.position,
    level: row.level,
    personnelGroup: row.personnel_group,
    personnelGroupOther: row.personnel_group_other || null,
    hasHosxp: Boolean(row.has_hosxp),
    hosxpUser: row.hosxp_user || null,
    hosxpPass: row.hosxp_pass || null,
    email: row.email,
    phone: row.phone,
    lineId: row.line_id || null,
    inHospitalHousing: Boolean(row.in_hospital_housing),
    housingLocation: row.housing_location || null,
    hasVehicle: Boolean(row.has_vehicle),
    vehicles: vehicles || [],
    status: row.status,
    rejectReason: row.reject_reason || null,
    approvedAt: row.approved_at || null,
    approvedBy: row.approved_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Production wiring for RegistrationService via API Gateway Named Endpoints (Zero-SQL) */
export const registrationService = createRegistrationService({
  findExistingMember: async (query) => {
    if (!query.citizenId && !query.email) return null
    return apiGateway.app.findExistingMemberForRegistration(query)
  },

  findPendingRegistration: async (query) => {
    if (!query.citizenId && !query.email) return null
    return apiGateway.app.findPendingRegistrationV2(query)
  },

  createRegistration: async (data) => {
    return apiGateway.app.createRegistrationV2(data as unknown as Record<string, unknown>)
  },

  getRegistrationById: async (id: number) => {
    const row = await apiGateway.app.getRegistrationByIdV2(id)
    if (!row) return null
    return mapDbRowToRegistration(row)
  },

  listRegistrations: async (filter) => {
    const res = await apiGateway.app.listRegistrationsV2({
      status: filter.status,
      search: filter.search,
      page: filter.page,
      limit: filter.limit,
    })
    return {
      items: (res.items || []).map(mapDbRowToRegistration),
      total: res.total,
    }
  },

  updateRegistration: async (id, data) => {
    return apiGateway.app.updateRegistrationV2(id, data as unknown as Record<string, unknown>)
  },

  deleteRegistration: async (id) => {
    await apiGateway.app.deleteRegistrationV2(id)
  },

  createMemberFromRegistration: async (data) => {
    return apiGateway.app.createMemberFromRegistrationV2(data)
  },

  checkRateLimit: async () => {
    const result = await checkRateLimit({ key: 'member-register', maxAttempts: 10, windowSeconds: 900 })
    return {
      allowed: result.allowed,
      retryAfterSeconds: secondsUntil(result.resetTime, Date.now()),
    }
  },

  log: (message, context) => logger.info(context, message),
  audit: logAudit,
})
