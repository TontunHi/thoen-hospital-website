import { NextResponse } from 'next/server'
import { queryMemberDb } from '@/lib/memberDb'
import { requireNewsPermission } from '@/lib/memberAuth'
import { heroSlideSchema } from '@/lib/schemas/heroSlide'
import { logAudit } from '@/lib/audit'
import { toDbSqlDateTime } from '@/lib/events/eventTimeUtils'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'

    let slides: any[]
    if (all) {
      // For Admin: fetch all slides ordered by displayOrder then creation date
      slides = await queryMemberDb(`
        SELECT id, image_path AS imagePath, title, link_url AS linkUrl, start_date AS startDate, end_date AS endDate, display_order AS displayOrder, duration, created_at AS createdAt, updated_at AS updatedAt
        FROM hero_slides
        ORDER BY display_order ASC, created_at DESC
      `)

      // Normalize gaps if any exist
      let hasGap = false
      for (let i = 0; i < slides.length; i++) {
        if (slides[i].displayOrder !== i + 1) {
          hasGap = true
          break
        }
      }

      if (hasGap) {
        for (let i = 0; i < slides.length; i++) {
          if (slides[i].displayOrder !== i + 1) {
            await queryMemberDb('UPDATE hero_slides SET display_order = ? WHERE id = ?', [i + 1, slides[i].id])
            slides[i].displayOrder = i + 1
          }
        }
      }
    } else {
      // For Public: fetch only scheduled/active slides
      slides = await queryMemberDb(`
        SELECT id, image_path AS imagePath, title, link_url AS linkUrl, start_date AS startDate, end_date AS endDate, display_order AS displayOrder, duration, created_at AS createdAt, updated_at AS updatedAt
        FROM hero_slides
        WHERE start_date <= NOW() AND end_date >= NOW()
        ORDER BY display_order ASC, created_at DESC
      `)
    }

    // Fetch slide duration setting
    let slideDuration = 6
    try {
      const durationRows = await queryMemberDb(
        "SELECT config_value AS configValue FROM member_system_settings WHERE config_key = 'hero_slide_duration_seconds' LIMIT 1"
      )
      if (durationRows.length > 0 && durationRows[0]?.configValue) {
        const parsedSec = parseInt(durationRows[0].configValue, 10)
        if (!isNaN(parsedSec) && parsedSec >= 2 && parsedSec <= 30) {
          slideDuration = parsedSec
        }
      }
    } catch {
      // Fallback to default
    }

    return NextResponse.json({ success: true, slides, slideDuration })
  } catch (error: any) {
    console.error('Fetch slides error:', error)
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลสไลด์ภาพได้' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const body = await request.json()
    const { slideDuration } = body

    const durationNum = typeof slideDuration === 'number' ? slideDuration : parseInt(String(slideDuration), 10)

    if (isNaN(durationNum) || durationNum < 2 || durationNum > 30) {
      return NextResponse.json(
        { error: 'ความเร็วการเปลี่ยนสไลด์ต้องอยู่ระหว่าง 2 ถึง 30 วินาที' },
        { status: 400 }
      )
    }

    await queryMemberDb(`
      INSERT INTO member_system_settings (config_key, config_value, updated_at)
      VALUES ('hero_slide_duration_seconds', ?, NOW())
      ON DUPLICATE KEY UPDATE config_value = ?, updated_at = NOW()
    `, [String(durationNum), String(durationNum)])

    await logAudit(
      'UPDATE',
      'member_system_settings',
      `ตั้งค่าความเร็วสไลด์โชว์หน้าแรกเป็น ${durationNum} วินาที`,
      authResult.session
    )

    return NextResponse.json({ success: true, slideDuration: durationNum })
  } catch (error: any) {
    console.error('Update slide duration error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่าความเร็วสไลด์' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Validate role
    const authResult = await requireNewsPermission()
    if (authResult.error) return authResult.error

    const body = await request.json()
    const parsed = heroSlideSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const { imagePath, title, linkUrl, startDate, endDate, displayOrder, duration } = parsed.data

    const dbStart = toDbSqlDateTime(startDate)
    const dbEnd = toDbSqlDateTime(endDate)

    let finalOrder = displayOrder
    if (!finalOrder || finalOrder <= 0) {
      const maxSlideRows = await queryMemberDb('SELECT MAX(display_order) AS maxOrder FROM hero_slides')
      const maxOrder = maxSlideRows[0]?.maxOrder ?? 0
      finalOrder = maxOrder + 1
    }

    const insertRes = await queryMemberDb(`
      INSERT INTO hero_slides (image_path, title, link_url, start_date, end_date, display_order, duration, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [imagePath, title || null, linkUrl || null, dbStart, dbEnd, finalOrder, duration || 6])

    const insertId = (insertRes as any)?.insertId || (insertRes as any)?.[0]?.insertId

    const slide = {
      id: insertId,
      imagePath,
      title: title || null,
      linkUrl: linkUrl || null,
      startDate: dbStart,
      endDate: dbEnd,
      displayOrder: finalOrder,
      duration: duration || 6,
    }

    await logAudit(
      'CREATE',
      'hero_slides',
      `สร้างสไลด์หัวเว็บ ID ${insertId || ''}: ${title || 'ไม่มีหัวข้อ'} (${imagePath.endsWith('.mp4') ? 'วิดีโอ MP4' : 'รูปภาพ'})`,
      authResult.session
    )

    return NextResponse.json({ success: true, slide }, { status: 201 })
  } catch (error: any) {
    console.error('Create slide error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึกสไลด์ภาพ' },
      { status: 500 }
    )
  }
}
