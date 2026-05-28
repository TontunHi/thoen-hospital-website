import mysql from 'mysql2/promise'

export async function queryErDb(sql: string, params: any[] = []) {
  const connection = await mysql.createConnection({
    host: '192.168.1.4',
    port: 3306,
    user: 'guest',
    password: 'guest',
    database: 'hos',
    charset: 'tis620',
    connectTimeout: 5000, // 5 seconds timeout
  })

  try {
    const [results] = await connection.execute(sql, params)
    return results as any[]
  } finally {
    await connection.end()
  }
}
