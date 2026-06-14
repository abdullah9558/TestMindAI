import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'admin',
  database: 'testmind_ai',
});

try {
  const res = await pool.query('SELECT 1');
  console.log('Connected:', res.rows);
} catch (err) {
  console.error('Connection failed:', err);
} finally {
  await pool.end();
}