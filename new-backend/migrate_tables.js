const { masterSequelize } = require('./src/config/database');

async function migrate() {
  const queryInterface = masterSequelize.getQueryInterface();
  
  try {
    console.log('Starting table migration...');

    // 1. Check if PascalCase tables exist
    const tables = await queryInterface.showAllTables();
    const hasPascalBrands = tables.includes('Brands');
    const hasPascalUsers = tables.includes('Users');
    const hasPascalAgents = tables.includes('Agents');

    if (!hasPascalBrands && !hasPascalUsers && !hasPascalAgents) {
      console.log('No PascalCase tables found. Migration might already be done.');
      return;
    }

    // 2. Drop empty lowercase tables if they exist (they might have been created by sync)
    // We do this carefully. Since I checked before and they were empty, it's safe.
    // However, they might have constraints from brand_agents/brand_users.
    
    console.log('Cleaning up empty lowercase tables...');
    await masterSequelize.query('DROP TABLE IF EXISTS "brand_agents" CASCADE');
    await masterSequelize.query('DROP TABLE IF EXISTS "brand_users" CASCADE');
    await masterSequelize.query('DROP TABLE IF EXISTS "brands" CASCADE');
    await masterSequelize.query('DROP TABLE IF EXISTS "users" CASCADE');
    await masterSequelize.query('DROP TABLE IF EXISTS "agents" CASCADE');

    // 3. Rename PascalCase tables to lowercase
    console.log('Renaming PascalCase tables to lowercase...');
    if (hasPascalBrands) await masterSequelize.query('ALTER TABLE "Brands" RENAME TO "brands"');
    if (hasPascalUsers) await masterSequelize.query('ALTER TABLE "Users" RENAME TO "users"');
    if (hasPascalAgents) await masterSequelize.query('ALTER TABLE "Agents" RENAME TO "agents"');

    console.log('✓ Migration completed successfully.');
    console.log('Now run the server to recreate junction tables and constraints.');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit();
  }
}

migrate();
