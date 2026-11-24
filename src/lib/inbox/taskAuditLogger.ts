import crypto from 'crypto'
import { apiGateway } from '@/lib/apiGateway'

export interface RecordAuditLogParams {
  taskId: string
  action: string
  performedBy: number | string
  performerName: string
  details: Record<string, any> | string
}

export interface InboxAuditGateway {
  recordInboxTaskAuditLogV2: typeof apiGateway.app.recordInboxTaskAuditLogV2
}

/**
 * Record an audit log entry in inbox_task_audit_logs via Gateway Named Endpoint
 */
export async function recordInboxTaskAuditLog(
  gatewayOrParams: InboxAuditGateway | RecordAuditLogParams,
  maybeParams?: RecordAuditLogParams
): Promise<string> {
  const hasGateway =
    typeof gatewayOrParams === 'object' &&
    gatewayOrParams !== null &&
    'recordInboxTaskAuditLogV2' in gatewayOrParams &&
    typeof gatewayOrParams.recordInboxTaskAuditLogV2 === 'function'

  const gateway: InboxAuditGateway = hasGateway
    ? (gatewayOrParams as InboxAuditGateway)
    : apiGateway.app
  const params: RecordAuditLogParams = (maybeParams ?? gatewayOrParams) as RecordAuditLogParams

  const id = crypto.randomUUID()
  const detailsStr =
    typeof params.details === 'string'
      ? params.details
      : JSON.stringify(params.details)

  await gateway.recordInboxTaskAuditLogV2({
    id,
    taskId: params.taskId,
    action: params.action,
    performedBy: params.performedBy,
    performerName: params.performerName,
    details: detailsStr,
  })

  return id
}

/**
 * Compute HMAC-SHA256 signature hash for document audit verification
 */
export function computeSignatureHash(payload: string, secret?: string): string {
  const hmacKey = secret || process.env.TASK_AUDIT_SECRET || 'thoen-hospital-audit-secret'
  return crypto.createHmac('sha256', hmacKey).update(payload).digest('hex')
}
