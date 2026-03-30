const { getBrandConnection } = require('./src/config/database');
const { QueryTypes } = require('sequelize');

async function check() {
    try {
        const db_name = 'colonel_nestroots';
        const db = getBrandConnection(db_name);
        const columns = await db.query(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sales_myntra'",
            { type: QueryTypes.SELECT }
        );
        console.log('Columns in sales_myntra:', JSON.stringify(columns, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}

check();
