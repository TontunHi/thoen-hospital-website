import { NextResponse } from 'next/server'
import { verifyMemberSession, checkPositionPermission } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { querySalaryDb, querySalaryEditDb } from '@/lib/salaryDb'

export async function GET(request: Request) {
  try {
    // 1. Verify caller session
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
    }

    // 2. Check permission (admin or position has 'view_all_salary')
    const isAuthorized = session.role === 'admin' || (await checkPositionPermission(session.username, 'view_all_salary'))
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลสลิปเงินเดือนของบุคลากรท่านอื่น' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const targetUsername = searchParams.get('username')?.trim()
    const selectedYear = searchParams.get('year')?.trim()
    const selectedMonth = searchParams.get('month')?.trim()

    if (!targetUsername) {
      return NextResponse.json({ 
        success: true, 
        member: null, 
        message: 'กรุณาระบุ Username ของบุคลากร' 
      })
    }

    // 3. Find target member in memberDb
    const memberRows = await queryMemberDb(
      'SELECT id, username, email, name, department, position, salary_user, salary_pass FROM members WHERE username = ? OR salary_user = ? LIMIT 1',
      [targetUsername, targetUsername]
    )

    if (!memberRows || memberRows.length === 0) {
      return NextResponse.json({
        success: false,
        notFound: true,
        error: `ไม่พบข้อมูลบุคลากรสำหรับรหัส "${targetUsername}" ในระบบสมาชิก`
      }, { status: 404 })
    }

    const targetMember = memberRows[0]
    // The identifier in salary / ot table (matches c2)
    const salaryLookupId = targetMember.salary_user || targetMember.username

    // 4. Fetch salary and ot records from salaryDb
    let salaryRows: any[] = []
    let otRows: any[] = []
    let calendarRows: any[] = []

    try {
      salaryRows = await querySalaryDb(
        'SELECT * FROM salary WHERE c2 = ? ORDER BY c1 DESC',
        [salaryLookupId]
      )
      otRows = await querySalaryDb(
        'SELECT * FROM ot WHERE c2 = ? ORDER BY c1 DESC',
        [salaryLookupId]
      )
    } catch (dbError: any) {
      console.error('Failed to query salary database:', dbError)
      return NextResponse.json(
        { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลเงินเดือนได้ในขณะนี้' },
        { status: 500 }
      )
    }

    try {
      calendarRows = await querySalaryEditDb(
        "SELECT id, type, datein, notesalary FROM datein WHERE MONTH(datein) = MONTH(NOW()) AND YEAR(datein) = YEAR(NOW()) ORDER BY ABS(DAY(datein)) ASC"
      )
    } catch (calErr: any) {
      console.warn('Calendar fetch failed, continuing without calendar:', calErr)
    }

    // 5. Map periods in-memory
    const periods = new Set<string>()

    const mappedSalaries = salaryRows.map(row => {
      const cleanedPeriod = row.c8 ? row.c8.replace(/\s+/g, ' ').trim() : ''
      if (cleanedPeriod) periods.add(cleanedPeriod)
      return {
        ...row,
        computedPeriod: cleanedPeriod
      }
    })

    const mappedOts = otRows.map(row => {
      if (!row.c10 || !row.c1) return { ...row, computedPeriod: '' }

      const otMonth = row.c10.trim()
      const payDate = new Date(row.c1)
      const payYear = payDate.getFullYear() + 543
      const payMonth = payDate.getMonth()

      let otYear = payYear
      if (payMonth === 0 && otMonth === 'ธันวาคม') {
        otYear = payYear - 1
      }

      const computedPeriod = `${otMonth} ${otYear}`
      periods.add(computedPeriod)
      return {
        ...row,
        computedPeriod
      }
    })

    // Parse and sort periods
    const parsedPeriods = Array.from(periods).map(p => {
      const parts = p.split(/\s+/)
      return {
        month: parts[0],
        year: parts[1],
        original: p
      }
    }).filter(p => p.month && p.year)

    parsedPeriods.sort((a, b) => {
      const monthOrder = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ]
      if (a.year !== b.year) {
        return b.year.localeCompare(a.year)
      }
      return monthOrder.indexOf(b.month) - monthOrder.indexOf(a.month)
    })

    const years = Array.from(new Set(parsedPeriods.map(p => p.year))).sort((a, b) => b.localeCompare(a))

    let targetYear = selectedYear
    let targetMonth = selectedMonth

    if (!targetYear && years.length > 0) {
      targetYear = years[0]
    }

    if (!targetMonth && targetYear) {
      const monthsForYear = parsedPeriods
        .filter(p => p.year === targetYear)
        .map(p => p.month)

      const monthOrder = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ]

      monthsForYear.sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a))
      if (monthsForYear.length > 0) {
        targetMonth = monthsForYear[0]
      }
    }

    let salaryData = null
    let otData = null

    if (targetYear && targetMonth) {
      const searchPattern = `${targetMonth} ${targetYear}`
      const matchedSalary = mappedSalaries.find(r => r.computedPeriod === searchPattern)
      const matchedOt = mappedOts.find(r => r.computedPeriod === searchPattern)

      if (matchedSalary) salaryData = matchedSalary
      if (matchedOt) otData = matchedOt
    }

    return NextResponse.json({
      success: true,
      member: {
        id: targetMember.id,
        username: targetMember.username,
        name: targetMember.name,
        department: targetMember.department,
        position: targetMember.position,
        salary_user: targetMember.salary_user
      },
      years,
      selectedYear: targetYear || '',
      selectedMonth: targetMonth || '',
      salary: salaryData,
      ot: otData,
      calendar: calendarRows,
      hasRecords: mappedSalaries.length > 0 || mappedOts.length > 0
    })
  } catch (error: any) {
    console.error('All salary API error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสลิปเงินเดือน' },
      { status: 500 }
    )
  }
}
