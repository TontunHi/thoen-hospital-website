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
    summary: 'ดึงรายชื่อสมาชิก/บุคลากรทั้งหมด'
  }
}, async (req, reply) => {
  try {
    const [rows] = await appPool.query(
      "SELECT id, username, email, name, department, position, salary_user, role, created_at, updated_at FROM members ORDER BY created_at DESC"
    )
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
    summary: 'ดึงรายการข่าวสาร/ประชาสัมพันธ์ (มีแคช 30 วิ)',
    querystring: {
      type: 'object',
      properties: {
        category: { type: 'string' },
        limit: { type: 'string', default: '10' }
      }
    }
  }
}, async (req, reply) => {
  const { category = '', limit = '10' } = req.query || {}
  try {
    const cacheKey = `app-news-${category}-${limit}`
    const data = await getCached(cacheKey, 30000, async () => {
      let sql = 'SELECT id, title, slug, category, view_count, created_at FROM news'
      const params = []
      if (category) { sql += ' WHERE category = ?'; params.push(category) }
      sql += ' ORDER BY created_at DESC LIMIT ?'; params.push(parseInt(limit, 10))
      const [rows] = await appPool.query(sql, params)
      return rows
    })
    return { success: true, count: data.length, data }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.post('/api/v1/app/news', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'สร้างข่าวสาร/กิจกรรมใหม่',
    body: {
      type: 'object',
      required: ['title', 'slug', 'category', 'startDate', 'endDate'],
      properties: {
        title: { type: 'string' },
        slug: { type: 'string' },
        category: { type: 'string' },
        youtubeLink: { type: 'string' },
        startDate: { type: 'string', description: 'YYYY-MM-DD HH:mm:ss' },
        endDate: { type: 'string', description: 'YYYY-MM-DD HH:mm:ss' }
      }
    }
  }
}, async (req, reply) => {
  const { title, slug, category, youtubeLink = null, startDate, endDate } = req.body || {}
  try {
    const [res] = await appPool.query(
      'INSERT INTO news (title, slug, category, youtube_link, start_date, end_date, view_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, NOW(), NOW())',
      [title, slug, category, youtubeLink, startDate, endDate]
    )
    return { success: true, insertId: res.insertId }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.2 News Detail & Update & Delete
fastify.get('/api/v1/app/news/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ดึงรายละเอียดข่าวสารตาม ID (พร้อมอัปเดตยอดวิวอัตโนมัติ)',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    const [rows] = await appPool.query('SELECT * FROM news WHERE id = ? LIMIT 1', [id])
    if (rows.length === 0) { reply.code(404); return { success: false, error: 'ไม่พบข่าว' } }
    appPool.query('UPDATE news SET view_count = view_count + 1 WHERE id = ?', [id]).catch(() => {})
    const [attachments] = await appPool.query('SELECT id, file_path, file_type, original_name FROM attachments WHERE news_id = ?', [id])
    return { success: true, data: { ...rows[0], attachments } }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.put('/api/v1/app/news/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'แก้ไขข้อมูลข่าวสาร',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    },
    body: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        category: { type: 'string' },
        youtubeLink: { type: 'string' },
        startDate: { type: 'string' },
        endDate: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  const { title, category, youtubeLink, startDate, endDate } = req.body || {}
  try {
    await appPool.query(
      `UPDATE news SET 
         title = COALESCE(?, title),
         category = COALESCE(?, category),
         youtube_link = COALESCE(?, youtube_link),
         start_date = COALESCE(?, start_date),
         end_date = COALESCE(?, end_date),
         updated_at = NOW()
       WHERE id = ?`,
      [title, category, youtubeLink, startDate, endDate, id]
    )
    return { success: true, message: 'แก้ไขข่าวสารสำเร็จ' }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
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
    summary: 'ดึงแบนเนอร์สไลด์หน้าแรก (มีแคช 60 วิ)'
  }
}, async (req, reply) => {
  try {
    const data = await getCached('app-slides', 60000, async () => {
      const [rows] = await appPool.query('SELECT id, title, image_path, link_url, display_order, duration FROM hero_slides ORDER BY display_order ASC')
      return rows
    })
    return { success: true, count: data.length, data }
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
    const [res] = await appPool.query(
      'INSERT INTO hero_slides (title, image_path, link_url, display_order, duration, start_date, end_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [title, imagePath, linkUrl, displayOrder, duration, startDate, endDate]
    )
    return { success: true, insertId: res.insertId }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

fastify.delete('/api/v1/app/slides/:id', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'ลบภาพสไลด์แบนเนอร์',
    params: {
      type: 'object',
      properties: { id: { type: 'string' } }
    }
  }
}, async (req, reply) => {
  const { id } = req.params
  try {
    await appPool.query('DELETE FROM hero_slides WHERE id = ?', [id])
    return { success: true, message: 'ลบสไลด์สำเร็จ' }
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

// 4.11 Check Position Permission
fastify.post('/api/v1/app/members/check-position-permission', {
  schema: {
    tags: ['3. Members Management'],
    summary: 'ตรวจสอบสิทธิ์ของตำแหน่งงาน',
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
    const [users] = await appPool.query('SELECT position, role FROM members WHERE username = ? LIMIT 1', [username])
    if (users.length === 0) return { success: true, allowed: false }
    const user = users[0]
    if (user.role === 'admin') return { success: true, allowed: true }

    const userPosition = (user.position || '').trim()
    if (!userPosition || !permissionKeys || permissionKeys.length === 0) return { success: true, allowed: false }

    const placeholders = permissionKeys.map(() => '?').join(', ')
    const [rows] = await appPool.query(
      `SELECT COUNT(*) as count FROM position_permissions WHERE permission_key IN (${placeholders}) AND TRIM(position_name) = TRIM(?)`,
      [...permissionKeys, userPosition]
    )
    return { success: true, allowed: (rows[0]?.count || 0) > 0 }
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

}

