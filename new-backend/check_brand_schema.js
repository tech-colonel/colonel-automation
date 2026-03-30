const { getBrandConnection } = require('./src/config/database');
const { Brand } = require('./src/models/master');

async function checkBrandSchema() {
  try {
    const brand = await Brand.findOne({ where: { name: 'Nestroots' } });
    if (!brand) {
      console.log('Nestroots brand not found');
      return;
    }

    const brandDb = getBrandConnection(brand.db_name);
    const [results] = await brandDb.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'brand_agents'
    `);

    console.log(`--- brand_agents columns in ${brand.db_name} ---`);
    results.forEach(c => console.log(`${c.column_name}: ${c.data_type}`));

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkBrandSchema();
