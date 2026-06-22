/**
 * Migration: Rename GST_AMOUNT → gst_amount in all invoice_processing tables
 *
 * Run this ONCE on any database where invoice_processing was created with the
 * old schema (uppercase GST_AMOUNT column). Safe to run multiple times — it
 * checks whether the old column exists before renaming.
 *
 * Usage:
 *   cd new-backend
 *   node migrations/fix-gst-amount-column.js
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');
const { masterSequelize } = require('../src/config/database');
const { Brand, Agent } = require('../src/models/master');

const fixGstAmountColumn = async (sequelize, dbName) => {
    try {
        // Check if old uppercase column exists
        const [cols] = await sequelize.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'invoice_processing'
              AND column_name = 'GST_AMOUNT'
        `);

        if (cols.length === 0) {
            // Check lowercase already exists
            const [lower] = await sequelize.query(`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'invoice_processing'
                  AND column_name = 'gst_amount'
            `);
            if (lower.length > 0) {
                console.log(`[${dbName}] ✓ Already using gst_amount (lowercase) — skipping`);
            } else {
                console.log(`[${dbName}] ℹ No invoice_processing table yet — skipping`);
            }
            return;
        }

        // Rename the column
        await sequelize.query(`ALTER TABLE invoice_processing RENAME COLUMN "GST_AMOUNT" TO gst_amount`);
        console.log(`[${dbName}] ✅ Renamed GST_AMOUNT → gst_amount`);
    } catch (err) {
        console.error(`[${dbName}] ❌ Error:`, err.message);
    }
};

const updateAgentColumns = async () => {
    const agent = await Agent.findOne({ where: { name: 'Invoice-Processing' } });
    if (!agent) {
        console.log('[agents] ℹ Invoice-Processing agent not found — run seed-invoice-processing.js first');
        return;
    }

    const updated = agent.columns.map(col =>
        col.name === 'GST_AMOUNT' ? { ...col, name: 'gst_amount' } : col
    );

    const hadUppercase = agent.columns.some(c => c.name === 'GST_AMOUNT');
    if (!hadUppercase) {
        console.log('[agents] ✓ Agent columns already use gst_amount — skipping');
        return;
    }

    agent.columns = updated;
    await agent.save();
    console.log('[agents] ✅ Updated Invoice-Processing agent.columns: GST_AMOUNT → gst_amount');
};

(async () => {
    try {
        await masterSequelize.authenticate();

        // 1. Fix agent.columns JSONB
        await updateAgentColumns();

        // 2. Fix each brand's invoice_processing table
        const brands = await Brand.findAll({ attributes: ['name', 'db_name'] });
        for (const brand of brands) {
            try {
                const seq = new Sequelize(`postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${brand.db_name}`, {
                    dialect: 'postgres',
                    logging: false
                });
                await seq.authenticate();
                await fixGstAmountColumn(seq, brand.db_name);
                await seq.close();
            } catch (e) {
                console.log(`[${brand.db_name}] ⚠ Could not connect:`, e.message);
            }
        }

        console.log('\nMigration complete.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    }
})();
