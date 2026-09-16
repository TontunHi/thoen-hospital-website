import { headers } from 'next/headers'
import { verifyMemberSession } from './memberAuth'
import { queryMemberDb } from './memberDb'

import { logger } from './logger'

export type AuditActionType = 'LOGIN' | 'LOGOUT' | 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'REQUEST' | 'SYSTEM'

export async function logAudit(
  actionType: AuditActionType,
  targetTable: string,
  actionDetails: string,
  sessionData?: { username: string; email: string } | null
) {
  try {
    // Avoid recursion if logAudit itself queries audit_logs
    if (targetTable.toLowerCase() === 'audit_logs') {
      return
    }

    let username: string | null = null
    let email: string | null = null

    if (sessionData) {
      username = sessionData.username
      email = sessionData.email
    } else {
      try {
        const session = await verifyMemberSession()
        if (session) {
          username = session.username
          email = session.email
        }
      } catch {
        // Not in a request context with cookies, or not logged in
      }
    }

    let ipAddress: string | null = null
    let userAgent: string | null = null

    try {
      const reqHeaders = await headers()
      ipAddress = reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-real-ip')
      // If multiple IPs in x-forwarded-for, get the first one (client IP)
      if (ipAddress && ipAddress.includes(',')) {
        ipAddress = ipAddress.split(',')[0].trim()
      }
      userAgent = reqHeaders.get('user-agent')
    } catch {
      // Outside HTTP request context
    }

    // Insert into audit_logs table
    await queryMemberDb(
      `INSERT INTO audit_logs (username, email, action_type, target_table, action_details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        username,
        email,
        actionType,
        targetTable,
        actionDetails,
        ipAddress ? ipAddress.substring(0, 45) : null,
        userAgent ? userAgent.substring(0, 255) : null
      ]
    )
  } catch (error) {
    logger.error({ error }, 'Error writing audit log')
  }
}

// In-memory throttle cache to prevent log pollution from auto-refreshing monitor views
const auditThrottleCache = new Map<string, number>()

/**
 * Logs audit record only once per cooldown window for a specific user, action, and target.
 * Prevents rapid auto-refreshing dashboards (e.g. 10s/20s intervals) from polluting audit_logs.
 * 
 * @param actionType Action type (e.g. 'READ')
 * @param targetTable Target table or resource name
 * @param actionDetails Description of the action
 * @param sessionData User session credentials
 * @param cooldownMs Cooldown duration in milliseconds (default: 15 minutes / 900,000 ms)
 */
export async function logThrottledAudit(
  actionType: AuditActionType,
  targetTable: string,
  actionDetails: string,
  sessionData?: { username: string; email: string } | null,
  cooldownMs = 15 * 60 * 1000 // 15 minutes default
): Promise<boolean> {
  const actor = sessionData?.username || 'anonymous'
  const cacheKey = `${actor}:${targetTable}:${actionType}`
  const now = Date.now()

  const lastLogged = auditThrottleCache.get(cacheKey)
  if (lastLogged && (now - lastLogged) < cooldownMs) {
    // Within cooldown period: skip writing duplicate log
    return false
  }

  // Update timestamp in cache
  auditThrottleCache.set(cacheKey, now)

  // Prevent memory leak if cache grows large
  if (auditThrottleCache.size > 500) {
    for (const [k, timestamp] of auditThrottleCache.entries()) {
      if (now - timestamp > cooldownMs) {
        auditThrottleCache.delete(k)
      }
    }
  }

  // Execute actual log audit write
  await logAudit(actionType, targetTable, actionDetails, sessionData)
  return true
}

export function _resetAuditThrottleCacheForTesting() {
  auditThrottleCache.clear()
}
