import { headers } from 'next/headers'
import { verifyMemberSession } from './memberAuth'
import { queryMemberDb } from './memberDb'

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
    console.error('Error writing audit log:', error)
  }
}
