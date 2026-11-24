import { apiGateway, GatewayError } from '@/lib/apiGateway'
import { logAudit, maskAuditIdentifier } from '@/lib/audit'
import { DocumentStorage, sanitizeName } from '@/lib/storage/documentStorage'

export interface MemberProfileGatewayAdapter {
  updateMemberProfilePath: typeof apiGateway.app.updateMemberProfilePath
  getMemberProfilePath: typeof apiGateway.app.getMemberProfilePath
  updateSystemSettings: typeof apiGateway.app.updateSystemSettings
  syncSalaryCredentialsToMembers: typeof apiGateway.app.syncSalaryCredentialsToMembers
  listAdminMembers: typeof apiGateway.app.listAdminMembers
  createAdminMember: typeof apiGateway.app.createAdminMember
  updateAdminMember: typeof apiGateway.app.updateAdminMember
  deleteAdminMember: typeof apiGateway.app.deleteAdminMember
  getSalaryUsers: typeof apiGateway.salary.getUsers
}

const defaultGatewayAdapter: MemberProfileGatewayAdapter = {
  updateMemberProfilePath: (...args) => apiGateway.app.updateMemberProfilePath(...args),
  getMemberProfilePath: (...args) => apiGateway.app.getMemberProfilePath(...args),
  updateSystemSettings: (...args) => apiGateway.app.updateSystemSettings(...args),
  syncSalaryCredentialsToMembers: (...args) => apiGateway.app.syncSalaryCredentialsToMembers(...args),
  listAdminMembers: () => apiGateway.app.listAdminMembers(),
  createAdminMember: (...args) => apiGateway.app.createAdminMember(...args),
  updateAdminMember: (...args) => apiGateway.app.updateAdminMember(...args),
  deleteAdminMember: (...args) => apiGateway.app.deleteAdminMember(...args),
  getSalaryUsers: () => apiGateway.salary.getUsers(),
}

export class MemberProfileError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message)
    this.name = 'MemberProfileError'
  }
}

function rethrowAsMemberProfileError(err: unknown): never {
  if (err instanceof MemberProfileError) throw err
  if (err instanceof GatewayError) {
    throw new MemberProfileError(err.message, err.status || 500)
  }
  throw err
}

