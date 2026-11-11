/**
 * Website Core Application Services (192.168.1.7)
 * Members, Permissions, News, Slides, Assets, Events, Attachments, Tasks, Contact Messages, Registrations
 */
export default async function appRoutes(fastify, options) {
  const { pools, getCached } = options;
  const { appPool } = pools;


// 3.1 List Members
fastify.get('/api/v1/app/members', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'ดึงรายชื่อสมาชิก/บุคลากรทั้งหมด (รองรับ search และ limit)',
    querystring: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        limit: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { search = '', limit = '' } = req.query || {}
  try {
    let sql = "SELECT id, username, email, name, department, position, salary_user, role, profile_path AS profilePath, created_at, updated_at FROM members"
    const params = []
    if (search && search.trim()) {
      sql += " WHERE (name LIKE ? OR department LIKE ? OR position LIKE ? OR username LIKE ?)"
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`)
    }
    sql += " ORDER BY name ASC, created_at DESC"
    if (limit && parseInt(limit, 10) > 0) {
      sql += " LIMIT ?"
      params.push(parseInt(limit, 10))
    }
    const [rows] = await appPool.query(sql, params)
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 3.2 Get Member by ID
fastify.get('/api/v1/app/members/:id', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'ดึงข้อมูลสมาชิกรายบุคคลตาม ID',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [rows] = await appPool.query(
      "SELECT id, username, email, name, department, position, salary_user, role, created_at, updated_at FROM members WHERE id = ? LIMIT 1",
      [id]
    )
    if (rows.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบสมาชิก' }
    }
    return { success: true, data: rows[0] }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 3.3 Create Member
fastify.post('/api/v1/app/members', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'เพิ่มสมาชิกใหม่เข้าสู่ระบบ',
    body: {
      type: 'object',
      required: ['username', 'email', 'role'],
      properties: {
        username: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
        department: { type: 'string' },
        position: { type: 'string' },
        role: { type: 'string', enum: ['member', 'admin', 'subdistrict'], default: 'member' },
        salary_user: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { username, email, name = null, department = null, position = null, role = 'member', salary_user = null } = req.body || {}
  try {
    const [dup] = await appPool.query('SELECT id FROM members WHERE username = ? OR email = ? LIMIT 1', [username, email])
    if (dup.length > 0) {
      reply.code(400); return { success: false, error: 'ชื่อผู้ใช้งานหรืออีเมลนี้มีอยู่ในระบบแล้ว' }
    }
    const [res] = await appPool.query(
      'INSERT INTO members (username, email, name, department, position, role, salary_user, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [username.trim(), email.trim(), name, department, position, role, salary_user]
    )
    return { success: true, insertId: res.insertId }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 3.4 Update Member
fastify.put('/api/v1/app/members/:id', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'แก้ไขข้อมูลสมาชิก (Edit Member)',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    body: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
        department: { type: 'string' },
        position: { type: 'string' },
        role: { type: 'string', enum: ['member', 'admin', 'subdistrict'] },
        salary_user: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const { username, email, name, department, position, role, salary_user } = req.body || {}
  try {
    const [existing] = await appPool.query('SELECT id FROM members WHERE id = ? LIMIT 1', [id])
    if (existing.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบสมาชิกที่ต้องการแก้ไข' }
    }
    if (username || email) {
      const [dup] = await appPool.query('SELECT id FROM members WHERE (username = ? OR email = ?) AND id != ? LIMIT 1', [username || '', email || '', id])
      if (dup.length > 0) {
        reply.code(400); return { success: false, error: 'ชื่อผู้ใช้งานหรืออีเมลนี้มีอยู่ในระบบแล้ว' }
      }
    }
    await appPool.query(
      `UPDATE members 
       SET username = COALESCE(?, username), email = COALESCE(?, email), name = COALESCE(?, name),
           department = COALESCE(?, department), position = COALESCE(?, position),
           role = COALESCE(?, role), salary_user = COALESCE(?, salary_user), updated_at = NOW()
       WHERE id = ?`,
      [username, email, name, department, position, role, salary_user, id]
    )
    return { success: true, message: 'แก้ไขข้อมูลสมาชิกสำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 3.5 Delete Member
fastify.delete('/api/v1/app/members/:id', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'ลบสมาชิกออกจากระบบ (Delete Member)',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [res] = await appPool.query('DELETE FROM members WHERE id = ?', [id])
    if (res.affectedRows === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบสมาชิกที่จะลบ' }
    }
    return { success: true, message: 'ลบสมาชิกเรียบร้อยแล้ว' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 3.6 Member Permissions
fastify.get('/api/v1/app/members/:id/permissions', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'ดึงรายการสิทธิ์เฉพาะบุคคลของสมาชิก',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [rows] = await appPool.query('SELECT permission_key, created_at, created_by FROM member_permissions WHERE member_id = ?', [id])
    return { success: true, memberId: id, permissions: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.post('/api/v1/app/members/:id/permissions', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'มอบสิทธิ์เฉพาะบุคคลให้แก่สมาชิก',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    body: {
      type: 'object',
      required: ['permissionKey'],
      properties: {
        permissionKey: { type: 'string' },
        createdBy: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const { permissionKey, createdBy = 'admin' } = req.body || {}
  try {
    await appPool.query(
      'INSERT INTO member_permissions (member_id, permission_key, created_by, created_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE created_by = ?',
      [id, permissionKey, createdBy, createdBy]
    )
    return { success: true, message: 'มอบสิทธิ์สำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.delete('/api/v1/app/members/:id/permissions/:key', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'เพิกถอนสิทธิ์เฉพาะบุคคลของสมาชิก',
    params: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        key: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { id, key } = req.params
  try {
    await appPool.query('DELETE FROM member_permissions WHERE member_id = ? AND permission_key = ?', [id, key])
    return { success: true, message: 'เพิกถอนสิทธิ์สำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// ==================================================================
// SECTION 4: Website Core Application (CMS, News, Slides, Assets, Tasks)
// ==================================================================

// 4.1 News List & Create
fastify.get('/api/v1/app/news', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายการข่าวสาร/ประชาสัมพันธ์ (รองรับ pagination, category, all, search)',
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'string', default: '1' },
        limit: { type: 'string', default: '10' },
        category: { type: 'string' },
        all: { type: 'string', default: 'false' },
        search: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { page = '1', limit = '10', category = '', all = 'false', search = '' } = req.query || {}
  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10))
    const offset = (pageNum - 1) * limitNum

    const whereClauses = []
    const params = []

    if (all !== 'true') {
      whereClauses.push('start_date <= NOW() AND end_date >= NOW()')
    }

    if (category) {
      whereClauses.push('category = ?')
      params.push(category)
    }

    if (search && search.trim()) {
      whereClauses.push('(title LIKE ? OR slug LIKE ?)')
      params.push(`%${search.trim()}%`, `%${search.trim()}%`)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const [countRows] = await appPool.query(`SELECT COUNT(*) AS total FROM news ${whereSql}`, params)
    const total = countRows[0]?.total ? Number(countRows[0].total) : 0

    const [rawNews] = await appPool.query(`
      SELECT id, title, slug, category, youtube_link AS youtubeLink,
             start_date AS startDate, end_date AS endDate, view_count AS viewCount,
             created_at AS createdAt, updated_at AS updatedAt
      FROM news
      ${whereSql}
      ORDER BY start_date DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset])

    const attachmentsByNewsId = new Map()
    if (rawNews.length > 0) {
      const newsIds = rawNews.map(n => n.id)
      const placeholders = newsIds.map(() => '?').join(',')
      const [attachments] = await appPool.query(`
        SELECT id, news_id AS newsId, file_path AS filePath, file_type AS fileType, original_name AS originalName
        FROM attachments
        WHERE news_id IN (${placeholders})
        ORDER BY id ASC
      `, newsIds)

      for (const att of attachments) {
        const list = attachmentsByNewsId.get(att.newsId) || []
        list.push(att)
        attachmentsByNewsId.set(att.newsId, list)
      }
    }

    const data = rawNews.map(item => ({
      ...item,
      attachments: attachmentsByNewsId.get(item.id) || []
    }))

    return {
      success: true,
      count: data.length,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      },
      data
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.post('/api/v1/app/news', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'สร้างข่าวสาร/กิจกรรมใหม่ (พร้อมแนบไฟล์รูป/PDF ใน 1 transaction)',
    body: {
      type: 'object',
      required: ['title', 'slug', 'category', 'startDate', 'endDate'],
      properties: {
        title: { type: 'string' },
        slug: { type: 'string' },
        category: { type: 'string' },
        youtubeLink: { type: 'string', nullable: true },
        startDate: { type: 'string', description: 'YYYY-MM-DD HH:mm:ss' },
        endDate: { type: 'string', description: 'YYYY-MM-DD HH:mm:ss' },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filePath: { type: 'string' },
              fileType: { type: 'string' },
              originalName: { type: 'string' }
            }
          }
        }
      }
    }
  }
}, async (req, reply) => {
  const { title, slug, category, youtubeLink = null, startDate, endDate, attachments = [] } = req.body || {}
  const conn = await appPool.getConnection()
  try {
    await conn.beginTransaction()
    const [res] = await conn.query(
      'INSERT INTO news (title, slug, category, youtube_link, start_date, end_date, view_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, NOW(), NOW())',
      [title, slug, category, youtubeLink, startDate, endDate]
    )
    const insertId = res.insertId

    const createdAttachments = []
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        const [attRes] = await conn.query(
          'INSERT INTO attachments (news_id, file_path, file_type, original_name, created_at) VALUES (?, ?, ?, ?, NOW())',
          [insertId, att.filePath, att.fileType || 'image/jpeg', att.originalName || 'file']
        )
        createdAttachments.push({
          id: attRes.insertId,
          newsId: insertId,
          filePath: att.filePath,
          fileType: att.fileType,
          originalName: att.originalName
        })
      }
    }

    await conn.commit()
    return {
      success: true,
      insertId,
      data: {
        id: insertId,
        title,
        slug,
        category,
        youtubeLink,
        startDate,
        endDate,
        viewCount: 0,
        attachments: createdAttachments
      }
    }
  } catch (err) {
    await conn.rollback()
    reply.code(500); return { success: false, error: err.message }
  } finally {
    conn.release()
  }
})

