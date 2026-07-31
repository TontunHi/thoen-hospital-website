import { NextResponse } from 'next/server'
import { querySalaryDb, querySalaryEditDb } from '@/lib/salaryDb'
import { verifySalarySession } from '@/lib/salaryAuth'

export async function GET(request: Request) {
  try {
    // 1. Authenticate user from signed session cookie
    const user = await verifySalarySession()

    if (!user || !user.username) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 })
    }

    const username = user.username // Citizen ID (matches c2 in salary and ot)

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
    console.error('Failed to fetch salary data:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 })
  }
}
