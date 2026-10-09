import { prisma } from '@/lib/prisma'
import { checkRateLimit, secondsUntil } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import { logAudit } from '@/lib/audit'
import { createRegistrationService, type RegistrationRecord } from './RegistrationService'
import type { Prisma } from '@prisma/client'

/** Production wiring for RegistrationService: Prisma, per-IP rate limit, Pino logger, audit trail. */
export const registrationService = createRegistrationService({
  findExistingMember: async (query) => {
    const conditions: Prisma.MemberWhereInput[] = []
    if (query.citizenId) conditions.push({ username: query.citizenId })
    if (query.email) conditions.push({ email: query.email })

    if (conditions.length === 0) return null

    return prisma.member.findFirst({
      where: { OR: conditions },
      select: { id: true, username: true, email: true },
    })
  },

  findPendingRegistration: async (query) => {
    const conditions: Prisma.MemberRegistrationWhereInput[] = []
    if (query.citizenId) conditions.push({ citizenId: query.citizenId })
    if (query.email) conditions.push({ email: query.email })

    if (conditions.length === 0) return null

    return prisma.memberRegistration.findFirst({
      where: {
        status: 'pending',
        OR: conditions,
        ...(query.excludeId ? { NOT: { id: query.excludeId } } : {}),
      },
      select: { id: true, citizenId: true, email: true },
    })
  },

  createRegistration: async (data) => {
    const result = await prisma.memberRegistration.create({
      data: {
        citizenId: data.citizenId,
        title: data.title,
        firstNameTh: data.firstNameTh,
        lastNameTh: data.lastNameTh,
        firstNameEn: data.firstNameEn,
        lastNameEn: data.lastNameEn,
        nickname: data.nickname,
        licenseNo: data.licenseNo || null,
        birthDate: data.birthDate,
        startDate: data.startDate,
        containDate: data.containDate || null,
        department: data.department,
        position: data.position,
        level: data.level,
        personnelGroup: data.personnelGroup,
        personnelGroupOther: data.personnelGroupOther || null,
        hasHosxp: data.hasHosxp,
        hosxpUser: data.hosxpUser || null,
        hosxpPass: data.hosxpPass || null,
        email: data.email,
        phone: data.phone,
        lineId: data.lineId || null,
        inHospitalHousing: data.inHospitalHousing,
        housingLocation: data.housingLocation || null,
        hasVehicle: data.hasVehicle,
        vehicles: data.vehicles ? JSON.parse(JSON.stringify(data.vehicles)) : undefined,
      },
      select: { id: true },
    })
    return result
  },

  getRegistrationById: async (id: number) => {
    const rec = await prisma.memberRegistration.findUnique({ where: { id } })
    return rec as unknown as RegistrationRecord | null
  },

  listRegistrations: async (filter) => {
    const page = filter.page && filter.page > 0 ? filter.page : 1
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 20
    const skip = (page - 1) * limit

    const where: Prisma.MemberRegistrationWhereInput = {}

    if (filter.status && filter.status !== 'all') {
      where.status = filter.status
    }

    if (filter.search && filter.search.trim()) {
      const search = filter.search.trim()
      where.OR = [
        { citizenId: { contains: search } },
        { firstNameTh: { contains: search } },
        { lastNameTh: { contains: search } },
        { firstNameEn: { contains: search } },
        { lastNameEn: { contains: search } },
        { email: { contains: search } },
        { department: { contains: search } },
        { position: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.memberRegistration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.memberRegistration.count({ where }),
    ])

    return {
      items: items as unknown as RegistrationRecord[],
      total,
    }
  },

  updateRegistration: async (id, data) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { ...data }
    if (data.vehicles !== undefined) {
      updateData.vehicles = data.vehicles ? JSON.parse(JSON.stringify(data.vehicles)) : null
    }

    const result = await prisma.memberRegistration.update({
      where: { id },
      data: updateData,
      select: { id: true },
    })
    return result
  },

  deleteRegistration: async (id) => {
    await prisma.memberRegistration.delete({ where: { id } })
  },

  createMemberFromRegistration: async (data) => {
    const member = await prisma.member.upsert({
      where: { username: data.username },
      update: {
        email: data.email,
        name: data.name,
        department: data.department,
        position: data.position,
      },
      create: {
        username: data.username,
        email: data.email,
        name: data.name,
        department: data.department,
        position: data.position,
        role: data.role,
      },
      select: { id: true },
    })
    return member
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
