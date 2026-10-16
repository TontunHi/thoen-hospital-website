import { queryMemberDb } from '@/lib/memberDb'
import { checkRateLimit, secondsUntil } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { createRegistrationService, type RegistrationRecord } from './RegistrationService'

function mapDbRowToRegistration(row: any): RegistrationRecord {
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

/** Production wiring for RegistrationService via API Gateway (Zero-DB Architecture) */
export const registrationService = createRegistrationService({
  findExistingMember: async (query) => {
    const conditions: string[] = []
    const params: any[] = []

    if (query.citizenId) {
      conditions.push('username = ?')
      params.push(query.citizenId)
    }
    if (query.email) {
      conditions.push('LOWER(email) = LOWER(?)')
      params.push(query.email)
    }

    if (conditions.length === 0) return null

    const rows = await queryMemberDb(
      `SELECT id, username, email FROM members WHERE ${conditions.join(' OR ')} LIMIT 1`,
      params
    )
    if (rows.length === 0) return null
    return {
      id: rows[0].id,
      username: rows[0].username,
      email: rows[0].email,
    }
  },

  findPendingRegistration: async (query) => {
    const conditions: string[] = []
    const params: any[] = []

    if (query.citizenId) {
      conditions.push('citizen_id = ?')
      params.push(query.citizenId)
    }
    if (query.email) {
      conditions.push('LOWER(email) = LOWER(?)')
      params.push(query.email)
    }

    if (conditions.length === 0) return null

    let sql = `SELECT id, citizen_id AS citizenId, email FROM member_registrations WHERE status = 'pending' AND (${conditions.join(' OR ')})`
    if (query.excludeId) {
      sql += ' AND id != ?'
      params.push(query.excludeId)
    }
    sql += ' LIMIT 1'

    const rows = await queryMemberDb(sql, params)
    if (rows.length === 0) return null
    return {
      id: rows[0].id,
      citizenId: rows[0].citizenId,
      email: rows[0].email,
    }
  },

  createRegistration: async (data) => {
    const vehiclesJson = data.vehicles ? JSON.stringify(data.vehicles) : null

    const res: any = await queryMemberDb(`
      INSERT INTO member_registrations (
        citizen_id, title, first_name_th, last_name_th, first_name_en, last_name_en,
        nickname, license_no, birth_date, start_date, contain_date, department,
        position, level, personnel_group, personnel_group_other, has_hosxp,
        hosxp_user, hosxp_pass, email, phone, line_id, in_hospital_housing,
        housing_location, has_vehicle, vehicles, status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, 'pending', NOW(), NOW()
      )
    `, [
      data.citizenId,
      data.title,
      data.firstNameTh,
      data.lastNameTh,
      data.firstNameEn,
      data.lastNameEn,
      data.nickname,
      data.licenseNo || null,
      data.birthDate,
      data.startDate,
      data.containDate || null,
      data.department,
      data.position,
      data.level,
      data.personnelGroup,
      data.personnelGroupOther || null,
      data.hasHosxp ? 1 : 0,
      data.hosxpUser || null,
      data.hosxpPass || null,
      data.email,
      data.phone,
      data.lineId || null,
      data.inHospitalHousing ? 1 : 0,
      data.housingLocation || null,
      data.hasVehicle ? 1 : 0,
      vehiclesJson,
    ])

    return { id: res.insertId }
  },

  getRegistrationById: async (id: number) => {
    const rows = await queryMemberDb('SELECT * FROM member_registrations WHERE id = ? LIMIT 1', [id])
    if (rows.length === 0) return null
    return mapDbRowToRegistration(rows[0])
  },

  listRegistrations: async (filter) => {
    const page = filter.page && filter.page > 0 ? filter.page : 1
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 20
    const offset = (page - 1) * limit

    const whereClauses: string[] = []
    const params: any[] = []

    if (filter.status && filter.status !== 'all') {
      whereClauses.push('status = ?')
      params.push(filter.status)
    }

    if (filter.search && filter.search.trim()) {
      const search = `%${filter.search.trim()}%`
      whereClauses.push(`(
        citizen_id LIKE ? OR
        first_name_th LIKE ? OR
        last_name_th LIKE ? OR
        first_name_en LIKE ? OR
        last_name_en LIKE ? OR
        email LIKE ? OR
        department LIKE ? OR
        position LIKE ? OR
        phone LIKE ?
      )`)
      params.push(search, search, search, search, search, search, search, search, search)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const countRows = await queryMemberDb(
      `SELECT COUNT(*) AS total FROM member_registrations ${whereSql}`,
      params
    )
    const total = Number(countRows[0]?.total || 0)

    const itemRows = await queryMemberDb(
      `SELECT * FROM member_registrations ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return {
      items: itemRows.map(mapDbRowToRegistration),
      total,
    }
  },

  updateRegistration: async (id, data) => {
    const fields: string[] = []
    const params: any[] = []

    if (data.status !== undefined) { fields.push('status = ?'); params.push(data.status) }
    if (data.rejectReason !== undefined) { fields.push('reject_reason = ?'); params.push(data.rejectReason) }
    if (data.approvedBy !== undefined) { fields.push('approved_by = ?'); params.push(data.approvedBy) }
    if (data.approvedAt !== undefined) { fields.push('approved_at = ?'); params.push(data.approvedAt) }
    if (data.title !== undefined) { fields.push('title = ?'); params.push(data.title) }
    if (data.firstNameTh !== undefined) { fields.push('first_name_th = ?'); params.push(data.firstNameTh) }
    if (data.lastNameTh !== undefined) { fields.push('last_name_th = ?'); params.push(data.lastNameTh) }
    if (data.firstNameEn !== undefined) { fields.push('first_name_en = ?'); params.push(data.firstNameEn) }
    if (data.lastNameEn !== undefined) { fields.push('last_name_en = ?'); params.push(data.lastNameEn) }
    if (data.nickname !== undefined) { fields.push('nickname = ?'); params.push(data.nickname) }
    if (data.licenseNo !== undefined) { fields.push('license_no = ?'); params.push(data.licenseNo) }
    if (data.birthDate !== undefined) { fields.push('birth_date = ?'); params.push(data.birthDate) }
    if (data.startDate !== undefined) { fields.push('start_date = ?'); params.push(data.startDate) }
    if (data.containDate !== undefined) { fields.push('contain_date = ?'); params.push(data.containDate) }
    if (data.department !== undefined) { fields.push('department = ?'); params.push(data.department) }
    if (data.position !== undefined) { fields.push('position = ?'); params.push(data.position) }
    if (data.level !== undefined) { fields.push('level = ?'); params.push(data.level) }
    if (data.personnelGroup !== undefined) { fields.push('personnel_group = ?'); params.push(data.personnelGroup) }
    if (data.personnelGroupOther !== undefined) { fields.push('personnel_group_other = ?'); params.push(data.personnelGroupOther) }
    if (data.hasHosxp !== undefined) { fields.push('has_hosxp = ?'); params.push(data.hasHosxp ? 1 : 0) }
    if (data.hosxpUser !== undefined) { fields.push('hosxp_user = ?'); params.push(data.hosxpUser) }
    if (data.hosxpPass !== undefined) { fields.push('hosxp_pass = ?'); params.push(data.hosxpPass) }
    if (data.email !== undefined) { fields.push('email = ?'); params.push(data.email) }
    if (data.phone !== undefined) { fields.push('phone = ?'); params.push(data.phone) }
    if (data.lineId !== undefined) { fields.push('line_id = ?'); params.push(data.lineId) }
    if (data.inHospitalHousing !== undefined) { fields.push('in_hospital_housing = ?'); params.push(data.inHospitalHousing ? 1 : 0) }
    if (data.housingLocation !== undefined) { fields.push('housing_location = ?'); params.push(data.housingLocation) }
    if (data.hasVehicle !== undefined) { fields.push('has_vehicle = ?'); params.push(data.hasVehicle ? 1 : 0) }
    if (data.vehicles !== undefined) {
      fields.push('vehicles = ?')
      params.push(data.vehicles ? JSON.stringify(data.vehicles) : null)
    }

    if (fields.length > 0) {
      fields.push('updated_at = NOW()')
      params.push(id)
      await queryMemberDb(`UPDATE member_registrations SET ${fields.join(', ')} WHERE id = ?`, params)
    }

    return { id }
  },

  deleteRegistration: async (id) => {
    await queryMemberDb('DELETE FROM member_registrations WHERE id = ?', [id])
  },

  createMemberFromRegistration: async (data) => {
    await queryMemberDb(`
      INSERT INTO members (username, email, name, department, position, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        email = VALUES(email),
        name = VALUES(name),
        department = VALUES(department),
        position = VALUES(position),
        updated_at = NOW()
    `, [data.username, data.email, data.name, data.department, data.position, data.role])

    const rows = await queryMemberDb('SELECT id FROM members WHERE username = ? LIMIT 1', [data.username])
    return { id: rows[0]?.id }
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