// 4.2 News Detail & Update & Delete & View Count
fastify.get('/api/v1/app/news/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายละเอียดข่าวสารตาม ID หรือ Slug (พร้อมไฟล์แนบ)',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const rawTarget = (req.query && req.query.slug) ? String(req.query.slug) : req.params.id
  try {
    const isNumeric = /^\d+$/.test(rawTarget)
    let sql = 'SELECT id, title, slug, category, youtube_link AS youtubeLink, start_date AS startDate, end_date AS endDate, view_count AS viewCount, created_at AS createdAt, updated_at AS updatedAt FROM news WHERE '
    let searchKey = rawTarget
    try {
      searchKey = decodeURIComponent(rawTarget)
    } catch {}
    const params = isNumeric ? [parseInt(rawTarget, 10)] : [searchKey]
    sql += isNumeric ? 'id = ? LIMIT 1' : 'slug = ? LIMIT 1'

    const [rows] = await appPool.query(sql, params)
    if (rows.length === 0) { reply.code(404); return { success: false, error: 'ไม่พบข่าวที่ต้องการ' } }
    const news = rows[0]

    const [attachments] = await appPool.query(
      'SELECT id, news_id AS newsId, file_path AS filePath, file_type AS fileType, original_name AS originalName FROM attachments WHERE news_id = ? ORDER BY id ASC',
      [news.id]
    )
    return { success: true, data: { ...news, attachments } }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.post('/api/v1/app/news/:id/view', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'เพิ่มจำนวนผู้เข้าชมข่าวสาร (View Count Increment)',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const rawTarget = (req.query && req.query.slug) ? String(req.query.slug) : req.params.id
  try {
    const isNumeric = /^\d+$/.test(rawTarget)
    const sql = isNumeric
      ? 'UPDATE news SET view_count = view_count + 1 WHERE id = ?'
      : 'UPDATE news SET view_count = view_count + 1 WHERE slug = ?'
    let searchKey = rawTarget
    try {
      searchKey = decodeURIComponent(rawTarget)
    } catch {}
    const param = isNumeric ? parseInt(rawTarget, 10) : searchKey
    await appPool.query(sql, [param])
    return { success: true, message: 'เพิ่มยอดเข้าชมสำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.put('/api/v1/app/news/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'แก้ไขข้อมูลข่าวสาร (พร้อมอัปเดตไฟล์แนบ)',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    body: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        category: { type: 'string' },
        youtubeLink: { type: 'string', nullable: true },
        startDate: { type: 'string' },
        endDate: { type: 'string' },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filePath: { type: 'string' },
              fileType: { type: 'string' },
              originalName: { type: 'string' }
            }
          }
        }
      }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const { title, category, youtubeLink, startDate, endDate, attachments } = req.body || {}
  const conn = await appPool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query(
      `UPDATE news SET 
         title = COALESCE(?, title),
         category = COALESCE(?, category),
         youtube_link = COALESCE(?, youtube_link),
         start_date = COALESCE(?, start_date),
         end_date = COALESCE(?, end_date),
         updated_at = NOW()
       WHERE id = ?`,
      [title !== undefined ? title : null, category !== undefined ? category : null, youtubeLink !== undefined ? youtubeLink : null, startDate || null, endDate || null, id]
    )

    if (Array.isArray(attachments)) {
      await conn.query('DELETE FROM attachments WHERE news_id = ?', [id])
      for (const att of attachments) {
        await conn.query(
          'INSERT INTO attachments (news_id, file_path, file_type, original_name, created_at) VALUES (?, ?, ?, ?, NOW())',
          [id, att.filePath, att.fileType || 'image/jpeg', att.originalName || 'file']
        )
      }
    }

    await conn.commit()

    const [updatedRows] = await appPool.query(
      'SELECT id, title, slug, category, youtube_link AS youtubeLink, start_date AS startDate, end_date AS endDate, view_count AS viewCount, created_at AS createdAt, updated_at AS updatedAt FROM news WHERE id = ? LIMIT 1',
      [id]
    )
    const [updatedAttachments] = await appPool.query(
      'SELECT id, news_id AS newsId, file_path AS filePath, file_type AS fileType, original_name AS originalName FROM attachments WHERE news_id = ? ORDER BY id ASC',
      [id]
    )

    return {
      success: true,
      message: 'แก้ไขข่าวสารสำเร็จ',
      data: {
        ...(updatedRows[0] || {}),
        attachments: updatedAttachments
      }
    }
  } catch (err) {
    await conn.rollback()
    reply.code(500); return { success: false, error: err.message }
  } finally {
    conn.release()
  }
})

