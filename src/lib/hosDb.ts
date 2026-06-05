import mysql from 'mysql2/promise'

export async function queryHosDb(sql: string, params: any[] = []) {
  const connection = await mysql.createConnection({
    host: process.env.ER_DB_HOST,
    port: parseInt(process.env.ER_DB_PORT || '3306'),
    user: process.env.ER_DB_USER,
    password: process.env.ER_DB_PASSWORD,
    database: process.env.ER_DB_NAME,
    charset: process.env.ER_DB_CHARSET || 'tis620',
    connectTimeout: 5000, // 5 seconds timeout
  })

  try {
    const [results] = await connection.execute(sql, params)
    return results as any[]
  } finally {
    await connection.end()
  }
}
