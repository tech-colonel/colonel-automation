const { masterSequelize } = require('./src/config/database');
async function check() {
  try {
    const [results] = await masterSequelize.query(`
      SELECT 
        conname AS constraint_name, 
        confrelid::regclass AS referenced_table, 
        af.attname AS foreign_key_column, 
        ar.attname AS referenced_column
      FROM pg_constraint c
      JOIN pg_attribute af ON af.attrelid = c.conrelid AND af.attnum = ANY(c.conkey)
      JOIN pg_attribute ar ON ar.attrelid = c.confrelid AND ar.attnum = ANY(c.confkey)
      WHERE c.conrelid = 'brand_agents'::regclass OR c.conrelid = 'brand_users'::regclass;
    `);
    console.log('Constraints:', JSON.stringify(results, null, 2));
  } catch(e) {
    console.error(e.message);
  } finally {
    process.exit();
  }
}
check();
