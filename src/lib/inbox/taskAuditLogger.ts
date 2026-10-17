import crypto from 'crypto'

export interface RecordAuditLogParams {
  taskId: string
  action: string
  performedBy: number | string
  performerName: string
  details: Record<string, any> | string
}

export type DbExecutor = (sql: string, params?: any[]) => Promise<any>

/**
 * Record an audit log entry in inbox_task_audit_logs
 */
export async function recordInboxTaskAuditLog(
  executor: DbExecutor,
  params: RecordAuditLogParams
): Promise<string> {
  const id = crypto.randomUUID()
  const detailsStr =
    typeof params.details === 'string'
      ? params.details
      : JSON.stringify(params.details)

  await executor(
    `INSERT INTO inbox_task_audit_logs (id, task_id, action, performed_by, performer_name, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      params.taskId,
      params.action,
      params.performedBy,
      params.performerName,
      detailsStr,
    ]
  )

  return id
}

/**
 * Compute HMAC-SHA256 signature hash for document audit verification
 */
export function computeSignatureHash(payload: string, secret?: string): string {
  const hmacKey = secret || process.env.TASK_AUDIT_SECRET || 'thoen-hospital-audit-secret'
  return crypto.createHmac('sha256', hmacKey).update(payload).digest('hex')
}
