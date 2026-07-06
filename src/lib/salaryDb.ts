import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.SALARY_DB_HOST,
      port: parseInt(process.env.SALARY_DB_PORT || '3306'),
      user: process.env.SALARY_DB_USER,
      password: process.env.SALARY_DB_PASSWORD,
      database: process.env.SALARY_DB_NAME,
      charset: process.env.SALARY_DB_CHARSET || 'tis620',
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: 5000,
    })
  }
  return pool
}

export async function querySalaryDb(sql: string, params: any[] = []) {
  const currentPool = getPool()
  const [results] = await currentPool.execute(sql, params)
  return results as any[]
}

let editPool: mysql.Pool | null = null

function getEditPool() {
  if (!editPool) {
    editPool = mysql.createPool({
      host: process.env.SALARY_EDIT_DB_HOST,
      port: parseInt(process.env.SALARY_EDIT_DB_PORT || '3306'),
      user: process.env.SALARY_EDIT_DB_USER,
      password: process.env.SALARY_EDIT_DB_PASSWORD,
      database: process.env.SALARY_EDIT_DB_NAME,
      charset: process.env.SALARY_EDIT_DB_CHARSET || 'tis620',
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: 5000,
    })
  }
  return editPool
}

export async function querySalaryEditDb(sql: string, params: any[] = []) {
  const currentPool = getEditPool()
  const [results] = await currentPool.execute(sql, params)
  return results as any[]
}
