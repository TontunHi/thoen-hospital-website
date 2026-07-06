import { NextResponse } from 'next/server'
import { requireMemberAdmin } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'

export async function GET(request: Request) {
  // 1. Enforce strict server-side session check for Admin role
  const auth = await requireMemberAdmin()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const offset = (page - 1) * limit

    const search = searchParams.get('search') || ''
    const actionType = searchParams.get('actionType') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    let query = 'SELECT * FROM audit_logs WHERE 1=1'
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1'
    const params: any[] = []

    if (search) {
      const searchPattern = `%${search}%`
      const searchCond = ' AND (username LIKE ? OR email LIKE ? OR target_table LIKE ? OR action_details LIKE ? OR ip_address LIKE ?)'
      query += searchCond
      countQuery += searchCond
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
    }

    if (actionType) {
      query += ' AND action_type = ?'
      countQuery += ' AND action_type = ?'
      params.push(actionType)
    }

    if (startDate) {
      query += ' AND timestamp >= ?'
      countQuery += ' AND timestamp >= ?'
      params.push(startDate)
    }

    if (endDate) {
      query += ' AND timestamp <= ?'
      countQuery += ' AND timestamp <= ?'
      params.push(endDate + ' 23:59:59')
    }

    query += ' ORDER BY timestamp DESC, id DESC LIMIT ? OFFSET ?'
    const queryParams = [...params, limit, offset]

    const totalRows = await queryMemberDb(countQuery, params)
    const total = totalRows[0]?.total || 0

    const logs = await queryMemberDb(query, queryParams)

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Fetch audit logs error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลประวัติการใช้งาน' },
      { status: 500 }
    )
  }
}
