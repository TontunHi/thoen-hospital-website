export interface PrismaWriteAuditEntry {
  actionType: 'CREATE' | 'UPDATE' | 'DELETE'
  targetTable: string
  details: string
}

/**
 * Models whose query arguments carry a full citizen ID or names. Their services
 * call logAudit themselves with masked values, so the generic hook must not
 * copy the raw arguments into audit_logs (CLAUDE.md PHI/PDPA rule).
 */
const SELF_AUDITED_MODELS = new Set(['MemberRegistration'])

const WRITE_OPERATIONS = ['create', 'createMany', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert']

/**
 * Decides the audit_logs row the Prisma client extension writes for a query.
 * Returns null for reads and for models that audit themselves.
 */
export function prismaWriteAuditEntry(model: string | undefined, operation: string, args: unknown): PrismaWriteAuditEntry | null {
  if (!WRITE_OPERATIONS.includes(operation)) return null
  if (model && SELF_AUDITED_MODELS.has(model)) return null

  let actionType: PrismaWriteAuditEntry['actionType'] = 'UPDATE'
  if (operation.startsWith('create')) actionType = 'CREATE'
  else if (operation.startsWith('delete')) actionType = 'DELETE'

  const safeArgs = JSON.stringify(args, (_, value) => (typeof value === 'bigint' ? value.toString() : value))
  return { actionType, targetTable: model || 'prisma', details: `Operation: ${operation} | Args: ${safeArgs}` }
}
