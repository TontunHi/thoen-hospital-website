const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: '192.168.1.7',
    port: 3306,
    user: 'prnew',
    password: 'PRnew11152@',
    database: 'thoen_hospital'
  });

  console.log('Connected to thoen_hospital.');

  console.log('--- Database variables ---');
  const [vars] = await connection.query("SHOW VARIABLES LIKE 'character_set_%';");
  console.log(vars);

  console.log('--- Table Status ---');
  const [status] = await connection.query("SHOW TABLE STATUS;");
  console.log(status.map(s => ({ Name: s.Name, Collation: s.Collation })));

  console.log('--- Columns of news ---');
  const [columns] = await connection.query("SHOW FULL COLUMNS FROM `news`;");
  console.log(columns.map(c => ({ Field: c.Field, Type: c.Type, Collation: c.Collation })));

  await connection.end();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
