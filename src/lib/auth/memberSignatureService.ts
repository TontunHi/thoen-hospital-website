import { apiGateway } from '@/lib/apiGateway'
import { logAudit } from '@/lib/audit'
import { DocumentStorage } from '@/lib/storage/documentStorage'

export interface SignatureGatewayDeps {
  isSignatureFeatureEnabled: typeof apiGateway.app.isSignatureFeatureEnabled
  getMemberSignaturePath: typeof apiGateway.app.getMemberSignaturePath
  updateMemberSignaturePath: typeof apiGateway.app.updateMemberSignaturePath
  resolveMemberSignatureAccess: typeof apiGateway.app.resolveMemberSignatureAccess
}

export interface SignatureSessionContext {
  id?: number
  username: string
  email?: string
  role: string
}

export class SignatureServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message)
    this.name = 'SignatureServiceError'
  }
}

const MAX_SIGNATURE_SIZE_BYTES = 2 * 1024 * 1024 // 2MB
const MAX_BASE64_LENGTH = Math.ceil((MAX_SIGNATURE_SIZE_BYTES * 4) / 3) + 100
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export async function assertSignatureFeatureEnabled(
  role: string,
  gw: Pick<SignatureGatewayDeps, 'isSignatureFeatureEnabled'> = apiGateway.app
): Promise<void> {
  if (role === 'admin') return
  const res = await gw.isSignatureFeatureEnabled()
  if (!res.enabled) {
    throw new SignatureServiceError(
      'ระบบจัดการลายเซ็นอิเล็กทรอนิกส์ถูกปิดใช้งานชั่วคราว',
      403,
      'FEATURE_DISABLED'
    )
  }
}

export async function getMemberSignatureStatus(
  session: SignatureSessionContext,
  gw: Pick<SignatureGatewayDeps, 'isSignatureFeatureEnabled' | 'getMemberSignaturePath'> = apiGateway.app
): Promise<{ exists: boolean; updatedAt?: string | Date | null }> {
  await assertSignatureFeatureEnabled(session.role, gw)

  const info = await gw.getMemberSignaturePath(session.username)
  if (!info || !info.signaturePath) {
    return { exists: false }
  }

  return {
    exists: true,
    updatedAt: info.updatedAt,
  }
}

export async function saveMemberSignature(
  session: SignatureSessionContext,
  imageBase64: unknown,
  deps: {
    gw?: Pick<SignatureGatewayDeps, 'isSignatureFeatureEnabled' | 'updateMemberSignaturePath'>
    storage?: Pick<typeof DocumentStorage, 'save'>
  } = {}
): Promise<{ path: string }> {
  const gw = deps.gw ?? apiGateway.app
  const storage = deps.storage ?? DocumentStorage

  await assertSignatureFeatureEnabled(session.role, gw)

  if (
    !imageBase64 ||
    typeof imageBase64 !== 'string' ||
    !imageBase64.startsWith('data:image/png;base64,')
  ) {
    throw new SignatureServiceError(
      'รูปแบบไฟล์ลายเซ็นไม่ถูกต้อง',
      400,
      'INVALID_SIGNATURE_FORMAT'
    )
  }

  if (imageBase64.length > MAX_BASE64_LENGTH) {
    throw new SignatureServiceError(
      'ขนาดไฟล์ลายเซ็นต้องไม่เกิน 2MB',
      400,
      'SIGNATURE_TOO_LARGE'
    )
  }

  const base64Data = imageBase64.replace(/^data:image\/png;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')

  if (buffer.length > MAX_SIGNATURE_SIZE_BYTES) {
    throw new SignatureServiceError(
      'ขนาดไฟล์ลายเซ็นต้องไม่เกิน 2MB',
      400,
      'SIGNATURE_TOO_LARGE'
    )
  }

  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new SignatureServiceError(
      'ไฟล์ลายเซ็นไม่ใช่รูปภาพ PNG ที่ถูกต้อง',
      400,
      'INVALID_PNG_MAGIC'
    )
  }

  const safeUsername = session.username.replace(/[^a-zA-Z0-9_-]/g, '_')
  const stored = await storage.save(buffer, {
    destinationDir: `storage/${safeUsername}`,
    baseName: 'signature.png',
    allowedMimeTypes: ['image/png'],
    allowedExtensions: ['.png'],
    maxSizeBytes: MAX_SIGNATURE_SIZE_BYTES,
    collisionStrategy: 'fixed',
    allowedRootPrefixes: ['storage'],
  })

  await gw.updateMemberSignaturePath(session.username, stored.relativePath)

  await logAudit(
    'UPDATE',
    'members',
    'บันทึกหรืออัปเดตลายเซ็นอิเล็กทรอนิกส์ (E-Signature)',
    { username: session.username, email: session.email }
  )

  return { path: stored.relativePath }
}

