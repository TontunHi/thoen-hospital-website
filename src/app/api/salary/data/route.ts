import { NextResponse } from 'next/server'
import { querySalaryDb, querySalaryEditDb } from '@/lib/salaryDb'
import { verifySalarySession, destroySalarySession } from '@/lib/salaryAuth'
import { verifyMemberSession } from '@/lib/memberAuth'
import { queryMemberDb } from '@/lib/memberDb'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function GET(request: Request) {
  try {
    // 1. Verify Member session first to ensure current logged-in member
    const memberSession = await verifyMemberSession()
    if (!memberSession) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
    }

    // 2. Authenticate salary session
    const user = await verifySalarySession()

    // 3. Verify that the salary session belongs to the current member's bound salary_user
    // If mismatch or no salary session, destroy old salary cookie and return 401 so client auto-logs in via SSO
    const memberRows = await queryMemberDb(
      'SELECT salary_user FROM members WHERE username = ? LIMIT 1',
      [memberSession.username]
    )
    const expectedSalaryUser = memberRows[0]?.salary_user

    if (!user || !user.username || (expectedSalaryUser && user.username !== expectedSalaryUser)) {
      await destroySalarySession()
      return NextResponse.json({ error: 'เซสชันระบบเงินเดือนไม่ตรงกับผู้ใช้งานปัจจุบัน กรุณาเข้าสู่ระบบใหม่' }, { status: 401 })
    }

    logAudit(
      'READ',
      'salary',
      'Viewed personal salary and payslip records',
      { username: memberSession.username, email: memberSession.email }
    ).catch(err => logger.error({ err }, 'Salary data audit log failed'))

    const username = user.username // Citizen ID / salary_user (matches c2 in salary and ot)

    const { searchParams } = new URL(request.url)
    const selectedYear = searchParams.get('year') // e.g. "2567"
    const selectedMonth = searchParams.get('month') // e.g. "มีนาคม"

    // 2. Fetch all salary and OT records for this user (fetch all columns for in-memory mapping)
    let salaryRows: any[] = []
    let otRows: any[] = []
    let calendarRows: any[] = []

    try {
      salaryRows = await querySalaryDb(
        'SELECT * FROM salary WHERE c2 = ? ORDER BY c1 DESC',
        [username]
      )
      otRows = await querySalaryDb(
        'SELECT * FROM ot WHERE c2 = ? ORDER BY c1 DESC',
        [username]
      )
    } catch (dbError: any) {
      console.error('Database connection/query failed:', dbError)
      return NextResponse.json(
        { error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลเงินเดือนได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' },
        { status: 500 }
      )
    }

    try {
      calendarRows = await querySalaryEditDb(
        "SELECT id, type, datein, notesalary FROM datein WHERE MONTH(datein) = MONTH(NOW()) AND YEAR(datein) = YEAR(NOW()) ORDER BY ABS(DAY(datein)) ASC"
      )
    } catch (calErr: any) {
      console.warn('Calendar schedule fetch failed, continuing without calendar:', calErr)
    }


    // 3. Map periods for each record in-memory
    const periods = new Set<string>()
    
    const mappedSalaries = salaryRows.map(row => {
      // Clean period string: replace multiple spaces with a single space
      const cleanedPeriod = row.c8 ? row.c8.replace(/\s+/g, ' ').trim() : ''
      if (cleanedPeriod) {
        periods.add(cleanedPeriod)
      }
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
      const payMonth = payDate.getMonth() // 0 = January, 11 = December
      
      // Dec OT is paid in Jan of next year, adjust year back to Dec of previous year
      let otYear = payYear
      if (payMonth === 0 && otMonth === 'ธันวาคม') {
        otYear = payYear - 1;
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

    // Sort periods descending (latest first)
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

    // Unique Years list (sorted descending)
    const years = Array.from(new Set(parsedPeriods.map(p => p.year))).sort((a, b) => b.localeCompare(a))
    
    // Determine target Year and Month to return
    let targetYear = selectedYear
    let targetMonth = selectedMonth

    if (!targetYear && years.length > 0) {
      targetYear = years[0] // default to latest year
    }

    if (!targetMonth && targetYear) {
      const monthsForYear = parsedPeriods
        .filter(p => p.year === targetYear)
        .map(p => p.month)
      
      const monthOrder = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ]
      
      // Sort months according to calendar order and pick the latest one
      monthsForYear.sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a))
      if (monthsForYear.length > 0) {
        targetMonth = monthsForYear[0]
      }
    }

    // 4. Find the matching salary and OT data in-memory
    let salaryData = null
    let otData = null

    if (targetYear && targetMonth) {
      const searchPattern = `${targetMonth} ${targetYear}`
      
      const matchedSalary = mappedSalaries.find(r => r.computedPeriod === searchPattern)
      const matchedOt = mappedOts.find(r => r.computedPeriod === searchPattern)

      if (matchedSalary) {
        salaryData = matchedSalary
      }
      if (matchedOt) {
        otData = matchedOt
      }
    }

    return NextResponse.json({
      years,
      selectedYear: targetYear,
      selectedMonth: targetMonth,
      salary: salaryData,
      ot: otData,
      calendar: calendarRows,
      userName: user.name
    })
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch salary data')
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 })
  }
}
