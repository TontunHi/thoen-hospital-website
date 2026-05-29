import mysql from 'mysql2/promise'

export async function queryAppointmentDb(sql: string, params: any[] = []) {
  const connection = await mysql.createConnection({
    host: process.env.APPOINT_DB_HOST,
    port: parseInt(process.env.APPOINT_DB_PORT || '3306'),
    user: process.env.APPOINT_DB_USER,
    password: process.env.APPOINT_DB_PASSWORD,
    database: process.env.APPOINT_DB_NAME,
    charset: process.env.APPOINT_DB_CHARSET || 'tis620',
    connectTimeout: 5000, // 5 seconds timeout
  })

  try {
    const [results] = await connection.execute(sql, params)
    return results as any[]
  } finally {
    await connection.end()
  }
}