export const MemberProfileService = {
  async uploadProfilePicture(
    actor: { username: string; email: string },
    file: File | null,
    deps: {
      gateway?: Partial<MemberProfileGatewayAdapter>
      storage?: Pick<typeof DocumentStorage, 'save'>
    } = {}
  ): Promise<{ path: string }> {
    if (!file) {
      throw new MemberProfileError('ไม่พบไฟล์ที่อัปโหลด', 400)
    }

    const gw = { ...defaultGatewayAdapter, ...deps.gateway }
    const storage = deps.storage ?? DocumentStorage
    const safeUsername = sanitizeName(actor.username)

    const saved = await storage.save(file, {
      destinationDir: `storage/${safeUsername}`,
      baseName: 'profile',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
      allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp'],
      maxSizeBytes: 5 * 1024 * 1024,
      collisionStrategy: 'fixed',
      allowedRootPrefixes: ['storage'],
    })

    try {
      await gw.updateMemberProfilePath(actor.username, saved.relativePath)
    } catch (err) {
      rethrowAsMemberProfileError(err)
    }

    await logAudit(
      'UPDATE',
      'members',
      'อัปเดตรูปภาพโปรไฟล์ผู้ใช้งาน (Profile Picture)',
      { username: actor.username, email: actor.email }
    )

    return { path: saved.relativePath }
  },

  async readProfileImage(
    actor: { username: string },
    queryUserId: string | null,
    deps: {
      gateway?: Partial<MemberProfileGatewayAdapter>
      storage?: Pick<typeof DocumentStorage, 'readBuffer'>
    } = {}
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const gw = { ...defaultGatewayAdapter, ...deps.gateway }
    const storage = deps.storage ?? DocumentStorage

    let profilePath: string | null = null
    try {
      const res = await gw.getMemberProfilePath({
        username: queryUserId ? undefined : actor.username,
        userId: queryUserId,
      })
      profilePath = res?.profilePath || null
    } catch (err) {
      rethrowAsMemberProfileError(err)
    }

    if (!profilePath) {
      throw new MemberProfileError('ไม่พบรูปโปรไฟล์', 404)
    }

    const ext = profilePath.split('.').pop()?.toLowerCase() || 'png'
    let contentType = 'image/png'
    if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg'
    else if (ext === 'webp') contentType = 'image/webp'

    try {
      const buffer = await storage.readBuffer(profilePath)
      return { buffer, contentType }
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'FILE_NOT_FOUND') {
        throw new MemberProfileError('ไม่พบไฟล์รูปโปรไฟล์บนเซิร์ฟเวอร์', 404)
      }
      throw err
    }
  },

  async updateSystemSettings(
    settingsPayload: Record<string, unknown>,
    actor: { username: string; email: string },
    gateway: Partial<MemberProfileGatewayAdapter> = {}
  ): Promise<void> {
    const gw = { ...defaultGatewayAdapter, ...gateway }
    const keys = Object.keys(settingsPayload)
    try {
      await gw.updateSystemSettings(settingsPayload)
    } catch (err) {
      rethrowAsMemberProfileError(err)
    }

    await logAudit(
      'UPDATE_SETTINGS',
      'member_system_settings',
      `Admin updated system settings (${keys.join(', ')})`,
      { username: actor.username, email: actor.email }
    )
  },

  async syncSalaryCredentials(
    gateway: Partial<MemberProfileGatewayAdapter> = {}
  ): Promise<{
    matchedCount: number
    notMatchedCount: number
    totalSalaryUsers: number
  }> {
    const gw = { ...defaultGatewayAdapter, ...gateway }
    let salaryUsers: Array<{ user_name?: string; user_pass?: string }> = []
    try {
      salaryUsers = (await gw.getSalaryUsers()) as Array<{
        user_name?: string
        user_pass?: string
      }>
    } catch {
      throw new MemberProfileError('ไม่สามารถเชื่อมต่อฐานข้อมูลระบบเงินเดือนได้ในขณะนี้', 500)
    }

    try {
      return await gw.syncSalaryCredentialsToMembers(salaryUsers)
    } catch (err) {
      rethrowAsMemberProfileError(err)
    }
  },

  async listAllMembersForAdmin(gateway: Partial<MemberProfileGatewayAdapter> = {}) {
    const gw = { ...defaultGatewayAdapter, ...gateway }
    return gw.listAdminMembers()
  },

  async createMemberByAdmin(
    body: {
      username?: string
      email?: string
      name?: string | null
      department?: string | null
      position?: string | null
      salary_user?: string | null
      salary_pass?: string | null
      role?: string
    },
    actor: { username: string; email: string },
    gateway: Partial<MemberProfileGatewayAdapter> = {}
  ): Promise<void> {
    const { username, email, department, role } = body

    if (!username || !email || !role) {
      throw new MemberProfileError('ข้อมูลไม่ครบถ้วน กรุณากรอกข้อมูลที่จำเป็น', 400)
    }

    if (role !== 'member' && role !== 'admin' && role !== 'subdistrict') {
      throw new MemberProfileError('สิทธิ์การใช้งานไม่ถูกต้อง', 400)
    }

    const gw = { ...defaultGatewayAdapter, ...gateway }
    try {
      await gw.createAdminMember(body)
    } catch (err) {
      rethrowAsMemberProfileError(err)
    }

    await logAudit(
      'CREATE',
      'members',
      `Admin created new member: ${maskAuditIdentifier(username.trim())} (role: ${role}, department: ${department ? department.trim() : '-'})`,
      { username: actor.username, email: actor.email }
    )
  },

  async updateMemberByAdmin(
    body: {
      id?: number | string
      username?: string
      email?: string
      name?: string | null
      department?: string | null
      position?: string | null
      salary_user?: string | null
      salary_pass?: string | null
      role?: string
    },
    actor: { username: string; email: string },
    gateway: Partial<MemberProfileGatewayAdapter> = {}
  ): Promise<void> {
    const { id, username, email, role } = body

    if (!id || !username || !email || !role) {
      throw new MemberProfileError('ข้อมูลไม่ครบถ้วน กรุณากรอกข้อมูลที่จำเป็น', 400)
    }

    const gw = { ...defaultGatewayAdapter, ...gateway }
    let finalRole = role
    try {
      const res = await gw.updateAdminMember(id, {
        ...body,
        actorUsername: actor.username,
      })
      if (res?.finalRole) finalRole = res.finalRole
    } catch (err) {
      rethrowAsMemberProfileError(err)
    }

    await logAudit(
      'UPDATE',
      'members',
      `Admin updated member ID ${id} (${maskAuditIdentifier(username.trim())}): role=${finalRole}`,
      { username: actor.username, email: actor.email }
    )
  },

  async deleteMemberByAdmin(
    id: string | null,
    actor: { username: string; email: string },
    gateway: Partial<MemberProfileGatewayAdapter> = {}
  ): Promise<void> {
    if (!id) {
      throw new MemberProfileError('ไม่พบ ID สมาชิกที่จะลบ', 400)
    }

    const gw = { ...defaultGatewayAdapter, ...gateway }
    let targetUsername: string | null = null
    try {
      const res = await gw.deleteAdminMember(id, actor.username)
      targetUsername = res?.targetUsername ?? null
    } catch (err) {
      rethrowAsMemberProfileError(err)
    }

    await logAudit(
      'DELETE',
      'members',
      `Admin deleted member ID ${id} (${maskAuditIdentifier(targetUsername || id)})`,
      { username: actor.username, email: actor.email }
    )
  },
}
