import mysql from 'mysql2/promise'

export async function querySalaryDb(sql: string, params: any[] = []) {
  const connection = await mysql.createConnection({
    host: process.env.SALARY_DB_HOST,
    port: parseInt(process.env.SALARY_DB_PORT || '3306'),
    user: process.env.SALARY_DB_USER,
    password: process.env.SALARY_DB_PASSWORD,
    database: process.env.SALARY_DB_NAME,
    charset: process.env.SALARY_DB_CHARSET || 'tis620',
    connectTimeout: 5000, // 5 seconds timeout
  })

  try {
    const [results] = await connection.execute(sql, params)
    return results as any[]
  } finally {
    await connection.end()
  }
}
