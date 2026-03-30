const { masterSequelize } = require('./src/config/database');
async function check() {
  try {
    const [br] = await masterSequelize.query('SELECT count(*) FROM "brands"');
    const [u] = await masterSequelize.query('SELECT count(*) FROM "users"');
    const [a] = await masterSequelize.query('SELECT count(*) FROM "agents"');
    
    console.log('--- Final lowercase Tables ---');
    console.log('brands Count:', br[0].count);
    console.log('users Count:', u[0].count);
    console.log('agents Count:', a[0].count);
    
    const tables = await masterSequelize.getQueryInterface().showAllTables();
    console.log('All Tables:', tables);
    
  } catch(e) {
    console.error(e.message);
  } finally {
    process.exit();
  }
}
check();
