import pkg from 'pg';
const { Client } = pkg;
const client = new Client({ host:'localhost', port:5432, user:'postgres', password:'admin', database:'testmind_ai' });
try {
  await client.connect();
  const res = await client.query('SELECT current_database() AS db, version() AS ver');
  console.log(JSON.stringify(res.rows, null, 2));
} catch (err) {
  console.error('ERROR:', err.message);
  if (err.code) { console.error('CODE:', err.code); }
  if (err.detail) { console.error('DETAIL:', err.detail); }
  if (err.hint) { console.error('HINT:', err.hint); }
} finally {
  await client.end().catch(() => {});
}