export async function readMemberSignatureImage(
  session: SignatureSessionContext,
  params: { path?: string | null; userId?: string | null },
  deps: {
    gw?: Pick<SignatureGatewayDeps, 'getMemberSignaturePath' | 'resolveMemberSignatureAccess'>
    storage?: Pick<typeof DocumentStorage, 'readBuffer'>
  } = {}
): Promise<Buffer> {
  const gw = deps.gw ?? apiGateway.app
  const storage = deps.storage ?? DocumentStorage

  if (params.path) {
    if (session.role !== 'admin') {
      const ownInfo = await gw.getMemberSignaturePath(session.username)
      const ownSignature = ownInfo?.signaturePath
      if (!ownSignature || ownSignature !== params.path) {
        throw new SignatureServiceError(
          'คุณไม่มีสิทธิ์เข้าถึงลายเซ็นนี้',
          403,
          'FORBIDDEN_SIGNATURE_ACCESS'
        )
      }
    }

    try {
      return await storage.readBuffer(params.path)
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'FILE_NOT_FOUND') {
        throw new SignatureServiceError(
          'ไม่พบไฟล์ลายเซ็นบนเซิร์ฟเวอร์',
          404,
          'FILE_NOT_FOUND'
        )
      }
      throw new SignatureServiceError(
        'ไม่ได้รับอนุญาตให้เข้าถึงไฟล์นี้',
        403,
        'FORBIDDEN_FILE_ACCESS'
      )
    }
  }

  let targetUsername = session.username
  if (params.userId) {
    const resolved = await gw.resolveMemberSignatureAccess({
      sessionUsername: session.username,
      sessionEmail: session.email || '',
      targetUserId: params.userId,
    })

    if (!resolved.sessionUser) {
      throw new SignatureServiceError('ไม่พบผู้ใช้ของคุณในระบบ', 404, 'SESSION_USER_NOT_FOUND')
    }
    const currentUser = resolved.sessionUser
    const targetUserIdParsed = Number.parseInt(params.userId, 10)

    if (!resolved.targetUser) {
      throw new SignatureServiceError('ไม่พบผู้ใช้ที่ระบุ', 404, 'TARGET_USER_NOT_FOUND')
    }

    if (currentUser.id !== targetUserIdParsed && currentUser.role !== 'admin') {
      throw new SignatureServiceError(
        'คุณไม่มีสิทธิ์เข้าถึงลายเซ็นของผู้ใช้นี้',
        403,
        'FORBIDDEN_USER_SIGNATURE'
      )
    }
    targetUsername = resolved.targetUser.username
  }

  const info = await gw.getMemberSignaturePath(targetUsername)
  if (!info || !info.signaturePath) {
    throw new SignatureServiceError('ไม่พบลายเซ็นดิจิทัล', 404, 'SIGNATURE_NOT_FOUND')
  }

  try {
    return await storage.readBuffer(info.signaturePath)
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'FILE_NOT_FOUND') {
      throw new SignatureServiceError(
        'ไม่พบไฟล์ลายเซ็นบนเซิร์ฟเวอร์',
        404,
        'FILE_NOT_FOUND'
      )
    }
    throw err
  }
}