fastify.delete('/api/v1/app/news/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ลบข่าวสารและไฟล์แนบ',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [existingRows] = await appPool.query('SELECT id FROM news WHERE id = ? LIMIT 1', [id])
    if (existingRows.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบข่าวที่ต้องการลบ' }
    }
    await appPool.query('DELETE FROM attachments WHERE news_id = ?', [id])
    await appPool.query('DELETE FROM news WHERE id = ?', [id])
    return { success: true, message: 'ลบข่าวสารสำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.3 Hero Slides
fastify.get('/api/v1/app/slides', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงแบนเนอร์สไลด์หน้าแรก (รองรับ all=true และคืนค่า slideDuration)',
    querystring: {
      type: 'object',
      properties: {
        all: { type: 'string', default: 'false' }
      }
    }
  }
}, async (req, reply) => {
  const { all = 'false' } = req.query || {}
  try {
    let slides = []
    if (all === 'true') {
      const [rows] = await appPool.query(`
        SELECT id, image_path AS imagePath, title, link_url AS linkUrl,
               start_date AS startDate, end_date AS endDate,
               display_order AS displayOrder, duration,
               created_at AS createdAt, updated_at AS updatedAt
        FROM hero_slides
        ORDER BY display_order ASC, created_at DESC
      `)
      slides = rows

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
            await appPool.query('UPDATE hero_slides SET display_order = ? WHERE id = ?', [i + 1, slides[i].id])
            slides[i].displayOrder = i + 1
          }
        }
      }
    } else {
      const [rows] = await appPool.query(`
        SELECT id, image_path AS imagePath, title, link_url AS linkUrl,
               start_date AS startDate, end_date AS endDate,
               display_order AS displayOrder, duration,
               created_at AS createdAt, updated_at AS updatedAt
        FROM hero_slides
        WHERE start_date <= NOW() AND end_date >= NOW()
        ORDER BY display_order ASC, created_at DESC
      `)
      slides = rows
    }

    let slideDuration = 6
    try {
      const [durationRows] = await appPool.query(
        "SELECT config_value AS configValue FROM member_system_settings WHERE config_key = 'hero_slide_duration_seconds' LIMIT 1"
      )
      if (durationRows.length > 0 && durationRows[0]?.configValue) {
        const parsedSec = parseInt(durationRows[0].configValue, 10)
        if (!isNaN(parsedSec) && parsedSec >= 2 && parsedSec <= 30) {
          slideDuration = parsedSec
        }
      }
    } catch {}

    return {
      success: true,
      count: slides.length,
      slides,
      data: slides,
      slideDuration
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.post('/api/v1/app/slides', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'เพิ่มภาพสไลด์แบนเนอร์ใหม่',
    body: {
      type: 'object',
      required: ['imagePath', 'startDate', 'endDate'],
      properties: {
        title: { type: 'string' },
        imagePath: { type: 'string' },
        linkUrl: { type: 'string' },
        displayOrder: { type: 'integer', default: 0 },
        duration: { type: 'integer', default: 6 },
        startDate: { type: 'string' },
        endDate: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { title = '', imagePath, linkUrl = '', displayOrder = 0, duration = 6, startDate, endDate } = req.body || {}
  try {
    let finalOrder = displayOrder
    if (!finalOrder || finalOrder <= 0) {
      const [maxSlideRows] = await appPool.query('SELECT MAX(display_order) AS maxOrder FROM hero_slides')
      const maxOrder = maxSlideRows[0]?.maxOrder ?? 0
      finalOrder = maxOrder + 1
    }

    const [res] = await appPool.query(
      'INSERT INTO hero_slides (image_path, title, link_url, start_date, end_date, display_order, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [imagePath, title || null, linkUrl || null, startDate, endDate, finalOrder, duration || 6]
    )

    const slide = {
      id: res.insertId,
      imagePath,
      title: title || null,
      linkUrl: linkUrl || null,
      startDate,
      endDate,
      displayOrder: finalOrder,
      duration: duration || 6
    }

    return { success: true, insertId: res.insertId, slide }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.put('/api/v1/app/slides/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'แก้ไขภาพสไลด์แบนเนอร์',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    body: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        imagePath: { type: 'string' },
        linkUrl: { type: 'string' },
        displayOrder: { type: 'integer' },
        duration: { type: 'integer' },
        startDate: { type: 'string' },
        endDate: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const { title, imagePath, linkUrl, displayOrder = 0, duration = 6, startDate, endDate } = req.body || {}
  try {
    const [existingRows] = await appPool.query('SELECT id, image_path AS imagePath FROM hero_slides WHERE id = ? LIMIT 1', [id])
    if (existingRows.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบสไลด์ภาพที่ต้องการแก้ไข' }
    }

    await appPool.query(`
      UPDATE hero_slides
      SET image_path = ?, title = ?, link_url = ?, start_date = ?, end_date = ?, display_order = ?, duration = ?, updated_at = NOW()
      WHERE id = ?
    `, [imagePath, title || null, linkUrl || null, startDate, endDate, displayOrder, duration, id])

    const slide = {
      id: parseInt(id, 10),
      imagePath,
      title: title || null,
      linkUrl: linkUrl || null,
      startDate,
      endDate,
      displayOrder,
      duration
    }

    return { success: true, slide, previousImagePath: existingRows[0].imagePath }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.delete('/api/v1/app/slides/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ลบภาพสไลด์แบนเนอร์และปรับลำดับสไลด์ที่เหลือ',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [slideRows] = await appPool.query('SELECT id, title, image_path AS imagePath FROM hero_slides WHERE id = ? LIMIT 1', [id])
    if (slideRows.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบสไลด์ภาพที่ต้องการลบ' }
    }
    const slide = slideRows[0]

    await appPool.query('DELETE FROM hero_slides WHERE id = ?', [id])

    // Re-index remaining slides to 1..N sequentially
    const [remainingSlides] = await appPool.query(`
      SELECT id, display_order AS displayOrder
      FROM hero_slides
      ORDER BY display_order ASC, created_at DESC
    `)

    for (let i = 0; i < remainingSlides.length; i++) {
      if (remainingSlides[i].displayOrder !== i + 1) {
        await appPool.query('UPDATE hero_slides SET display_order = ? WHERE id = ?', [i + 1, remainingSlides[i].id])
      }
    }

    return { success: true, message: 'ลบสไลด์ภาพเรียบร้อยแล้ว', slide }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.patch('/api/v1/app/slides/duration', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ตั้งค่าความเร็วการเปลี่ยนสไลด์ (วินาที)',
    body: {
      type: 'object',
      required: ['slideDuration'],
      properties: {
        slideDuration: { type: 'integer', minimum: 2, maximum: 30 }
      }
    }
  }
}, async (req, reply) => {
  const { slideDuration } = req.body || {}
  const durationNum = typeof slideDuration === 'number' ? slideDuration : parseInt(String(slideDuration), 10)
  if (isNaN(durationNum) || durationNum < 2 || durationNum > 30) {
    reply.code(400); return { success: false, error: 'ความเร็วการเปลี่ยนสไลด์ต้องอยู่ระหว่าง 2 ถึง 30 วินาที' }
  }

  try {
    await appPool.query(`
      INSERT INTO member_system_settings (config_key, config_value, updated_at)
      VALUES ('hero_slide_duration_seconds', ?, NOW())
      ON DUPLICATE KEY UPDATE config_value = ?, updated_at = NOW()
    `, [String(durationNum), String(durationNum)])

    return { success: true, slideDuration: durationNum }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.4 Hospital Assets
fastify.get('/api/v1/app/assets', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ค้นหาทะเบียนครุภัณฑ์โรงพยาบาล',
    querystring: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        category: { type: 'string' },
        limit: { type: 'string', default: '50' }
      }
    }
  }
}, async (req, reply) => {
  const { search = '', category = '', limit = '50' } = req.query || {}
  try {
    let sql = 'SELECT id, article_num, fsn_num, name, category, brand, model, location_full_name, status, is_loanable FROM hospital_assets WHERE 1=1'
    const params = []
    if (search) { sql += ' AND (article_num LIKE ? OR name LIKE ?)'; params.push(`%${search}%`, `%${search}%`) }
    if (category) { sql += ' AND category = ?'; params.push(category) }
    sql += ' ORDER BY id DESC LIMIT ?'; params.push(parseInt(limit, 10))
    const [rows] = await appPool.query(sql, params)
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.6 Hospital Locations
fastify.get('/api/v1/app/locations', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายการสถานที่/ห้อง/อาคารของโรงพยาบาล (รองรับทั้งแบบย่อและแบบละเอียด)',
    querystring: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        buildingId: { type: 'string' },
        status: { type: 'string', enum: ['active', 'inactive', 'all'], default: 'active' },
        page: { type: 'string', default: '1' },
        limit: { type: 'string', default: '500' },
        detailed: { type: 'string', default: 'false' }
      }
    }
  }
}, async (req, reply) => {
  const { search = '', buildingId = '', status = 'active', page = '1', limit = '500', detailed = 'false' } = req.query || {}
  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit, 10) || 500))
    const offset = (pageNum - 1) * limitNum

    const whereClauses = []
    const queryParams = []

    if (status === 'active') {
      whereClauses.push('is_active = 1')
    } else if (status === 'inactive') {
      whereClauses.push('is_active = 0')
    }

    if (buildingId) {
      whereClauses.push('building_id = ?')
      queryParams.push(buildingId)
    }

    if (search && search.trim()) {
      whereClauses.push('(room_name LIKE ? OR building_name LIKE ? OR floor_name LIKE ? OR full_name LIKE ?)')
      queryParams.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    if (detailed === 'true') {
      const [countRows] = await appPool.query(
        `SELECT COUNT(*) as total FROM hospital_locations ${whereSql}`,
        queryParams
      )
      const total = countRows[0]?.total || 0

      const [items] = await appPool.query(
        `SELECT id, room_name, floor_id, floor_name, building_id, building_name, full_name, is_active, updated_at 
         FROM hospital_locations 
         ${whereSql} 
         ORDER BY building_name ASC, floor_id ASC, room_name ASC 
         LIMIT ? OFFSET ?`,
        [...queryParams, limitNum, offset]
      )

      const [buildings] = await appPool.query(
        `SELECT DISTINCT building_id, building_name 
         FROM hospital_locations 
         ORDER BY building_name ASC`
      )

      const [buildingFloors] = await appPool.query(
        `SELECT DISTINCT building_id, building_name, floor_id, floor_name 
         FROM hospital_locations 
         ORDER BY building_name ASC, floor_name ASC`
      )

      const [statsRows] = await appPool.query(`
        SELECT 
          COUNT(*) as totalCount,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as activeCount,
          COUNT(DISTINCT building_id) as buildingCount
        FROM hospital_locations
      `)
      const stats = statsRows[0] || { totalCount: 0, activeCount: 0, buildingCount: 0 }

      return {
        success: true,
        data: {
          items,
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum) || 1,
          buildings,
          buildingFloors,
          stats: {
            totalCount: Number(stats.totalCount) || 0,
            activeCount: Number(stats.activeCount) || 0,
            buildingCount: Number(stats.buildingCount) || 0,
          }
        }
      }
    } else {
      const [locations] = await appPool.query(
        `SELECT id, room_name, floor_id, floor_name, building_id, building_name, full_name 
         FROM hospital_locations 
         ${whereSql} 
         ORDER BY building_name ASC, floor_id ASC, room_name ASC 
         LIMIT ?`,
        [...queryParams, limitNum]
      )

      return {
        success: true,
        data: locations
      }
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.post('/api/v1/app/locations', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'สร้างสถานที่/ห้องใหม่',
    body: {
      type: 'object',
      required: ['room_name', 'building_name', 'floor_name'],
      properties: {
        room_name: { type: 'string' },
        floor_id: { type: 'integer' },
        floor_name: { type: 'string' },
        building_id: { type: 'integer' },
        building_name: { type: 'string' },
        is_active: { type: 'boolean', default: true }
      }
    }
  }
}, async (req, reply) => {
  const { room_name, floor_id, floor_name, building_id, building_name, is_active } = req.body || {}
  try {
    if (!room_name?.trim()) {
      reply.code(400); return { success: false, error: 'กรุณาระบุชื่อห้อง / หน่วยงาน' }
    }
    if (!building_name?.trim()) {
      reply.code(400); return { success: false, error: 'กรุณาระบุชื่ออาคาร / ตึก' }
    }
    if (!floor_name?.trim()) {
      reply.code(400); return { success: false, error: 'กรุณาระบุชั้น' }
    }

    const [maxRows] = await appPool.query('SELECT COALESCE(MAX(id), 0) as maxId FROM hospital_locations')
    const newId = Number(maxRows[0]?.maxId || 0) + 1

    let finalBuildingId = building_id ? Number(building_id) : 0
    let finalFloorId = floor_id ? Number(floor_id) : 0

    if (!finalBuildingId) {
      const [maxBRows] = await appPool.query('SELECT COALESCE(MAX(building_id), 0) as maxB FROM hospital_locations')
      finalBuildingId = Number(maxBRows[0]?.maxB || 0) + 1
    }
    if (!finalFloorId) {
      const [maxFRows] = await appPool.query('SELECT COALESCE(MAX(floor_id), 0) as maxF FROM hospital_locations')
      finalFloorId = Number(maxFRows[0]?.maxF || 0) + 1
    }

    const trimmedRoom = room_name.trim()
    const trimmedFloor = floor_name.trim()
    const trimmedBuilding = building_name.trim()
    const fullName = `${trimmedBuilding} ${trimmedFloor} (${trimmedRoom})`
    const activeVal = is_active === false || is_active === 0 ? 0 : 1

    await appPool.query(
      `INSERT INTO hospital_locations (id, room_name, floor_id, floor_name, building_id, building_name, full_name, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [newId, trimmedRoom, finalFloorId, trimmedFloor, finalBuildingId, trimmedBuilding, fullName, activeVal]
    )

    return {
      success: true,
      message: 'เพิ่มข้อมูลสถานที่สำเร็จ',
      data: {
        id: newId,
        room_name: trimmedRoom,
        floor_id: finalFloorId,
        floor_name: trimmedFloor,
        building_id: finalBuildingId,
        building_name: trimmedBuilding,
        full_name: fullName,
        is_active: activeVal,
      }
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.put('/api/v1/app/locations/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'แก้ไขข้อมูลสถานที่หรือเปลี่ยนสถานะใช้งาน',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    body: {
      type: 'object',
      properties: {
        is_active: { type: 'boolean' },
        room_name: { type: 'string' },
        floor_id: { type: 'integer' },
        floor_name: { type: 'string' },
        building_id: { type: 'integer' },
        building_name: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const { is_active, room_name, floor_id, floor_name, building_id, building_name } = req.body || {}
  try {
    const [existing] = await appPool.query('SELECT * FROM hospital_locations WHERE id = ?', [id])
    if (existing.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบข้อมูลสถานที่ที่ต้องการแก้ไข' }
    }
    const current = existing[0]

    // Fast toggle active status
    if (is_active !== undefined && room_name === undefined && building_name === undefined) {
      await appPool.query(
        'UPDATE hospital_locations SET is_active = ?, updated_at = NOW() WHERE id = ?',
        [is_active ? 1 : 0, id]
      )
      return { success: true, message: 'อัปเดตสถานะสำเร็จ' }
    }

    const targetRoom = room_name !== undefined ? room_name.trim() : current.room_name
    const targetBuildingName = building_name !== undefined ? building_name.trim() : current.building_name
    const targetFloorName = floor_name !== undefined ? floor_name.trim() : current.floor_name
    const targetBuildingId = building_id !== undefined ? Number(building_id) : current.building_id
    const targetFloorId = floor_id !== undefined ? Number(floor_id) : current.floor_id
    const targetIsActive = is_active !== undefined ? (is_active ? 1 : 0) : current.is_active
    const targetFullName = `${targetBuildingName} ${targetFloorName} (${targetRoom})`

    await appPool.query(
      `UPDATE hospital_locations 
       SET room_name = ?, 
           floor_id = ?, 
           floor_name = ?, 
           building_id = ?, 
           building_name = ?, 
           full_name = ?, 
           is_active = ?, 
           updated_at = NOW() 
       WHERE id = ?`,
      [
        targetRoom,
        targetFloorId,
        targetFloorName,
        targetBuildingId,
        targetBuildingName,
        targetFullName,
        targetIsActive,
        id,
      ]
    )

    return {
      success: true,
      message: 'แก้ไขข้อมูลสถานที่สำเร็จ',
      data: {
        id: Number(id),
        room_name: targetRoom,
        floor_id: targetFloorId,
        floor_name: targetFloorName,
        building_id: targetBuildingId,
        building_name: targetBuildingName,
        full_name: targetFullName,
        is_active: targetIsActive,
      }
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.delete('/api/v1/app/locations/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ลบข้อมูลสถานที่',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [check] = await appPool.query('SELECT id, full_name FROM hospital_locations WHERE id = ?', [id])
    if (check.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบข้อมูลสถานที่ที่ต้องการลบ' }
    }

    await appPool.query('DELETE FROM hospital_locations WHERE id = ?', [id])
    return {
      success: true,
      message: `ลบข้อมูลสถานที่ "${check[0].full_name}" สำเร็จเรียบร้อย`,
      location: check[0]
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.5 Hospital Events
fastify.get('/api/v1/app/events', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายการปฏิทินกิจกรรมโรงพยาบาล'
  }
}, async (req, reply) => {
  try {
    const [rows] = await appPool.query(
      'SELECT id, title, location, banner_url, event_start_date, event_end_date, status, fiscal_year FROM hospital_events ORDER BY event_start_date DESC LIMIT 30'
    )
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})


// 4.5.1 Event Attachments (Media, Documents, Notes)
fastify.get('/api/v1/app/events/:id/attachments', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายการเอกสาร รูปภาพ และบันทึกข้อความของกิจกรรม (Event Attachments)',
    params: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Event ID' }
      },
      required: ['id']
    }
  }
}, async (req, reply) => {
  try {
    const eventId = Number(req.params.id)
    const [rows] = await appPool.query(
      `SELECT a.id, a.event_id, a.attachment_type, a.title, a.file_path, a.file_type,
              a.file_size, a.text_content, a.uploaded_by_member_id, a.display_order,
              a.created_at, a.updated_at,
              m.name AS uploader_name, m.department AS uploader_dept
       FROM event_attachments a
       LEFT JOIN members m ON a.uploaded_by_member_id = m.id
       WHERE a.event_id = ?
       ORDER BY a.display_order ASC, a.created_at DESC`,
      [eventId]
    )
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.post('/api/v1/app/events/:id/attachments', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'แนบเอกสาร รูปภาพ หรือข้อความสรุปสำหรับกิจกรรม (Add Event Attachment)',
    params: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Event ID' }
      },
      required: ['id']
    },
    body: {
      type: 'object',
      required: ['attachment_type', 'title'],
      properties: {
        attachment_type: { type: 'string', enum: ['IMAGE', 'DOCUMENT', 'NOTE'], description: 'ประเภทสิ่งที่แนบ' },
        title: { type: 'string', description: 'ชื่อไฟล์/หัวข้อบันทึก' },
        file_path: { type: 'string', nullable: true, description: 'Path ไฟล์บน Server' },
        file_type: { type: 'string', nullable: true, description: 'MIME type' },
        file_size: { type: 'integer', nullable: true, description: 'ขนาดไฟล์ bytes' },
        text_content: { type: 'string', nullable: true, description: 'เนื้อหาข้อความกรณีเป็น NOTE' },
        uploaded_by_member_id: { type: 'integer', nullable: true, description: 'Member ID ผู้แนบ' },
        display_order: { type: 'integer', default: 0 }
      }
    }
  }
}, async (req, reply) => {
  try {
    const eventId = Number(req.params.id)
    const { attachment_type, title, file_path, file_type, file_size, text_content, uploaded_by_member_id, display_order } = req.body
    const [res] = await appPool.query(
      `INSERT INTO event_attachments (
        event_id, attachment_type, title, file_path, file_type, file_size, text_content, uploaded_by_member_id, display_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [eventId, attachment_type, title, file_path || null, file_type || null, file_size || null, text_content || null, uploaded_by_member_id || null, display_order || 0]
    )
    return { success: true, insertId: res.insertId, message: 'แนบเอกสาร/รูปภาพสำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.delete('/api/v1/app/events/:id/attachments/:attachmentId', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ลบเอกสารหรือรูปภาพของกิจกรรม (Delete Event Attachment)',
    params: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'Event ID' },
        attachmentId: { type: 'integer', description: 'Attachment ID' }
      },
      required: ['id', 'attachmentId']
    }
  }
}, async (req, reply) => {
  try {
    const eventId = Number(req.params.id)
    const attachmentId = Number(req.params.attachmentId)
    const [res] = await appPool.query(
      'DELETE FROM event_attachments WHERE id = ? AND event_id = ?',
      [attachmentId, eventId]
    )
    return { success: true, affectedRows: res.affectedRows, message: 'ลบไฟล์แนบสำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})


// 4.6 Inbox Tasks (Workflows & Repairs)
fastify.get('/api/v1/app/tasks', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายการงานสารบรรณ/งานซ่อม/คำขอยืมอุปกรณ์ (Task Inbox)',
    querystring: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        status: { type: 'string' },
        limit: { type: 'string', default: '30' }
      }
    }
  }
}, async (req, reply) => {
  const { type = '', status = '', limit = '30' } = req.query || {}
  try {
    let sql = 'SELECT id, task_no, task_type, title, urgency, status, requester_name, requester_dept, current_step_no, created_at FROM inbox_tasks WHERE 1=1'
    const params = []
    if (type) { sql += ' AND task_type = ?'; params.push(type) }
    if (status) { sql += ' AND status = ?'; params.push(status) }
    sql += ' ORDER BY created_at DESC LIMIT ?'; params.push(parseInt(limit, 10))
    const [rows] = await appPool.query(sql, params)
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.7 Contact Messages
fastify.get('/api/v1/app/contact-messages', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงข้อความติดต่อจากประชาชนหน้าเว็บไซต์'
  }
}, async (req, reply) => {
  try {
    const [rows] = await appPool.query('SELECT id, name, email, phone, message, is_read, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 50')
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.post('/api/v1/app/contact-messages', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ส่งข้อความติดต่อสอบถามจากประชาชน',
    body: {
      type: 'object',
      required: ['name', 'email', 'message'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        message: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { name, email, phone = '', message } = req.body || {}
  try {
    const [res] = await appPool.query('INSERT INTO contact_messages (name, email, phone, message, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())', [name, email, phone, message])
    return { success: true, messageId: res.insertId }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.8 Member Registration Requests
fastify.get('/api/v1/app/registrations', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงคำขอสมัครสมาชิกใหม่ของบุคลากร (รอการตรวจสอบ)'
  }
}, async (req, reply) => {
  try {
    const [rows] = await appPool.query('SELECT * FROM member_registrations ORDER BY created_at DESC LIMIT 50')
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.12 KPI Batch Import (Atomic Transaction)
fastify.post('/api/v1/app/kpi/import-batch', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'นำเข้าข้อมูลตัวชี้วัด KPI แบบกลุ่ม (Batch Insert with Transaction)',
    body: {
      type: 'object',
      required: ['topicId', 'rows'],
      properties: {
        topicId: { type: 'integer' },
        rows: {
          type: 'array',
          items: {
            type: 'object',
            required: ['title'],
            properties: {
              sequence: { type: ['string', 'number', 'null'] },
              category: { type: 'string' },
              subcategory: { type: ['string', 'null'] },
              code: { type: ['string', 'null'] },
              oldCode: { type: ['string', 'null'] },
              frequency: { type: 'string' },
              title: { type: 'string' },
              numeratorName: { type: ['string', 'null'] },
              denominatorName: { type: ['string', 'null'] },
              targetRaw: { type: ['string', 'null'] },
              targetOperator: { type: ['string', 'null'] },
              targetValue: { type: ['number', 'null'] },
              targetUnit: { type: ['string', 'null'] },
              responsibleName: { type: ['string', 'null'] },
              indicatorType: { type: 'string' },
              displayOrder: { type: 'integer' }
            }
          }
        }
      }
    }
  }
}, async (req, reply) => {
  const { topicId, rows } = req.body || {}
  if (!topicId || !Array.isArray(rows) || rows.length === 0) {
    reply.code(400); return { success: false, error: 'topicId and non-empty rows array required' }
  }

  const conn = await appPool.getConnection()
  try {
    await conn.beginTransaction()
    const sql = `
      INSERT INTO kpi_indicators (
        topic_id, sequence, category, subcategory, code, old_code,
        frequency, title, numerator_name, denominator_name,
        target_raw, target_operator, target_value, target_unit,
        responsible_name, indicator_type, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    let insertedCount = 0
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      await conn.query(sql, [
        topicId,
        r.sequence ?? null,
        r.category || 'ทั่วไป',
        r.subcategory ?? null,
        r.code ?? null,
        r.oldCode ?? null,
        r.frequency || 'ราย 6 เดือน',
        r.title,
        r.numeratorName ?? null,
        r.denominatorName ?? null,
        r.targetRaw ?? null,
        r.targetOperator ?? null,
        r.targetValue ?? null,
        r.targetUnit ?? null,
        r.responsibleName ?? null,
        r.indicatorType || 'HA',
        r.displayOrder ?? (i + 1)
      ])
      insertedCount++
    }
    await conn.commit()
    return { success: true, insertedCount }
  } catch (err) {
    await conn.rollback().catch(() => {})
    reply.code(500); return { success: false, error: err.message }
  } finally {
    conn.release()
  }
})

// 4.10 Member Auth Context (Hydrates profile, permissions, system settings, and telegram link)
fastify.post('/api/v1/app/members/auth-context', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'ดึงข้อมูล Context ของสมาชิกเพื่อทำ Authentication (รวมสิทธิ์, ตั้งค่าระบบ, Telegram)',
    body: {
      type: 'object',
      required: ['username', 'email'],
      properties: {
        username: { type: 'string' },
        email: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { username, email } = req.body || {}
  try {
    const [users] = await appPool.query(
      'SELECT id, username, email, name, department, position, salary_user, role, signature_path, profile_path FROM members WHERE username = ? AND email = ? LIMIT 1',
      [username, email]
    )
    if (users.length === 0) {
      return { success: false, data: null, message: 'Member not found' }
    }
    const user = users[0]
    const userPosition = (user.position || '').trim()

    const [permsRes] = await appPool.query(
      'SELECT permission_key FROM member_permissions WHERE member_id = ?',
      [user.id]
    )

    let posPermsRes = []
    if (userPosition) {
      const [pRows] = await appPool.query(
        'SELECT permission_key FROM position_permissions WHERE TRIM(position_name) = TRIM(?)',
        [userPosition]
      )
      posPermsRes = pRows
    }

    const [settingsRows] = await appPool.query('SELECT config_key, config_value FROM member_system_settings')
    const [telegramRows] = await appPool.query('SELECT id FROM member_telegram_links WHERE member_id = ? LIMIT 1', [user.id])

    const permissions = new Set()
    permsRes.forEach(r => { if (r.permission_key) permissions.add(r.permission_key) })
    posPermsRes.forEach(r => { if (r.permission_key) permissions.add(r.permission_key) })

    const settings = {}
    settingsRows.forEach(r => { if (r.config_key) settings[r.config_key] = r.config_value })

    return {
      success: true,
      data: {
        member: user,
        permissions: Array.from(permissions),
        settings,
        isTelegramLinked: telegramRows.length > 0
      }
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.11 Check Position / Member Permission
fastify.post('/api/v1/app/members/check-position-permission', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'ตรวจสอบสิทธิ์ของตำแหน่งงานหรือสิทธิ์เฉพาะบุคคล (Position & Direct Member Permission)',
    body: {
      type: 'object',
      required: ['username', 'permissionKeys'],
      properties: {
        username: { type: 'string' },
        permissionKeys: { type: 'array', items: { type: 'string' } }
      }
    }
  }
}, async (req, reply) => {
  const { username, permissionKeys } = req.body || {}
  try {
    const [users] = await appPool.query('SELECT id, position, role FROM members WHERE username = ? LIMIT 1', [username])
    if (users.length === 0) return { success: true, allowed: false }
    const user = users[0]
    if (user.role === 'admin') return { success: true, allowed: true }

    if (!permissionKeys || permissionKeys.length === 0) return { success: true, allowed: false }

    const placeholders = permissionKeys.map(() => '?').join(', ')

    // 1. Check direct member permissions (when assigned by name in /member/settings)
    const [memRows] = await appPool.query(
      `SELECT COUNT(*) as count FROM member_permissions WHERE permission_key IN (${placeholders}) AND member_id = ?`,
      [...permissionKeys, user.id]
    )
    if ((memRows[0]?.count || 0) > 0) {
      return { success: true, allowed: true }
    }

    // 2. Check position permissions (when assigned by position in /member/settings)
    const userPosition = (user.position || '').trim()
    if (userPosition) {
      const [rows] = await appPool.query(
        `SELECT COUNT(*) as count FROM position_permissions WHERE permission_key IN (${placeholders}) AND TRIM(position_name) = TRIM(?)`,
        [...permissionKeys, userPosition]
      )
      if ((rows[0]?.count || 0) > 0) {
        return { success: true, allowed: true }
      }
    }

    return { success: true, allowed: false }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.12 Published News with Attachments
fastify.get('/api/v1/app/news/published', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายการข่าวสารที่มีผลเผยแพร่ในปัจจุบัน พร้อมไฟล์แนบ (หน้าแรก)',
    querystring: {
      type: 'object',
      properties: {
        limit: { type: 'integer', default: 20 }
      }
    }
  }
}, async (req, reply) => {
  const limit = parseInt(req.query?.limit || 20, 10)
  try {
    const cacheKey = `app-news-published-${limit}`
    const data = await getCached(cacheKey, 30000, async () => {
      const [rawNews] = await appPool.query(`
        SELECT id, title, slug, category, youtube_link AS youtubeLink, start_date AS startDate, end_date AS endDate, view_count AS viewCount, created_at AS createdAt, updated_at AS updatedAt
        FROM news
        WHERE start_date <= NOW() AND end_date >= NOW()
        ORDER BY start_date DESC
        LIMIT ?
      `, [limit])

      if (rawNews.length === 0) return []

      const newsIds = rawNews.map(n => n.id)
      const placeholders = newsIds.map(() => '?').join(',')
      const [attachments] = await appPool.query(`
        SELECT id, news_id AS newsId, file_path AS filePath, file_type AS fileType, original_name AS originalName
        FROM attachments
        WHERE news_id IN (${placeholders})
        ORDER BY id ASC
      `, newsIds)

      const attachmentsByNewsId = new Map()
      for (const att of attachments) {
        const list = attachmentsByNewsId.get(att.newsId) || []
        list.push(att)
        attachmentsByNewsId.set(att.newsId, list)
      }

      return rawNews.map(item => {
        const atts = attachmentsByNewsId.get(item.id) || []
        const imageAttachments = atts.filter(att => att.fileType && att.fileType.startsWith('image/'))
        const images = imageAttachments.map(att => ({ id: att.id, imageUrl: att.filePath, order: 0 }))
        const pdfAttachment = atts.find(att => att.fileType === 'application/pdf')
        return {
          ...item,
          images,
          thumbnailUrl: images[0]?.imageUrl || null,
          pdfUrl: pdfAttachment?.filePath || null
        }
      })
    })
    return { success: true, count: data.length, data }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.13 Sitemap News
fastify.get('/api/v1/app/news/sitemap', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายการข่าวสารสำหรับ Sitemap'
  }
}, async (req, reply) => {
  try {
    const data = await getCached('app-news-sitemap', 300000, async () => {
      const [rows] = await appPool.query(`
        SELECT id, slug, updated_at AS updatedAt
        FROM news
        WHERE start_date <= NOW() AND end_date >= NOW()
        ORDER BY start_date DESC
        LIMIT 500
      `)
      return rows
    })
    return { success: true, count: data.length, data }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.14 Active Hero Slides
fastify.get('/api/v1/app/slides/active', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายการแบนเนอร์สไลด์ที่กำลังแสดงผล (มีผลตามวันที่)'
  }
}, async (req, reply) => {
  try {
    const data = await getCached('app-slides-active', 60000, async () => {
      const [rows] = await appPool.query(`
        SELECT id, title, image_path AS imagePath, link_url AS linkUrl, start_date AS startDate, end_date AS endDate, display_order AS displayOrder, duration, created_at AS createdAt, updated_at AS updatedAt
        FROM hero_slides
        WHERE start_date <= NOW() AND end_date >= NOW()
        ORDER BY display_order ASC, created_at DESC
      `)
      return rows
    })
    return { success: true, count: data.length, data }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.15 LTC (Long-Term Care) Registries Management
// 4.15.1 Get all LTC HNs
fastify.get('/api/v1/app/ltc/hns', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายชื่อ HN ทั้งหมดในทะเบียน LTC เพื่อใช้ตรวจสอบความซ้ำซ้อน'
  }
}, async (req, reply) => {
  try {
    const [rows] = await appPool.query('SELECT hn FROM long_term_care_registries WHERE hn IS NOT NULL')
    const hns = rows.map(r => r.hn).filter(Boolean)
    return { success: true, count: hns.length, data: hns }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.15.2 Get LTC Registries list with filtering and stats
fastify.get('/api/v1/app/ltc/registries', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายชื่อทะเบียน Long-Term Care (LTC) พร้อมการค้นหาและสถิติ',
    querystring: {
      type: 'object',
      properties: {
        search: { type: 'string' },
        areaZone: { type: 'string' },
        page: { type: 'integer', default: 1 },
        limit: { type: 'integer', default: 50 },
        exportAll: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { search = '', areaZone = '', page = 1, limit = 50, exportAll = 'false' } = req.query || {}
  try {
    const [rows] = await appPool.query(`
      SELECT
        id,
        hn,
        cid,
        patient_name AS patientName,
        address,
        moo,
        tambon,
        age,
        adl_score AS adlScore,
        area_zone AS areaZone,
        created_by AS createdBy,
        updated_by AS updatedBy,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
      FROM long_term_care_registries
      ORDER BY id DESC
    `)

    const zoneSet = new Set()
    for (const r of rows) {
      if (r.areaZone && r.areaZone.trim()) {
        zoneSet.add(r.areaZone.trim())
      }
    }
    const availableAreaZones = Array.from(zoneSet).sort()

    let filtered = rows
    const searchTrimmed = (search || '').trim().toLowerCase()
    if (searchTrimmed) {
      filtered = filtered.filter(r => {
        const hnMatch = r.hn && r.hn.toLowerCase().includes(searchTrimmed)
        const cidMatch = r.cid && r.cid.toLowerCase().includes(searchTrimmed)
        const nameMatch = r.patientName && r.patientName.toLowerCase().includes(searchTrimmed)
        const tambonMatch = r.tambon && r.tambon.toLowerCase().includes(searchTrimmed)
        return hnMatch || cidMatch || nameMatch || tambonMatch
      })
    }

    if (areaZone && areaZone !== 'ALL') {
      filtered = filtered.filter(r => r.areaZone === areaZone)
    }

    const total = filtered.length
    const numLimit = parseInt(limit, 10) || 50
    const totalPages = Math.max(1, Math.ceil(total / numLimit))
    const isExport = exportAll === 'true'

    const pageNum = parseInt(page, 10) || 1
    const pagedItems = isExport ? filtered : filtered.slice((pageNum - 1) * numLimit, pageNum * numLimit)

    let totalAdl = 0
    let countWithAdl = 0
    const zoneCounts = {}
    for (const r of filtered) {
      if (r.adlScore !== null && r.adlScore !== undefined) {
        totalAdl += Number(r.adlScore)
        countWithAdl++
      }
      if (r.areaZone && r.areaZone.trim()) {
        const z = r.areaZone.trim()
        zoneCounts[z] = (zoneCounts[z] || 0) + 1
      }
    }
    const avgAdl = countWithAdl > 0 ? Math.round((totalAdl / countWithAdl) * 10) / 10 : 0

    return {
      success: true,
      items: pagedItems,
      total,
      page: isExport ? 1 : pageNum,
      limit: isExport ? total : numLimit,
      totalPages,
      availableAreaZones,
      stats: {
        total,
        avgAdl,
        zoneCounts
      }
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.15.3 Get LTC Registry by ID
fastify.get('/api/v1/app/ltc/registries/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงข้อมูลทะเบียน LTC รายบุคคลตาม ID',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [rows] = await appPool.query(`
      SELECT
        id,
        hn,
        cid,
        patient_name AS patientName,
        address,
        moo,
        tambon,
        age,
        adl_score AS adlScore,
        area_zone AS areaZone,
        created_by AS createdBy,
        updated_by AS updatedBy,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
      FROM long_term_care_registries
      WHERE id = ?
      LIMIT 1
    `, [id])
    if (rows.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบข้อมูล LTC' }
    }
    return { success: true, data: rows[0] }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.15.4 Get LTC Registry by HN
fastify.get('/api/v1/app/ltc/registries/by-hn/:hn', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงข้อมูลทะเบียน LTC รายบุคคลตาม HN',
    params: {
      type: 'object',
      properties: { hn: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { hn } = req.params
  const cleanHn = /^\d+$/.test(hn.trim()) ? hn.trim().padStart(7, '0') : hn.trim()
  try {
    const [rows] = await appPool.query(`
      SELECT
        id,
        hn,
        cid,
        patient_name AS patientName,
        address,
        moo,
        tambon,
        age,
        adl_score AS adlScore,
        area_zone AS areaZone,
        created_by AS createdBy,
        updated_by AS updatedBy,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
      FROM long_term_care_registries
      WHERE hn = ?
      LIMIT 1
    `, [cleanHn])
    if (rows.length === 0) {
      return { success: true, exists: false, data: null }
    }
    return { success: true, exists: true, data: rows[0] }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.15.5 Create LTC Registry
fastify.post('/api/v1/app/ltc/registries', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'เพิ่มผู้ป่วยในทะเบียน Long-Term Care (LTC)',
    body: {
      type: 'object',
      required: ['hn', 'patientName'],
      properties: {
        hn: { type: 'string' },
        cid: { type: ['string', 'null'] },
        patientName: { type: 'string' },
        address: { type: ['string', 'null'] },
        moo: { type: ['string', 'null'] },
        tambon: { type: ['string', 'null'] },
        age: { type: ['number', 'null'] },
        adlScore: { type: ['number', 'null'] },
        areaZone: { type: ['string', 'null'] },
        createdBy: { type: ['string', 'null'] }
      }
    }
  }
}, async (req, reply) => {
  const {
    hn, cid = null, patientName, address = null, moo = null,
    tambon = null, age = null, adlScore = null, areaZone = null,
    createdBy = 'system'
  } = req.body || {}
  const cleanHn = /^\d+$/.test(hn.trim()) ? hn.trim().padStart(7, '0') : hn.trim()
  try {
    const [existing] = await appPool.query('SELECT id FROM long_term_care_registries WHERE hn = ? LIMIT 1', [cleanHn])
    if (existing.length > 0) {
      reply.code(409); return { success: false, error: `ผู้ป่วย HN: ${cleanHn} มีรายชื่อในทะเบียน LTC อยู่แล้ว` }
    }
    const [res] = await appPool.query(`
      INSERT INTO long_term_care_registries (
        hn, cid, patient_name, address, moo, tambon, age, adl_score, area_zone, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      cleanHn, cid ? String(cid).trim() : null, patientName.trim(),
      address ? String(address).trim() : null, moo ? String(moo).trim() : null,
      tambon ? String(tambon).trim() : null, age !== null ? Number(age) : null,
      adlScore !== null ? Number(adlScore) : null, areaZone ? String(areaZone).trim() : null,
      createdBy, createdBy
    ])
    return { success: true, insertId: res.insertId }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.15.6 Update LTC Registry
fastify.put('/api/v1/app/ltc/registries/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'แก้ไขข้อมูลทะเบียน LTC ตาม ID',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const body = req.body || {}
  const updates = []
  const params = []

  const colMap = {
    patientName: 'patient_name',
    cid: 'cid',
    address: 'address',
    moo: 'moo',
    tambon: 'tambon',
    age: 'age',
    adlScore: 'adl_score',
    areaZone: 'area_zone',
    updatedBy: 'updated_by'
  }

  for (const [key, col] of Object.entries(colMap)) {
    if (body[key] !== undefined) {
      updates.push(`${col} = ?`)
      params.push(body[key] !== null ? body[key] : null)
    }
  }

  if (updates.length === 0) {
    reply.code(400); return { success: false, error: 'ไม่มีข้อมูลที่ต้องการอัปเดต' }
  }

  updates.push('updated_at = NOW()')
  params.push(id)

  try {
    const [res] = await appPool.query(
      `UPDATE long_term_care_registries SET ${updates.join(', ')} WHERE id = ?`,
      params
    )
    return { success: true, affectedRows: res.affectedRows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.15.7 Delete LTC Registry
fastify.delete('/api/v1/app/ltc/registries/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ลบข้อมูลทะเบียน LTC ตาม ID',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [res] = await appPool.query('DELETE FROM long_term_care_registries WHERE id = ?', [id])
    if (res.affectedRows === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบข้อมูลที่ต้องการลบ' }
    }
    return { success: true, message: 'ลบข้อมูลสำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// ============================================================================
// 4.16 ITA Blogs Services
// ============================================================================

// 4.16.1 List ITA Blogs
fastify.get('/api/v1/app/ita/blogs', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายการบทความ ITA (รองรับ filter authorId, admin, search, limit)',
    querystring: {
      type: 'object',
      properties: {
        authorId: { type: 'string' },
        admin: { type: 'string' },
        search: { type: 'string' },
        limit: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { authorId = '', admin = '', search = '', limit = '' } = req.query || {}
  try {
    let sql = `
      SELECT id, title, slug, content, author_id, author_name, author_position, created_at, updated_at
      FROM ita_blogs
    `
    const params = []
    const wheres = []

    if (authorId && admin !== 'true') {
      wheres.push('author_id = ?')
      params.push(parseInt(authorId, 10))
    }

    if (search && search.trim()) {
      wheres.push('(title LIKE ? OR content LIKE ?)')
      params.push(`%${search.trim()}%`, `%${search.trim()}%`)
    }

    if (wheres.length > 0) {
      sql += ` WHERE ${wheres.join(' AND ')}`
    }

    sql += ' ORDER BY created_at DESC'

    if (limit && parseInt(limit, 10) > 0) {
      sql += ' LIMIT ?'
      params.push(parseInt(limit, 10))
    }

    const [rows] = await appPool.query(sql, params)
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.16.2 Get ITA Blog by ID or Slug
fastify.get('/api/v1/app/ita/blogs/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงข้อมูลบทความ ITA ตาม ID หรือ Slug',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    querystring: {
      type: 'object',
      properties: { slug: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params || {}
  const { slug } = req.query || {}
  const rawTarget = slug || id

  try {
    const isNumeric = /^\d+$/.test(rawTarget)
    let sql = 'SELECT id, title, slug, content, author_id, author_name, author_position, created_at, updated_at FROM ita_blogs'
    const params = []

    if (isNumeric) {
      sql += ' WHERE id = ? LIMIT 1'
      params.push(parseInt(rawTarget, 10))
    } else {
      sql += ' WHERE slug = ? LIMIT 1'
      params.push(decodeURIComponent(rawTarget))
    }

    const [rows] = await appPool.query(sql, params)
    if (rows.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบบทความ' }
    }
    return { success: true, data: rows[0] }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.16.3 Create ITA Blog
fastify.post('/api/v1/app/ita/blogs', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'สร้างบทความ ITA ใหม่',
    body: {
      type: 'object',
      required: ['title', 'content'],
      properties: {
        title: { type: 'string' },
        slug: { type: 'string' },
        content: { type: 'string' },
        authorId: { type: 'number' },
        authorName: { type: 'string' },
        authorPosition: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { title, slug = '', content, authorId = null, authorName = '', authorPosition = '' } = req.body || {}
  try {
    const finalSlug = slug || title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    const [res] = await appPool.query(
      'INSERT INTO ita_blogs (title, slug, content, author_id, author_name, author_position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [title, finalSlug, content, authorId, authorName, authorPosition]
    )
    return { success: true, id: res.insertId }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.16.4 Update ITA Blog
fastify.put('/api/v1/app/ita/blogs/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'แก้ไขบทความ ITA',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    body: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        slug: { type: 'string' },
        content: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const { title, slug, content } = req.body || {}
  try {
    const [existing] = await appPool.query('SELECT id, author_id FROM ita_blogs WHERE id = ? LIMIT 1', [id])
    if (existing.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบข้อมูลบทความที่ต้องการแก้ไข' }
    }

    const updates = []
    const params = []
    if (title !== undefined) { updates.push('title = ?'); params.push(title) }
    if (slug !== undefined) { updates.push('slug = ?'); params.push(slug) }
    if (content !== undefined) { updates.push('content = ?'); params.push(content) }

    if (updates.length === 0) {
      reply.code(400); return { success: false, error: 'ไม่มีข้อมูลที่ต้องการอัปเดต' }
    }

    updates.push('updated_at = NOW()')
    params.push(id)

    const [res] = await appPool.query(`UPDATE ita_blogs SET ${updates.join(', ')} WHERE id = ?`, params)
    return { success: true, affectedRows: res.affectedRows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.16.5 Delete ITA Blog
fastify.delete('/api/v1/app/ita/blogs/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ลบบทความ ITA',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [existing] = await appPool.query('SELECT id, author_id FROM ita_blogs WHERE id = ? LIMIT 1', [id])
    if (existing.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบข้อมูลบทความที่ต้องการลบ' }
    }
    const [res] = await appPool.query('DELETE FROM ita_blogs WHERE id = ?', [id])
    return { success: true, message: 'ลบบทความสำเร็จ', authorId: existing[0].author_id }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// ============================================================================
// 4.17 RDU (Rational Drug Use) Services
// ============================================================================

// 4.17.1 Get RDU Folder & File Tree
fastify.get('/api/v1/app/rdu/tree', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงโครงสร้างโฟลเดอร์และไฟล์ RDU ทั้งหมด',
    querystring: {
      type: 'object',
      properties: {
        includeInactive: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { includeInactive = 'false' } = req.query || {}
  try {
    let folderSql = 'SELECT id, folder_name, display_order, is_active, created_at, updated_at FROM rdu_folders'
    if (includeInactive !== 'true') {
      folderSql += ' WHERE is_active = 1'
    }
    folderSql += ' ORDER BY id DESC'

    const [folders] = await appPool.query(folderSql)
    if (!folders || folders.length === 0) {
      return { success: true, folders: [] }
    }

    const folderIds = folders.map(f => f.id)
    const placeholders = folderIds.map(() => '?').join(',')
    const [files] = await appPool.query(
      `SELECT id, folder_id, display_name, file_name, file_path, file_size, display_order, created_at, updated_at
       FROM rdu_files
       WHERE folder_id IN (${placeholders})
       ORDER BY display_order ASC, id ASC`,
      folderIds
    )

    const filesByFolder = {}
    for (const f of files) {
      if (!filesByFolder[f.folder_id]) {
        filesByFolder[f.folder_id] = []
      }
      filesByFolder[f.folder_id].push({
        ...f,
        file_path: `/api/rdu/file/${f.id}`
      })
    }

    const tree = folders.map(folder => ({
      ...folder,
      files: filesByFolder[folder.id] || []
    }))

    return { success: true, folders: tree }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.17.2 Create RDU Folder
fastify.post('/api/v1/app/rdu/folders', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'สร้างโฟลเดอร์ RDU ใหม่',
    body: {
      type: 'object',
      required: ['folder_name'],
      properties: {
        folder_name: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const folderName = (req.body?.folder_name || '').trim()
  if (!folderName) {
    reply.code(400); return { success: false, error: 'กรุณาระบุชื่อโฟลเดอร์' }
  }

  try {
    const [dup] = await appPool.query('SELECT id FROM rdu_folders WHERE folder_name = ? LIMIT 1', [folderName])
    if (dup.length > 0) {
      reply.code(400); return { success: false, error: 'มีโฟลเดอร์ชื่อนี้อยู่ในระบบแล้ว' }
    }

    const [maxRes] = await appPool.query('SELECT MAX(display_order) as maxOrder FROM rdu_folders')
    const nextOrder = (maxRes[0]?.maxOrder ?? -1) + 1

    const [res] = await appPool.query(
      'INSERT INTO rdu_folders (folder_name, display_order, is_active, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW())',
      [folderName, nextOrder]
    )

    return { success: true, folderId: res.insertId, folderName, displayOrder: nextOrder }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.17.3 Update RDU Folder (Rename or Reorder)
fastify.put('/api/v1/app/rdu/folders/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'แก้ไขชื่อโฟลเดอร์หรือสลับลำดับโฟลเดอร์ RDU',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    body: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        folder_name: { type: 'string' },
        orders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              display_order: { type: 'number' }
            }
          }
        }
      }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const body = req.body || {}

  try {
    if (body.action === 'reorder' && Array.isArray(body.orders)) {
      for (const item of body.orders) {
        if (item.id !== undefined && item.display_order !== undefined) {
          await appPool.query('UPDATE rdu_folders SET display_order = ? WHERE id = ?', [item.display_order, item.id])
        }
      }
      return { success: true, message: 'ปรับปรุงลำดับโฟลเดอร์เรียบร้อยแล้ว' }
    }

    const newFolderName = (body.folder_name || '').trim()
    if (!id || !newFolderName) {
      reply.code(400); return { success: false, error: 'ข้อมูลไม่ครบถ้วน' }
    }

    const [existing] = await appPool.query('SELECT folder_name FROM rdu_folders WHERE id = ? LIMIT 1', [id])
    if (existing.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบโฟลเดอร์ที่ต้องการแก้ไข' }
    }

    const oldFolderName = existing[0].folder_name
    if (oldFolderName !== newFolderName) {
      const [dup] = await appPool.query('SELECT id FROM rdu_folders WHERE folder_name = ? AND id != ? LIMIT 1', [newFolderName, id])
      if (dup.length > 0) {
        reply.code(400); return { success: false, error: 'มีโฟลเดอร์ชื่อนี้อยู่แล้ว' }
      }

      await appPool.query('UPDATE rdu_folders SET folder_name = ?, updated_at = NOW() WHERE id = ?', [newFolderName, id])
      
      const newSanitized = newFolderName.replace(/[\\/:*?"<>|]/g, '_')
      const [files] = await appPool.query('SELECT id, file_name FROM rdu_files WHERE folder_id = ?', [id])
      for (const f of files) {
        const updatedFilePath = `/documents/rdu/${encodeURIComponent(newSanitized)}/${encodeURIComponent(f.file_name)}`
        await appPool.query('UPDATE rdu_files SET file_path = ?, updated_at = NOW() WHERE id = ?', [updatedFilePath, f.id])
      }

      return { success: true, message: 'แก้ไขชื่อโฟลเดอร์เรียบร้อยแล้ว', oldFolderName, newFolderName }
    }

    return { success: true, message: 'ไม่มีการเปลี่ยนแปลงชื่อโฟลเดอร์' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.17.4 Delete RDU Folder
fastify.delete('/api/v1/app/rdu/folders/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ลบโฟลเดอร์ RDU และไฟล์ทั้งหมดในโฟลเดอร์',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [existing] = await appPool.query('SELECT folder_name FROM rdu_folders WHERE id = ? LIMIT 1', [id])
    if (existing.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบโฟลเดอร์' }
    }

    await appPool.query('DELETE FROM rdu_files WHERE folder_id = ?', [id])
    await appPool.query('DELETE FROM rdu_folders WHERE id = ?', [id])

    return { success: true, message: 'ลบโฟลเดอร์และไฟล์เรียบร้อยแล้ว', folderName: existing[0].folder_name }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.17.5 Get RDU File by ID (For streaming)
fastify.get('/api/v1/app/rdu/files/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงข้อมูลไฟล์ RDU เดี่ยวสำหรับแสดงผลหรือดาวน์โหลด',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [rows] = await appPool.query(
      `SELECT f.id, f.folder_id, f.display_name, f.file_name, f.file_path, f.file_size, f.display_order, d.folder_name
       FROM rdu_files f
       JOIN rdu_folders d ON f.folder_id = d.id
       WHERE f.id = ? LIMIT 1`,
      [id]
    )
    if (rows.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบไฟล์ที่ระบุในฐานข้อมูล' }
    }
    return { success: true, data: rows[0] }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.17.6 Create RDU File Record
fastify.post('/api/v1/app/rdu/files', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'บันทึกข้อมูลไฟล์ PDF ของ RDU เข้าสู่ระบบ',
    body: {
      type: 'object',
      required: ['folder_id', 'display_name', 'file_name'],
      properties: {
        folder_id: { type: 'number' },
        display_name: { type: 'string' },
        file_name: { type: 'string' },
        file_path: { type: 'string' },
        file_size: { type: 'number' }
      }
    }
  }
}, async (req, reply) => {
  const { folder_id, display_name, file_name, file_path = '', file_size = null } = req.body || {}
  try {
    const [folderRes] = await appPool.query('SELECT folder_name FROM rdu_folders WHERE id = ? LIMIT 1', [folder_id])
    if (folderRes.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบโฟลเดอร์ที่ระบุ' }
    }

    const [maxRes] = await appPool.query('SELECT MAX(display_order) as maxOrder FROM rdu_files WHERE folder_id = ?', [folder_id])
    const nextOrder = (maxRes[0]?.maxOrder ?? -1) + 1

    const [res] = await appPool.query(
      `INSERT INTO rdu_files (folder_id, display_name, file_name, file_path, file_size, display_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [folder_id, display_name, file_name, file_path, file_size, nextOrder]
    )

    return {
      success: true,
      file: {
        id: res.insertId,
        folder_id,
        display_name,
        file_name,
        file_path: `/api/rdu/file/${res.insertId}`,
        file_size,
        display_order: nextOrder
      }
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.17.7 Update RDU File (Rename or Reorder)
fastify.put('/api/v1/app/rdu/files/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'แก้ไขชื่อแสดงผลหรือสลับลำดับไฟล์ RDU',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    body: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        display_name: { type: 'string' },
        orders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              display_order: { type: 'number' }
            }
          }
        }
      }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const body = req.body || {}

  try {
    if (body.action === 'reorder' && Array.isArray(body.orders)) {
      for (const item of body.orders) {
        if (item.id !== undefined && item.display_order !== undefined) {
          await appPool.query('UPDATE rdu_files SET display_order = ? WHERE id = ?', [item.display_order, item.id])
        }
      }
      return { success: true, message: 'ปรับปรุงลำดับไฟล์เรียบร้อยแล้ว' }
    }

    const displayName = (body.display_name || '').trim()
    if (!id || !displayName) {
      reply.code(400); return { success: false, error: 'กรุณาระบุชื่อแสดงผลของไฟล์' }
    }

    const [res] = await appPool.query('UPDATE rdu_files SET display_name = ?, updated_at = NOW() WHERE id = ?', [displayName, id])
    if (res.affectedRows === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบไฟล์ที่ต้องการแก้ไข' }
    }

    return { success: true, message: 'แก้ไขชื่อแสดงผลสำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.17.8 Delete RDU File
fastify.delete('/api/v1/app/rdu/files/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ลบข้อมูลไฟล์ RDU',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [rows] = await appPool.query(
      `SELECT f.id, f.file_name, f.file_path, d.folder_name 
       FROM rdu_files f 
       JOIN rdu_folders d ON f.folder_id = d.id 
       WHERE f.id = ? LIMIT 1`,
      [id]
    )
    if (rows.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบไฟล์ที่ต้องการลบ' }
    }

    await appPool.query('DELETE FROM rdu_files WHERE id = ?', [id])
    return { success: true, message: 'ลบไฟล์เรียบร้อยแล้ว', file: rows[0] }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// ============================================================================
// 4.18 Outgoing Documents Services
// ============================================================================

// 4.18.1 List Outgoing Documents
fastify.get('/api/v1/app/outgoing-documents', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายการหนังสือส่งออก Online',
    querystring: {
      type: 'object',
      properties: {
        activeOnly: { type: 'string' },
        order: { type: 'string', enum: ['service', 'manager'] }
      }
    }
  }
}, async (req, reply) => {
  const { activeOnly = 'false', order = 'manager' } = req.query || {}
  try {
    let sql = `
      SELECT id, year, label, note, url, status, display_order AS displayOrder, is_active AS isActive,
             created_by AS createdBy, updated_by AS updatedBy, created_at AS createdAt, updated_at AS updatedAt
      FROM outgoing_documents
    `
    const params = []
    if (activeOnly === 'true') {
      sql += ' WHERE is_active = 1'
    }

    if (order === 'service') {
      sql += ' ORDER BY year DESC, display_order DESC'
    } else {
      sql += ' ORDER BY display_order ASC, year ASC'
    }

    const [rows] = await appPool.query(sql, params)
    return { success: true, count: rows.length, documents: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.18.2 Get Outgoing Document by ID
fastify.get('/api/v1/app/outgoing-documents/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงข้อมูลหนังสือส่งออกตาม ID',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [rows] = await appPool.query(
      `SELECT id, year, label, note, url, status, display_order AS displayOrder, is_active AS isActive,
              created_by AS createdBy, updated_by AS updatedBy, created_at AS createdAt, updated_at AS updatedAt
       FROM outgoing_documents
       WHERE id = ? LIMIT 1`,
      [id]
    )
    if (rows.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบข้อมูลรายการหนังสือส่งออกนี้' }
    }
    return { success: true, document: rows[0] }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.18.3 Create Outgoing Document
fastify.post('/api/v1/app/outgoing-documents', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'เพิ่มรายการหนังสือส่งออกใหม่',
    body: {
      type: 'object',
      required: ['year', 'label', 'url'],
      properties: {
        year: { type: 'string' },
        label: { type: 'string' },
        note: { type: 'string' },
        url: { type: 'string' },
        status: { type: 'string' },
        displayOrder: { type: 'number' },
        isActive: { type: 'boolean' },
        createdBy: { type: 'string' },
        updatedBy: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const {
    year,
    label,
    note = '',
    url,
    status = 'เสร็จสิ้น',
    displayOrder = 0,
    isActive = true,
    createdBy = '',
    updatedBy = ''
  } = req.body || {}

  try {
    const [res] = await appPool.query(
      `INSERT INTO outgoing_documents (year, label, note, url, status, display_order, is_active, created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [year, label, note || '', url, status, displayOrder, isActive ? 1 : 0, createdBy, updatedBy || createdBy]
    )

    const created = {
      id: res.insertId,
      year,
      label,
      note: note || '',
      url,
      status,
      displayOrder,
      isActive: Boolean(isActive),
      createdBy,
      updatedBy: updatedBy || createdBy
    }

    return { success: true, document: created, message: 'บันทึกข้อมูลลิงก์หนังสือส่งออกสำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.18.4 Update Outgoing Document
fastify.put('/api/v1/app/outgoing-documents/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'แก้ไขรายการหนังสือส่งออก',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    body: {
      type: 'object',
      properties: {
        year: { type: 'string' },
        label: { type: 'string' },
        note: { type: 'string' },
        url: { type: 'string' },
        status: { type: 'string' },
        displayOrder: { type: 'number' },
        isActive: { type: 'boolean' },
        updatedBy: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const body = req.body || {}

  try {
    const [existing] = await appPool.query('SELECT id, year, label FROM outgoing_documents WHERE id = ? LIMIT 1', [id])
    if (existing.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบข้อมูลรายการหนังสือส่งออกนี้' }
    }

    const updates = []
    const params = []

    if (body.year !== undefined) { updates.push('year = ?'); params.push(body.year) }
    if (body.label !== undefined) { updates.push('label = ?'); params.push(body.label) }
    if (body.note !== undefined) { updates.push('note = ?'); params.push(body.note || '') }
    if (body.url !== undefined) { updates.push('url = ?'); params.push(body.url) }
    if (body.status !== undefined) { updates.push('status = ?'); params.push(body.status) }
    if (body.displayOrder !== undefined) { updates.push('display_order = ?'); params.push(body.displayOrder) }
    if (body.isActive !== undefined) { updates.push('is_active = ?'); params.push(body.isActive ? 1 : 0) }
    if (body.updatedBy !== undefined) { updates.push('updated_by = ?'); params.push(body.updatedBy) }

    if (updates.length === 0) {
      reply.code(400); return { success: false, error: 'ไม่มีข้อมูลที่ต้องการอัปเดต' }
    }

    updates.push('updated_at = NOW()')
    params.push(id)

    await appPool.query(`UPDATE outgoing_documents SET ${updates.join(', ')} WHERE id = ?`, params)

    const [updatedRows] = await appPool.query(
      `SELECT id, year, label, note, url, status, display_order AS displayOrder, is_active AS isActive,
              created_by AS createdBy, updated_by AS updatedBy, created_at AS createdAt, updated_at AS updatedAt
       FROM outgoing_documents WHERE id = ? LIMIT 1`,
      [id]
    )

    return {
      success: true,
      document: updatedRows[0] || { id, year: body.year, label: body.label },
      message: 'อัปเดตข้อมูลสำเร็จ'
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.18.5 Delete Outgoing Document
fastify.delete('/api/v1/app/outgoing-documents/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ลบรายการหนังสือส่งออก',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [existing] = await appPool.query('SELECT id, year, label FROM outgoing_documents WHERE id = ? LIMIT 1', [id])
    if (existing.length === 0) {
      reply.code(404); return { success: false, error: 'ไม่พบรายการที่ต้องการลบ' }
    }

    await appPool.query('DELETE FROM outgoing_documents WHERE id = ?', [id])
    return { success: true, message: 'ลบรายการสำเร็จ', document: existing[0] }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

}

