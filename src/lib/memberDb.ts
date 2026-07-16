import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null
let initPromise: Promise<void> | null = null

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MEMBER_DB_HOST || 'localhost',
      port: parseInt(process.env.MEMBER_DB_PORT || '3306'),
      user: process.env.MEMBER_DB_USER,
      password: process.env.MEMBER_DB_PASSWORD,
      database: process.env.MEMBER_DB_NAME || 'thoen_hospital_website',
      connectionLimit: 15,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: 5000,
      charset: 'utf8mb4',
    })
  }
  return pool
}

async function initializeDb(poolInstance: mysql.Pool) {
  const connection = await poolInstance.getConnection()
  try {
    await connection.query("SET NAMES utf8mb4")
    await connection.query("SET CHARACTER SET utf8mb4")

    // Automatically initialize/check table members
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NULL,
        department VARCHAR(100) NULL,
        salary_user VARCHAR(100) NULL,
        salary_pass VARCHAR(100) NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        otp_code VARCHAR(10) NULL,
        otp_expiry DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        profile_path VARCHAR(255) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Automatically initialize/check table pr_requests
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS pr_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        has_cost TINYINT(1) NOT NULL DEFAULT 0,
        requester_id INT NOT NULL,
        department VARCHAR(100) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        form_data JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (requester_id) REFERENCES members(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Automatically initialize/check table approval_tickets
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS approval_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        source_system VARCHAR(50) NOT NULL,
        source_id INT NOT NULL,
        step_number INT NOT NULL,
        assigned_position VARCHAR(100) NOT NULL,
        current_approver_id INT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
        comment VARCHAR(255) NULL,
        signature_path VARCHAR(255) NULL,
        approved_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (current_approver_id) REFERENCES members(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Safely add columns if the table already exists
    try {
      await connection.execute(`
        ALTER TABLE members ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'member'
      `)
    } catch (alterError) {}
    try {
      await connection.execute(`
        ALTER TABLE members ADD COLUMN name VARCHAR(255) NULL
      `)
    } catch (alterError) {}
    try {
      await connection.execute(`
        ALTER TABLE members ADD COLUMN department VARCHAR(100) NULL
      `)
    } catch (alterError) {}
    try {
      await connection.execute(`
        ALTER TABLE members ADD COLUMN position VARCHAR(100) NULL
      `)
    } catch (alterError) {}
    try {
      await connection.execute(`
        ALTER TABLE members ADD COLUMN signature_path VARCHAR(255) NULL
      `)
    } catch (alterError) {}
    try {
      await connection.execute(`
        ALTER TABLE members ADD COLUMN profile_path VARCHAR(255) NULL
      `)
    } catch (alterError) {}

    // Automatically initialize/check table member_system_settings
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS member_system_settings (
        config_key VARCHAR(100) PRIMARY KEY,
        config_value VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Seed default settings values if they don't already exist
    const defaultSettings = [
      { key: 'feature_signature', val: '1' },
      { key: 'feature_salary', val: '1' },
      { key: 'feature_pr_requests', val: '1' },
      { key: 'feature_approvals', val: '1' },
      { key: 'feature_ita', val: '1' }
    ]
    for (const setting of defaultSettings) {
      await connection.execute(
        'INSERT IGNORE INTO member_system_settings (config_key, config_value) VALUES (?, ?)',
        [setting.key, setting.val]
      )
    }



    // Initialize Track Work System (Single Table Consolidation)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS work_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_no VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        assignees TEXT NULL,
        attachments TEXT NULL,
        status_history TEXT NULL,
        progress_notes TEXT NULL,
        completion TEXT NULL,
        review TEXT NULL,
        FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Initialize Audit Logs Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        username VARCHAR(100) NULL,
        email VARCHAR(100) NULL,
        action_type VARCHAR(50) NOT NULL,
        target_table VARCHAR(100) NULL,
        action_details TEXT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Initialize Position Permissions Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS position_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        permission_key VARCHAR(100) NOT NULL,
        position_name VARCHAR(150) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_permission_position (permission_key, position_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Initialize ITA Blogs Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ita_blogs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        slug VARCHAR(500) NULL,
        content LONGTEXT NOT NULL,
        author_id INT NOT NULL,
        author_name VARCHAR(255) NULL,
        author_position VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES members(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    try {
      await connection.execute(`
        ALTER TABLE ita_blogs ADD COLUMN slug VARCHAR(500) NULL
      `)
    } catch (alterError) {}


    // Seed default permissions if table is empty
    const [existingPerms] = await connection.query('SELECT COUNT(*) as cnt FROM position_permissions')
    if ((existingPerms as any)[0]?.cnt === 0) {
      const defaultPermissions = [
        // create_work permissions
        { key: 'create_work', pos: 'เจ้าพนักงานเครื่องคอมพิวเตอร์' },
        { key: 'create_work', pos: 'นักวิชาการคอมพิวเตอร์' },
        { key: 'create_work', pos: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์' },
        { key: 'create_work', pos: 'ผู้อำนวยการ' },
        // view_all_work permissions
        { key: 'view_all_work', pos: 'ผู้อำนวยการ' },
        { key: 'view_all_work', pos: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์' },
        { key: 'view_all_work', pos: 'นักวิชาการคอมพิวเตอร์' },
        { key: 'view_all_work', pos: 'เจ้าพนักงานเครื่องคอมพิวเตอร์' }
      ]

      for (const perm of defaultPermissions) {
        await connection.execute(
          'INSERT IGNORE INTO position_permissions (permission_key, position_name) VALUES (?, ?)',
          [perm.key, perm.pos]
        )
      }
    }
  } finally {
    connection.release()
  }
}

export async function queryMemberDb(sql: string, params: any[] = []) {
  const currentPool = getPool()
  
  if (!initPromise) {
    initPromise = initializeDb(currentPool)
  }
  await initPromise

  const connection = await currentPool.getConnection()
  try {
    await connection.query("SET NAMES utf8mb4")
    const [results] = await connection.execute(sql, params)

    // Capture DB modification queries for audit logs
    const trimmedSql = sql.trim().toUpperCase()
    const isModify = /^(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE)/.test(trimmedSql)
    const isAuditLogWrite = /INSERT\s+INTO\s+AUDIT_LOGS/i.test(sql)

    if (isModify && !isAuditLogWrite) {
      // Extract target table name from sql
      let targetTable = 'unknown'
      const tableMatch = sql.match(/(?:from|into|update|table)\s+[\`"']?([a-zA-Z0-9_\-]+)[\`"']?/i)
      if (tableMatch) {
        targetTable = tableMatch[1]
      }

      let actionType = 'UPDATE'
      if (trimmedSql.startsWith('INSERT')) actionType = 'CREATE'
      else if (trimmedSql.startsWith('DELETE')) actionType = 'DELETE'
      else if (trimmedSql.startsWith('CREATE') || trimmedSql.startsWith('DROP') || trimmedSql.startsWith('ALTER')) actionType = 'SYSTEM'

      const { logAudit } = await import('./audit')
      logAudit(
        actionType as any,
        targetTable,
        `SQL: ${sql} | Params: ${JSON.stringify(params)}`
      ).catch(err => console.error('Failed to write CRUD audit log:', err))
    }

    return results as any[]
  } finally {
    connection.release()
  }
}
