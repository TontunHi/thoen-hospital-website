const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: '192.168.1.7',
    port: 3306,
    user: 'prnew',
    password: 'PRnew11152@',
  });

  console.log('Connected to MySQL server.');

  console.log('Dropping database if exists: thoen_hospital...');
  await connection.query('DROP DATABASE IF EXISTS `thoen_hospital`;');

  console.log('Creating database with utf8mb4 and utf8mb4_unicode_ci...');
  await connection.query(
    'CREATE DATABASE `thoen_hospital` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
  );

  console.log('Database thoen_hospital cleaned and re-created successfully.');
  await connection.end();
}

main().catch((err) => {
  console.error('Error cleaning database:', err);
  process.exit(1);
});
