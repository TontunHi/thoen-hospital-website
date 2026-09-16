import { NextResponse } from 'next/server'
import { queryHosDb } from '@/lib/hosDb'
import { verifyMemberSession } from '@/lib/memberAuth'
import { getCachedData } from '@/lib/cache'
import { logThrottledAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

interface PatientRecord {
  hn: string
  ptname: string
  age: number
  regdate: string
  admitDays: number
  bedno: string
  ward: string
  wardGroup: string
}

export async function GET() {
  try {
    const session = await verifyMemberSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: กรุณาเข้าสู่ระบบสมาชิก' },
        { status: 401 }
      )
    }

    logThrottledAudit(
      'READ',
      'an_stat',
      'Viewed IPD ward status and admitted patient list',
      { username: session.username, email: session.email }
    ).catch(err => logger.error({ err }, 'Ward status audit log failed'))

    const cacheKey = 'ipd-ward-status-data'

    const data = await getCachedData(cacheKey, async () => {
      // Base SQL: select patients who are currently admitted (dchdate is null)
      // Only select pname and fname (no lname) to respect PDPA
      const sql = `
        SELECT 
          pt.hn,
          TRIM(CONCAT(COALESCE(pt.pname, ''), ' ', COALESCE(pt.fname, ''))) AS ptname,
          TIMESTAMPDIFF(YEAR, pt.birthday, CURRENT_DATE()) AS age,
          DATE_FORMAT(an.regdate, '%Y-%m-%d') AS regdate,
          DATEDIFF(CURRENT_DATE(), an.regdate) AS admit_days,
          p.bedno,
          an.ward
        FROM an_stat an
        LEFT OUTER JOIN patient pt ON an.hn = pt.hn
        LEFT OUTER JOIN iptadm p ON an.an = p.an
        WHERE an.dchdate IS NULL
          AND an.ward IN ('02', '04', '05', '06', '09')
        ORDER BY p.bedno ASC
      `

      const rows = await queryHosDb(sql)

      // Map rows into groups based on ward and bedno conditions from original logic:
      // 1. ward '06', bedno W01-W20 (and variations Wท01-Wท20, W01ท-W20ท)
      // 2. ward '06', bedno W21-W40 (and variations W21ท-W40ท, Wท21-Wท40)
      // 3. ward '06', bedno LIKE 'Wย%'
      // 4. ward '05' -> ICU
      // 5. ward '04' -> Special Room
      // 6. ward '02' -> Labour Room
      // 7. ward '09' -> Surgery Ward (Rom Boon)

      const groups: Record<string, PatientRecord[]> = {
        w1: [], // ชั้น 3 สามัญ เตียง 1 - 20
        w2: [], // ชั้น 3 สามัญ เตียง 21 - 40
        w3: [], // ชั้น 3 ห้องแยก
        icu: [], // ชั้น 3 ICU
        special: [], // ชั้น 4 พิเศษ
        lr: [], // ชั้น 5 ห้องคลอด
        surgery: [], // ศัลยกรรม อาคารร่มบุญ
        other: [], // อื่นๆ ถ้ามี
      }

      rows.forEach((row: any) => {
        const bed = (row.bedno || '').trim()
        const ward = (row.ward || '').trim()

        const patient: PatientRecord = {
          hn: row.hn || '',
          ptname: row.ptname || 'ไม่ระบุชื่อ',
          age: Number(row.age) || 0,
          regdate: row.regdate || '',
          admitDays: Math.max(0, Number(row.admit_days) || 0),
          bedno: bed || '-',
          ward,
          wardGroup: '',
        }

        if (ward === '06') {
          if (bed.startsWith('Wย')) {
            patient.wardGroup = 'w3'
            groups.w3.push(patient)
          } else {
            // Extract numerical portion to group into 1-20 or 21-40
            const digits = parseInt(bed.replace(/\D/g, ''), 10)
            if (digits >= 1 && digits <= 20) {
              patient.wardGroup = 'w1'
              groups.w1.push(patient)
            } else if (digits >= 21 && digits <= 40) {
              patient.wardGroup = 'w2'
              groups.w2.push(patient)
            } else {
              patient.wardGroup = 'w1'
              groups.w1.push(patient)
            }
          }
        } else if (ward === '05') {
          patient.wardGroup = 'icu'
          groups.icu.push(patient)
        } else if (ward === '04') {
          patient.wardGroup = 'special'
          groups.special.push(patient)
        } else if (ward === '02') {
          patient.wardGroup = 'lr'
          groups.lr.push(patient)
        } else if (ward === '09') {
          patient.wardGroup = 'surgery'
          groups.surgery.push(patient)
        } else {
          patient.wardGroup = 'other'
          groups.other.push(patient)
        }
      })

      const sections = [
        {
          id: 'w1',
          title: 'ชั้น 3 ห้องผู้ป่วยสามัญ เตียง 1 - 20',
          shortTitle: 'สามัญ 1-20',
          floor: 'ชั้น 3',
          badgeColor: 'badge-emerald',
          accentColor: '#10b981',
          patients: groups.w1,
        },
        {
          id: 'w2',
          title: 'ชั้น 3 ห้องผู้ป่วยสามัญ เตียง 21 - 40',
          shortTitle: 'สามัญ 21-40',
          floor: 'ชั้น 3',
          badgeColor: 'badge-teal',
          accentColor: '#14b8a6',
          patients: groups.w2,
        },
        {
          id: 'w3',
          title: 'ชั้น 3 ห้องแยก',
          shortTitle: 'ห้องแยก',
          floor: 'ชั้น 3',
          badgeColor: 'badge-cyan',
          accentColor: '#06b6d4',
          patients: groups.w3,
        },
        {
          id: 'icu',
          title: 'ชั้น 3 ห้องผู้ป่วยวิกฤต (ICU)',
          shortTitle: 'ICU',
          floor: 'ชั้น 3',
          badgeColor: 'badge-rose',
          accentColor: '#f43f5e',
          patients: groups.icu,
        },
        {
          id: 'special',
          title: 'ชั้น 4 ห้องพิเศษ',
          shortTitle: 'ห้องพิเศษ',
          floor: 'ชั้น 4',
          badgeColor: 'badge-purple',
          accentColor: '#a855f7',
          patients: groups.special,
        },
        {
          id: 'lr',
          title: 'ชั้น 5 ห้องคลอด',
          shortTitle: 'ห้องคลอด',
          floor: 'ชั้น 5',
          badgeColor: 'badge-amber',
          accentColor: '#f59e0b',
          patients: groups.lr,
        },
        {
          id: 'surgery',
          title: 'หอผู้ป่วยศัลยกรรม อาคารร่มบุญ',
          shortTitle: 'ศัลยกรรม ร่มบุญ',
          floor: 'อาคารร่มบุญ',
          badgeColor: 'badge-orange',
          accentColor: '#f97316',
          patients: groups.surgery,
        },
      ]

      const totalPatients = rows.length

      return {
        totalPatients,
        updatedAt: new Date().toISOString(),
        sections,
      }
    }, 10000) // 10 seconds cache

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    logger.error({ error }, 'Ward status API error')
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานะผู้ป่วยนอนรักษาพยาบาล',
      },
      { status: 500 }
    )
  }
}
