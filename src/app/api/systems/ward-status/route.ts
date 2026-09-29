import { NextResponse } from 'next/server'
import { queryClinicalDb } from '@/lib/clinicalDb'
import { getCachedData } from '@/lib/cache'
import { checkRateLimit } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const rateCheck = await checkRateLimit({
      key: 'systems-ward-status',
      maxAttempts: 60,
      windowSeconds: 60,
    })
    if (!rateCheck.allowed) {
      return rateCheck.response!
    }

    const cacheKey = 'systems-ipd-ward-summary'

    const data = await getCachedData(
      cacheKey,
      async () => {
        // Query active admitted patients (dchdate is null)
        // Only select ward and bedno (No PHI / No names / No HNs)
        const sql = `
          SELECT 
            an.ward,
            p.bedno
          FROM an_stat an
          LEFT OUTER JOIN iptadm p ON an.an = p.an
          WHERE an.dchdate IS NULL
            AND an.ward IN ('02', '04', '05', '06', '09')
        `

        const rows = await queryClinicalDb(sql)

        let w1Count = 0 // สามัญ 1-20
        let w2Count = 0 // สามัญ 21-40
        let w3Count = 0 // ห้องแยก
        let icuCount = 0 // ICU
        let specialCount = 0 // ห้องพิเศษ
        let lrCount = 0 // ห้องคลอด
        let surgeryCount = 0 // ศัลยกรรม ร่มบุญ

        rows.forEach((row: any) => {
          const bed = (row.bedno || '').trim()
          const ward = (row.ward || '').trim()

          if (ward === '06') {
            if (bed.startsWith('Wย')) {
              w3Count++
            } else {
              const digits = parseInt(bed.replace(/\D/g, ''), 10)
              if (digits >= 1 && digits <= 20) {
                w1Count++
              } else if (digits >= 21 && digits <= 40) {
                w2Count++
              } else {
                w1Count++
              }
            }
          } else if (ward === '05') {
            icuCount++
          } else if (ward === '04') {
            specialCount++
          } else if (ward === '02') {
            lrCount++
          } else if (ward === '09') {
            surgeryCount++
          }
        })

        const sections = [
          {
            id: 'w1',
            title: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3 ห้องผู้ป่วยสามัญ เตียง 1 - 20',
            shortTitle: 'สามัญ 1-20',
            floor: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3',
            badgeColor: 'badge-emerald',
            accentColor: '#10b981',
            count: w1Count,
          },
          {
            id: 'w2',
            title: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3 ห้องผู้ป่วยสามัญ เตียง 21 - 40',
            shortTitle: 'สามัญ 21-40',
            floor: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3',
            badgeColor: 'badge-teal',
            accentColor: '#14b8a6',
            count: w2Count,
          },
          {
            id: 'w3',
            title: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3 ห้องแยก',
            shortTitle: 'ห้องแยก',
            floor: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3',
            badgeColor: 'badge-cyan',
            accentColor: '#06b6d4',
            count: w3Count,
          },
          {
            id: 'icu',
            title: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3 ห้องผู้ป่วยวิกฤต (ICU)',
            shortTitle: 'ICU',
            floor: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 3',
            badgeColor: 'badge-rose',
            accentColor: '#f43f5e',
            count: icuCount,
          },
          {
            id: 'special',
            title: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 4 ห้องพิเศษ',
            shortTitle: 'ห้องพิเศษ',
            floor: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 4',
            badgeColor: 'badge-purple',
            accentColor: '#a855f7',
            count: specialCount,
          },
          {
            id: 'lr',
            title: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 5 ห้องคลอด',
            shortTitle: 'ห้องคลอด',
            floor: 'อาคารร่มโพธิ์-ร่มไทร ชั้น 5',
            badgeColor: 'badge-amber',
            accentColor: '#f59e0b',
            count: lrCount,
          },
          {
            id: 'surgery',
            title: 'หอผู้ป่วยศัลยกรรม อาคารร่มบุญ',
            shortTitle: 'ศัลยกรรม ร่มบุญ',
            floor: 'อาคารร่มบุญ',
            badgeColor: 'badge-orange',
            accentColor: '#f97316',
            count: surgeryCount,
          },
        ]

        return {
          totalPatients: rows.length,
          updatedAt: new Date().toISOString(),
          sections,
        }
      },
      10000 // 10 seconds TTL
    )

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    logger.error({ error }, 'Systems ward status summary API error')
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการดึงข้อมูลสรุปสถานะผู้ป่วยนอนรักษาพยาบาล',
      },
      { status: 500 }
    )
  }
}
