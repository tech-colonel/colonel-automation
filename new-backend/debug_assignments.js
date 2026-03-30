const { Brand, User, BrandUser, Agent, BrandAgent } = require('./src/models/master');
const { sequelize } = require('./src/config/database');

async function checkAssignments() {
  try {
    const brands = await Brand.findAll();
    const users = await User.findAll();
    const brandUsers = await BrandUser.findAll();

    console.log('--- BRANDS ---');
    brands.forEach(b => console.log(`${b.name} (${b.id})` ));
    
    console.log('\n--- USERS ---');
    users.forEach(u => console.log(`${u.email} (${u.id}) [${u.role}]`));

    const accountant = users.find(u => u.email === 'accountant@colonel.com');
    if (accountant) {
      console.log(`\n--- TESTING RETRIEVAL FOR ${accountant.email} ---`);
      const userWithBrands = await User.findByPk(accountant.id, {
        include: [{ model: Brand, through: { attributes: [] } }]
      });
      console.log('Found Brands:', userWithBrands.Brands?.map(b => b.name) || 'NONE');
    }

  } catch (err) {
    console.error(err);
  } finally {
    if (sequelize) await sequelize.close();
  }
}

checkAssignments();
