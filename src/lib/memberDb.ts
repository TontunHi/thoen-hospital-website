import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null
let initPromise: Promise<void> | null = null

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MEMBER_DB_HOST || '192.168.1.7',
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
      { key: 'feature_approvals', val: '1' }
    ]
    for (const setting of defaultSettings) {
      await connection.execute(
        'INSERT IGNORE INTO member_system_settings (config_key, config_value) VALUES (?, ?)',
        [setting.key, setting.val]
      )
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
    return results as any[]
  } finally {
    connection.release()
  }
}
