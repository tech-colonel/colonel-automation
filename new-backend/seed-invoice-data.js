const { masterSequelize, getBrandConnection } = require('./src/config/database');
const { Brand, Agent } = require('./src/models/master/index.js');
const { getDynamicModel } = require('./src/models/brand');
const { v4: uuidv4 } = require('uuid');

const INVOICE_ROWS = [
  {
    id: uuidv4(),
    processed_on: new Date(),
    company: 'BLINK COMMERCE PRIVATE LIMITED',
    vendor_name_tally: 'Blink Commerce Private Limited(H)',
    invoice_number: 'C21349T250032554',
    invoice_date: new Date('2026-03-21'),
    due_date: null,
    seller_gstin: '06AAFCG9846E1ZF',
    buyer_gstin: '24AAJCD2457N1ZC',
    voucher_type: 'Purchase Gujarat',
    category: 'N/A',
    product_name: 'SELLER_PRODUCT_REQUEST_CHARGES',
    hsn_code: '998361',
    batch_no: null,
    quantity: 1,
    unit: null,
    rate: 25000,
    taxable_value: 25000,
    cgst_rate: 0,
    sgst_rate: 0,
    igst_rate: 18,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: 4500,
    GST_AMOUNT: 4500,
    invoice_link: 'https://drive.google.com/file/d/1unHTw-bN3IrZ46N9_Lq83KZeq2U6O5GV/view?usp=drivesdk',
    status: 'Processed',
  },
];

const BRAND_NAME = process.env.SEED_BRAND || 'Koparo';

const seedInvoiceData = async () => {
  console.log(`Seeding invoice data into brand: ${BRAND_NAME} ...`);

  try {
    await masterSequelize.sync({ force: false });

    const brand = await Brand.findOne({ where: { name: BRAND_NAME } });
    if (!brand) {
      console.error(`Brand "${BRAND_NAME}" not found. Available brands: Koparo, Demo Brand, shumee, Mbrands`);
      console.error('Override with: SEED_BRAND="BrandName" node seed-invoice-data.js');
      process.exit(1);
    }

    const agent = await Agent.findOne({ where: { name: 'Invoice-Processing' } });
    if (!agent) {
      console.error('Invoice-Processing agent not found. Run: node seed-invoice-processing.js first');
      process.exit(1);
    }

    const brandDb = getBrandConnection(brand.db_name);
    const tableName = agent.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const InvoiceModel = getDynamicModel(brandDb, tableName, agent.columns);
    await InvoiceModel.sync({ alter: true });

    for (const row of INVOICE_ROWS) {
      const existing = await InvoiceModel.findOne({ where: { invoice_number: row.invoice_number } });
      if (existing) {
        console.log(`  ↳ Invoice ${row.invoice_number} already exists — skipping`);
        continue;
      }
      await InvoiceModel.create(row);
      console.log(`  ✓ Inserted invoice ${row.invoice_number}`);
    }

    console.log('\nDone.');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedInvoiceData();
