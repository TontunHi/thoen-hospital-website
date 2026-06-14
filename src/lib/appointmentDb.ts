import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.APPOINT_DB_HOST,
      port: parseInt(process.env.APPOINT_DB_PORT || '3306'),
      user: process.env.APPOINT_DB_USER,
      password: process.env.APPOINT_DB_PASSWORD,
      database: process.env.APPOINT_DB_NAME,
      charset: process.env.APPOINT_DB_CHARSET || 'tis620',
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: 5000,
    })
  }
  return pool
}

export async function queryAppointmentDb(sql: string, params: any[] = []) {
  const currentPool = getPool()
  const [results] = await currentPool.execute(sql, params)
  return results as any[]
}
