import initializeDatabase from './schema.js';
import pool from './connection.js';

async function migrate() {
  try {
    await initializeDatabase();
    console.log('Database migration completed successfully.');
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void migrate();
