import { headers } from 'next/headers'
import { queryMemberDb } from './memberDb'

import { logger } from './logger'

export type AuditActionType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'REQUEST'
  | 'SYSTEM'
  | 'UPDATE_PERMISSIONS'
  | 'UPDATE_SETTINGS'
  | 'UPDATE_MEMBER_PERMISSIONS'
  | 'BATCH_UPDATE_MEMBER_PERMISSIONS'

export type AuditAction = AuditActionType

/**
 * Mask Thai National Citizen ID or sensitive identifier for PDPA compliance.
 * Shows only the last 4 characters, masking the rest.
 */
export function maskAuditIdentifier(val?: string | null): string | null {
  if (!val) return null
  const str = String(val).trim()
  if (!str) return null

  // If already masked (contains x-xxxx, 3+ asterisks or bullets), keep as-is
  if (/x-xxxx/i.test(str) || /[•*]{3,}/.test(str)) {
    return str
  }

  // Preserve email addresses if used as username
  if (str.includes('@')) {
    return str
  }

  // Preserve non-PHI system accounts
  const lower = str.toLowerCase()
  if (['admin', 'system', 'cron', 'guest', 'anonymous', 'manager'].includes(lower)) {
    return str
  }

  const cleanDigits = str.replace(/\D/g, '')

  // 13-digit Thai National ID (e.g. 1234567890123 or 1-2345-67890-12-3)
  if (cleanDigits.length === 13) {
    return `x-xxxx-xxxxx-${cleanDigits.slice(9, 11)}-${cleanDigits.slice(11, 13)}`
  }

  // Identifiers longer than 4 characters containing digits (e.g. employee CID / phone / account)
  if (str.length > 4 && cleanDigits.length >= 4) {
    return `x-xxxx-xxxxx-${str.slice(-4)}`
  }

  return str
}

/**
 * Automatically masks sensitive PHI (Citizen IDs, HNs, phone numbers) inside audit action details
 * to ensure uniform PDPA compliance across all hospital modules and API endpoints.
 */
export function maskAuditDetails(details?: string | null): string {
  if (!details) return ''
  let text = String(details)

  // 1. Mask 13-digit Thai Citizen IDs (unformatted: \b\d{13}\b)
  text = text.replace(/\b(\d{9})(\d{2})(\d{2})\b/g, (_m, _p1, d1, d2) => {
    return `x-xxxx-xxxxx-${d1}-${d2}`
  })

  // 2. Mask formatted Thai Citizen IDs (e.g. 1-2345-67890-12-3)
  text = text.replace(/\b\d-\d{4}-\d{5}-(\d{2})-(\d)\b/g, (_m, d1, d2) => {
    return `x-xxxx-xxxxx-${d1}-${d2}`
  })

  // 3. Mask unmasked HN (Hospital Number) patterns (e.g. HN: 1234567 or HN 0012345)
  // Shows only the last 4 characters of the HN: xxxx4567
  text = text.replace(/\b(HN[:\s#]+)(\d{5,})\b/gi, (_m, prefix, hnDigits) => {
    return `${prefix}xxxx${hnDigits.slice(-4)}`
  })

  // 4. Mask explicit CID prefixes followed by digits (e.g. CID: 12345678 or เลขบัตร 12345678)
  text = text.replace(/\b(CID[:\s]+)(\d{5,})\b/gi, (_m, prefix, cidDigits) => {
    if (cidDigits.length === 13) {
      return `${prefix}x-xxxx-xxxxx-${cidDigits.slice(9, 11)}-${cidDigits.slice(11, 13)}`
    }
    return `${prefix}x-xxxx-xxxxx-${cidDigits.slice(-4)}`
  })

  // 5. Mask Thai mobile numbers (e.g. 0812345678, 091-234-5678)
  text = text.replace(/\b(0[689]\d)[-]?(\d{3})[-]?(\d{4})\b/g, (_m, p1, _p2, p3) => {
    return `${p1}-xxx-${p3}`
  })

  return text
}

export async function logAudit(
  actionType: AuditActionType,
  targetTable: string,
  actionDetails: string,
  sessionData?: { username?: string | null; email?: string | null; [key: string]: any } | null
) {
  try {
    // Avoid recursion if logAudit itself queries audit_logs
    if (targetTable.toLowerCase() === 'audit_logs') {
      return
    }

    let username: string | null = null
    let email: string | null = null

    if (sessionData) {
      username = sessionData.username ?? null
      email = sessionData.email ?? null
    } else {
      try {
        const { verifyMemberSession } = await import('./memberAuth')
        const session = await verifyMemberSession()
        if (session) {
          username = session.username
          email = session.email
        }
      } catch {
        // Not in a request context with cookies, or not logged in
      }
    }

    // Apply strict PDPA masking for username and action details
    const sanitizedUsername = maskAuditIdentifier(username)
    const sanitizedDetails = maskAuditDetails(actionDetails)

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
        sanitizedUsername,
        email,
        actionType,
        targetTable,
        sanitizedDetails,
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
  const actor = maskAuditIdentifier(sessionData?.username) || 'anonymous'
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
