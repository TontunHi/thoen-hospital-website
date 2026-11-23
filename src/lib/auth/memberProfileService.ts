import { queryMemberDb } from '@/lib/memberDb'
import { apiGateway } from '@/lib/apiGateway'
import { logAudit, maskAuditIdentifier } from '@/lib/audit'
import { DocumentStorage, sanitizeName } from '@/lib/storage/documentStorage'

export type MemberProfileQueryExecutor = <T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
) => Promise<T[]>

export class MemberProfileError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message)
    this.name = 'MemberProfileError'
  }
}

export const MemberProfileService = {
  async uploadProfilePicture(
    actor: { username: string; email: string },
    file: File | null,
    deps: {
      query?: MemberProfileQueryExecutor
      storage?: Pick<typeof DocumentStorage, 'save'>
    } = {}
  ): Promise<{ path: string }> {
    if (!file) {
      throw new MemberProfileError('ไม่พบไฟล์ที่อัปโหลด', 400)
    }

    const query = deps.query ?? queryMemberDb
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

    await query('UPDATE members SET profile_path = ? WHERE username = ?', [
      saved.relativePath,
      actor.username,
    ])

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
      query?: MemberProfileQueryExecutor
      storage?: Pick<typeof DocumentStorage, 'readBuffer'>
    } = {}
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const query = deps.query ?? queryMemberDb
    const storage = deps.storage ?? DocumentStorage

    let targetUsername = actor.username
    if (queryUserId) {
      const users = await query<{ username: string }>(
        'SELECT username FROM members WHERE id = ? LIMIT 1',
        [queryUserId]
      )
      if (users.length === 0) {
        throw new MemberProfileError('ไม่พบผู้ใช้ที่ระบุ', 404)
      }
      targetUsername = users[0].username
    }

    const members = await query<{ profile_path: string | null }>(
      'SELECT profile_path FROM members WHERE username = ? LIMIT 1',
      [targetUsername]
    )
    const profilePath = members[0]?.profile_path
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
    query: MemberProfileQueryExecutor = queryMemberDb
  ): Promise<void> {
    const keys = Object.keys(settingsPayload)
    for (const key of keys) {
      const val = settingsPayload[key]?.toString() || ''
      await query(
        `INSERT INTO member_system_settings (config_key, config_value) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE config_value = ?`,
        [key, val, val]
      )
    }

    await logAudit(
      'UPDATE_SETTINGS',
      'member_system_settings',
      `Admin updated system settings (${keys.join(', ')})`,
      { username: actor.username, email: actor.email }
    )
  },

  async syncSalaryCredentials(
    query: MemberProfileQueryExecutor = queryMemberDb
  ): Promise<{
    matchedCount: number
    notMatchedCount: number
    totalSalaryUsers: number
  }> {
    let salaryUsers: Array<{ user_name?: string; user_pass?: string }> = []
    try {
      salaryUsers = (await apiGateway.salary.getUsers()) as Array<{
        user_name?: string
        user_pass?: string
      }>
    } catch {
      throw new MemberProfileError('ไม่สามารถเชื่อมต่อฐานข้อมูลระบบเงินเดือนได้ในขณะนี้', 500)
    }

    const members = await query<{ id: number; username: string | null }>(
      'SELECT id, username FROM members'
    )
    const memberMap = new Map<string, number>()
    for (const m of members) {
      if (m.username) {
        memberMap.set(m.username.trim(), m.id)
      }
    }

    let matchedCount = 0
    let notMatchedCount = 0

    for (const sUser of salaryUsers) {
      const username = sUser.user_name?.trim()
      const password = sUser.user_pass?.trim()
      if (!username) continue

      const memberId = memberMap.get(username)
      if (memberId !== undefined) {
        await query(
          'UPDATE members SET salary_user = ?, salary_pass = ? WHERE id = ?',
          [username, password, memberId]
        )
        matchedCount++
      } else {
        notMatchedCount++
      }
    }

    return {
      matchedCount,
      notMatchedCount,
      totalSalaryUsers: salaryUsers.length,
    }
  },

  async listAllMembersForAdmin(query: MemberProfileQueryExecutor = queryMemberDb) {
    return query(
      "SELECT id, username, email, name, department, position, salary_user, IF(salary_pass IS NULL OR salary_pass = '', NULL, '********') AS salary_pass, role, created_at, updated_at FROM members ORDER BY created_at DESC"
    )
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
    query: MemberProfileQueryExecutor = queryMemberDb
  ): Promise<void> {
    const { username, email, name, department, position, salary_user, salary_pass, role } = body

    if (!username || !email || !role) {
      throw new MemberProfileError('ข้อมูลไม่ครบถ้วน กรุณากรอกข้อมูลที่จำเป็น', 400)
    }

    if (role !== 'member' && role !== 'admin' && role !== 'subdistrict') {
      throw new MemberProfileError('สิทธิ์การใช้งานไม่ถูกต้อง', 400)
    }

    const duplicates = await query<{ id: number }>(
      'SELECT id FROM members WHERE username = ? OR email = ?',
      [username.trim(), email.trim()]
    )

    if (duplicates && duplicates.length > 0) {
      throw new MemberProfileError('ชื่อผู้ใช้งานหรืออีเมลนี้ถูกใช้งานแล้วในระบบ', 400)
    }

    await query(
      `INSERT INTO members (username, email, name, department, position, salary_user, salary_pass, role) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        username.trim(),
        email.trim(),
        name ? name.trim() : null,
        department ? department.trim() : null,
        position ? position.trim() : null,
        salary_user ? salary_user.trim() : null,
        salary_pass ? salary_pass.trim() : null,
        role,
      ]
    )

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
    query: MemberProfileQueryExecutor = queryMemberDb
  ): Promise<void> {
    const { id, username, email, name, department, position, salary_user, salary_pass, role } = body

    if (!id || !username || !email || !role) {
      throw new MemberProfileError('ข้อมูลไม่ครบถ้วน กรุณากรอกข้อมูลที่จำเป็น', 400)
    }

    let finalRole = role
    if (actor.username) {
      const targetUser = await query<{ username: string; role: string }>(
        'SELECT username, role FROM members WHERE id = ?',
        [id]
      )
      if (targetUser && targetUser.length > 0 && targetUser[0].username === actor.username) {
        finalRole = targetUser[0].role
      }
    }

    if (finalRole !== 'member' && finalRole !== 'admin' && finalRole !== 'subdistrict') {
      throw new MemberProfileError('สิทธิ์การใช้งานไม่ถูกต้อง', 400)
    }

    const duplicates = await query<{ id: number }>(
      'SELECT id FROM members WHERE (username = ? OR email = ?) AND id != ?',
      [username.trim(), email.trim(), id]
    )

    if (duplicates && duplicates.length > 0) {
      throw new MemberProfileError('ชื่อผู้ใช้งานหรืออีเมลนี้ถูกใช้งานแล้วในระบบ', 400)
    }

    const existing = await query<{ salary_pass: string | null }>(
      'SELECT salary_pass FROM members WHERE id = ? LIMIT 1',
      [id]
    )
    const oldPass = existing.length > 0 ? existing[0].salary_pass : null
    const finalSalaryPass =
      salary_pass === '********' ? oldPass : salary_pass ? salary_pass.trim() : null

    await query(
      `UPDATE members 
       SET username = ?, email = ?, name = ?, department = ?, position = ?, salary_user = ?, salary_pass = ?, role = ?
       WHERE id = ?`,
      [
        username.trim(),
        email.trim(),
        name ? name.trim() : null,
        department ? department.trim() : null,
        position ? position.trim() : null,
        salary_user ? salary_user.trim() : null,
        finalSalaryPass,
        finalRole,
        id,
      ]
    )

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
    query: MemberProfileQueryExecutor = queryMemberDb
  ): Promise<void> {
    if (!id) {
      throw new MemberProfileError('ไม่พบ ID สมาชิกที่จะลบ', 400)
    }

    const targetUser = await query<{ username: string | null }>(
      'SELECT username FROM members WHERE id = ?',
      [id]
    )
    const targetUsername =
      targetUser && targetUser.length > 0 ? targetUser[0].username : null

    if (actor.username && targetUsername === actor.username) {
      throw new MemberProfileError('ไม่สามารถลบบัญชีของตัวเองได้', 400)
    }

    await query('DELETE FROM members WHERE id = ?', [id])

    await logAudit(
      'DELETE',
      'members',
      `Admin deleted member ID ${id} (${maskAuditIdentifier(targetUsername || id)})`,
      { username: actor.username, email: actor.email }
    )
  },
}
