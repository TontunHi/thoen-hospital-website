import { NextResponse } from 'next/server'
import { requireMemberAdmin } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { parseUserAgent } from '@/lib/userAgentParser'

export async function GET(request: Request) {
  const auth = await requireMemberAdmin()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const actionType = searchParams.get('actionType') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    let query = 'SELECT id, timestamp, username, email, action_type, target_table, action_details, ip_address, user_agent FROM audit_logs WHERE 1=1'
    const params: any[] = []

    if (search) {
      const searchPattern = `%${search}%`
      query += ' AND (username LIKE ? OR email LIKE ? OR target_table LIKE ? OR ip_address LIKE ?)'
      params.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }

    if (actionType) {
      query += ' AND action_type = ?'
      params.push(actionType)
    }

    if (startDate) {
      query += ' AND timestamp >= ?'
      params.push(startDate)
    }

    if (endDate) {
      query += ' AND timestamp <= ?'
      params.push(endDate + ' 23:59:59')
    }

    query += ' ORDER BY timestamp DESC, id DESC LIMIT 10000'

    const logs = await queryMemberDb(query, params)

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""'
      const val = String(str).replace(/"/g, '""')
      return `"${val}"`
    }

    const headers = [
      'ID', 
      'วัน-เวลา', 
      'ผู้ใช้งาน (Username)', 
      'อีเมล (Email)', 
      'ประเภท (Action)', 
      'ตาราง/เป้าหมาย (Target)', 
      'รายละเอียด (Details)', 
      'IP Address', 
      'อุปกรณ์ (Device)',
      'ระบบปฏิบัติการ (OS)',
      'เบราว์เซอร์ (Browser)',
      'User Agent แบบเต็ม'
    ]

    const csvRows = [
      headers.join(','),
      ...logs.map((log: any) => {
        const parsedUa = parseUserAgent(log.user_agent)
        const deviceTypeLabel = parsedUa.deviceType === 'desktop' 
          ? 'คอมพิวเตอร์ (Desktop)' 
          : parsedUa.deviceType === 'mobile' 
          ? `มือถือ (${parsedUa.deviceModel || 'Mobile'})` 
          : parsedUa.deviceType === 'tablet' 
          ? `แท็บเล็ต (${parsedUa.deviceModel || 'Tablet'})` 
          : parsedUa.deviceType === 'bot' 
          ? 'Bot / Script' 
          : 'ไม่ระบุ'

        return [
          escapeCsv(log.id),
          escapeCsv(log.timestamp),
          escapeCsv(log.username),
          escapeCsv(log.email),
          escapeCsv(log.action_type),
          escapeCsv(log.target_table),
          escapeCsv(log.action_details),
          escapeCsv(log.ip_address),
          escapeCsv(deviceTypeLabel),
          escapeCsv(parsedUa.os),
          escapeCsv(parsedUa.browser),
          escapeCsv(log.user_agent),
        ].join(',')
      })
    ]

    // Prepend UTF-8 BOM so Excel opens Thai characters correctly
    const csvContent = '\uFEFF' + csvRows.join('\r\n')

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit_logs_${Date.now()}.csv"`,
      },
    })
  } catch (error) {
    console.error('Export audit logs error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการส่งออกรายงาน' },
      { status: 500 }
    )
  }
}
