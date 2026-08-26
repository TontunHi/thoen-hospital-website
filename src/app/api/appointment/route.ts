import { NextResponse } from 'next/server'
import { queryAppointmentDb } from '@/lib/appointmentDb'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rateLimit'

const searchSchema = z.object({
  q: z
    .string({ error: 'กรุณาระบุเลขบัตรประชาชน' })
    .length(13, 'เลขบัตรประชาชนต้องยาว 13 หลัก')
    .regex(/^\d+$/, 'เลขบัตรประชาชนต้องเป็นตัวเลขเท่านั้น')
    .trim(),
})

export async function GET(request: Request) {
  try {
    // Apply rate limiting: Max 30 queries per 15 minutes per IP to prevent dictionary scraping attacks on CID
    const rateCheck = await checkRateLimit({ key: 'appointment-query', maxAttempts: 30, windowSeconds: 900 })
    if (!rateCheck.allowed) {
      return rateCheck.response!
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    const parsed = searchSchema.safeParse({ q })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const searchValue = parsed.data.q

    const sql = `
      SELECT 
        ap.hn,
        concat(pt.pname, pt.fname, ' ', pt.lname) as ptname,
        ap.nextdate as appoint_date,
        ap.nexttime as appoint_time,
        c.name as clinic_name,
        d.name as doctor_name,
        ap.note as appoint_note,
        ap.app_no
      FROM oapp ap
      LEFT OUTER JOIN patient pt ON ap.hn = pt.hn
      LEFT OUTER JOIN clinic c ON ap.clinic = c.clinic
      LEFT OUTER JOIN doctor d ON ap.doctor = d.code
      WHERE pt.cid = ?
        AND (ap.app_no IS NULL OR ap.app_no != 'C')
      ORDER BY ap.nextdate DESC, ap.nexttime DESC
    `

    const appointments = await queryAppointmentDb(sql, [searchValue])

    // Mask patient name for PDPA compliance (Readable & Secure):
    // e.g. "นาย สมชาย ใจดี" -> "นาย สมช** ใจ**"
    // e.g. "นางสาว วิภาวดี รักสงบ" -> "นางสาว วิภา** รัก***"
    const maskPatientName = (fullName: string | null): string => {
      if (!fullName) return 'ผู้รับบริการ'
      const trimmed = fullName.trim()
      if (!trimmed) return 'ผู้รับบริการ'

      // Common Thai prefixes/titles
      const prefixes = [
        'เด็กชาย', 'เด็กหญิง', 'นางสาว', 'นาย', 'นาง', 
        'ด.ช.', 'ด.ญ.', 'น.ส.', 'ด.ต.', 'พ.ต.ท.', 'พ.ต.อ.', 'ร.ต.อ.', 'ร.ต.ท.', 'ร.ต.ต.',
        'พญ.', 'นพ.', 'ทพ.', 'ทพญ.', 'ภก.', 'ภญ.', 'ผศ.', 'รศ.', 'ศ.', 'ดร.'
      ]

      let title = ''
      let remaining = trimmed

      for (const p of prefixes) {
        if (remaining.startsWith(p)) {
          title = p
          remaining = remaining.substring(p.length).trim()
          break
        }
      }

      const parts = remaining.split(/\s+/).filter(Boolean)
      if (parts.length === 0) return trimmed

      const firstName = parts[0]
      const lastName = parts.slice(1).join(' ')

      // Mask first name: Keep up to 3-4 chars, then mask trailing chars (at least 2 stars)
      let maskedFirst = firstName
      if (firstName.length > 3) {
        const visibleLen = Math.max(2, Math.floor(firstName.length * 0.6))
        maskedFirst = `${firstName.substring(0, visibleLen)}**`
      } else if (firstName.length > 1) {
        maskedFirst = `${firstName.substring(0, 1)}**`
      }

      // Mask last name if present: Keep initial 2-3 chars, mask the rest
      let maskedLast = ''
      if (lastName) {
        if (lastName.length > 3) {
          const visibleLen = Math.max(2, Math.floor(lastName.length * 0.5))
          maskedLast = `${lastName.substring(0, visibleLen)}***`
        } else if (lastName.length > 1) {
          maskedLast = `${lastName.substring(0, 1)}**`
        } else {
          maskedLast = `${lastName}*`
        }
      }

      const fullResult = [title, maskedFirst, maskedLast].filter(Boolean).join(' ')
      return fullResult.replace(/\s+/g, ' ').trim()
    }

    // Clean up dates and times for JSON response
    const formatted = appointments.map((app: any) => {
      let formattedDate = app.appoint_date
      if (app.appoint_date instanceof Date) {
        // Correct timezone offset for Date object conversion
        const offset = app.appoint_date.getTimezoneOffset()
        const localDate = new Date(app.appoint_date.getTime() - offset * 60 * 1000)
        formattedDate = localDate.toISOString().split('T')[0]
      }
      return {
        hn: app.hn,
        ptname: maskPatientName(app.ptname),
        appoint_date: formattedDate,
        appoint_time: app.appoint_time,
        clinic_name: app.clinic_name || 'ไม่ระบุห้องตรวจ',
        doctor_name: app.doctor_name || 'พบแพทย์ประจำห้องตรวจ',
        appoint_note: app.appoint_note || '-',
      }
    })

    return NextResponse.json({ success: true, appointments: formatted })
  } catch (error: any) {
    console.error('Appointment Query Error:', error)
    // Do not return raw SQL database errors to the client to prevent schema information leakage
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการดึงข้อมูลนัดหมาย กรุณาลองใหม่อีกครั้งในภายหลัง' },
      { status: 500 }
    )
  }
}
