const salesService = require('../../../services/salesService');
const { Brand, Agent } = require('../../../models/master');
const { getBrandConnection } = require('../../../config/database');
const { getDynamicModel } = require('../../../models/brand');
const { jiomartProcessor } = require('../../../services/processors/jiomart/jiomartProcessor');
const { getMonthNumber } = require('../../../utils/dateUtils');

const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx-js-style');

const OUTPUT_DIR = path.join(__dirname, '../../../../outputs');

/**
 * Ensure output directory exists
 */
async function ensureDir() {
    await fs.ensureDir(OUTPUT_DIR);
}

/**
 * Safe number conversion
 */
function safeNum(value) {
    if (value === null || value === undefined || value === '') return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
}

/**
 * Safe date conversion for DB
 */
function safeDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Upload SKU Master
 */
const uploadSkuMaster = async (req, res, next) => {
    try {
        const result = await salesService.uploadMasterData(
            req.params.brandId,
            req.params.agentId,
            'sku',
            req.file.buffer
        );
        res.json({ message: 'SKU Master uploaded successfully', ...result });
    } catch (error) {
        next(error);
    }
};

/**
 * Upload Ledger Master
 */
const uploadLedgerMaster = async (req, res, next) => {
    try {
        const result = await salesService.uploadMasterData(
            req.params.brandId,
            req.params.agentId,
            'ledger',
            req.file.buffer
        );
        res.json({ message: 'Ledger Master uploaded successfully', ...result });
    } catch (error) {
        next(error);
    }
};

/**
 * Get Master Data
 */
const getMasterData = async (req, res, next) => {
    try {
        const result = await salesService.getMasterData(
            req.params.brandId,
            req.params.agentId
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
};

/**
 * Map Processor Row to JioMart Database Schema
 */
const mapRowToJiomartSchema = (row, monthInt, year, filename, dateObj) => ({
    year: parseInt(year),
    month: monthInt,
    filename: filename,
    date: dateObj,

    // Seller & order info
    seller_gstin: String(row['Seller GSTIN'] || ''),
    order_id: String(row['Order ID'] || ''),
    order_item_id: String(row['Order Item ID'] || ''),
    order_type: String(row['Order Type'] || ''),

    order_date: safeDate(row['Order Date']),
    order_approval_date: safeDate(row['Order Approval Date']),

    type: String(row['Type'] || ''),

    // Shipment details
    shipment_number: String(row['Shipment Number'] || ''),
    original_shipment_number: String(row['Original Shipment Number'] || ''),
    fulfillment_type: String(row['Fulfillment Type'] || ''),
    fulfiller_name: String(row['Fulfiller Name'] || ''),

    // Product info
    product_name: String(row['Product Name'] || ''),
    product_id: String(row['Product ID'] || ''),
    sku: String(row['SKU'] || ''),
    fg: String(row['FG'] || ''),
    hsn_code: String(row['HSN Code'] || ''),

    // Order status
    order_status: String(row['Order Status'] || ''),
    event_type: String(row['Event Type'] || ''),
    event_sub_type: String(row['Event Sub Type'] || ''),

    // Quantity
    quantity: safeNum(row['Item Quantity']),

    // Invoice
    buyer_invoice_id: String(row['Buyer Invoice ID'] || ''),
    original_invoice_id: String(row['Original Invoice ID'] || ''),
    buyer_invoice_date: safeDate(row['Buyer Invoice Date']),
    tcs_date: safeDate(row['TCS Date']),

    buyer_invoice_amount: safeNum(row['Buyer Invoice Amount']),

    // Location
    shipped_from_state: String(row['Order Shipped From (State)'] || ''),
    billed_from_state: String(row['Billed From State'] || ''),
    billing_pincode: String(row['Customer\'s Billing Pincode'] || ''),
    billing_state: String(row['Customer\'s Billing State'] || ''),
    delivery_pincode: String(row['Customer\'s Delivery Pincode'] || ''),
    delivery_state: String(row['Customer\'s Delivery State'] || ''),

    // Pricing
    seller_coupon_code: String(row['Seller Coupon Code'] || ''),
    offer_price: safeNum(row['Offer Price']),
    seller_coupon_amount: safeNum(row['Seller Coupon Amount']),
    final_invoice_amount: safeNum(row['Final Invoice Amount']),

    tax_type: String(row['Tax Type'] || ''),
    taxable_value: safeNum(row['Taxable Value (Final Invoice Amount -Taxes)']),

    // GST
    igst_rate: safeNum(row['IGST Rate']),
    igst_amount: safeNum(row['IGST Amount']),
    cgst_rate: safeNum(row['CGST Rate']),
    cgst_amount: safeNum(row['CGST Amount']),
    sgst_rate: safeNum(row['SGST Rate (or UTGST as applicable)']),
    sgst_amount: safeNum(row['SGST Amount (Or UTGST as applicable)']),

    // TCS
    tcs_igst_rate: safeNum(row['TCS IGST Rate']),
    tcs_igst_amount: safeNum(row['TCS IGST Amount']),
    tcs_cgst_rate: safeNum(row['TCS CGST Rate']),
    tcs_cgst_amount: safeNum(row['TCS CGST Amount']),
    tcs_sgst_rate: safeNum(row['TCS SGST Rate']),
    tcs_sgst_amount: safeNum(row['TCS SGST Amount']),
    total_tcs_deducted: safeNum(row['Total TCS Deducted']),

    // TDS
    tds_rate: safeNum(row['TDS Rate']),
    tds_amount: safeNum(row['TDS Amount']),

    // Final GST
    final_gst_rate: safeNum(row['Final GST Rate'])
});

/**
 * Generate JioMart Working File
 */
const generate = async (req, res, next) => {
    try {
        const { brandId, agentId } = req.params;
        const { month, year, inventory_type } = req.body;
        const useInventory = inventory_type !== 'Without';

        // 1. Fetch Master Data
        const brand = await Brand.findByPk(brandId);
        const agent = await Agent.findByPk(agentId);
        if (!brand || !agent) return res.status(404).json({ error: 'Brand or Agent not found' });

        const masterData = await salesService.getMasterData(brandId, agentId);

        // 2. Get Raw File Buffer
        if (!req.file && (!req.files || !req.files.file)) {
            return res.status(400).json({ error: 'JioMart raw report file is required' });
        }
        const fileBuffer = req.file ? req.file.buffer : req.files.file[0].buffer;

        // Convert Excel Buffer to JSON for processor
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const rawJson = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

        // 3. Call Processor
        let sourceSheetData = [];
        if (useInventory && masterData.sku_master) {
            sourceSheetData = masterData.sku_master.map(sku => ({
                SKU: sku['Sales portal SKU'] || sku['Sales Portal SKU'] || sku['SKU'] || sku.salesPortalSku || sku.sku,
                FG: sku['Tally new SKU'] || sku['Tally New SKU'] || sku['Tally SKU'] || sku.tallyNewSku || sku.fg || sku.FG
            }));
        }

        const processedData = await jiomartProcessor(
            rawJson,
            sourceSheetData,
            brand.name,
            `${month}-${year}`,
            useInventory
        );

        // 4. Save to Database
        const brandDb = getBrandConnection(brand.db_name);
        const tableName = agent.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const Model = getDynamicModel(brandDb, tableName, agent.columns);

        await ensureDir();
        const id = uuidv4();
        const filename = `jiomart_${brand.name}_${month}_${year}_${id}.xlsx`;
        const filepath = path.join(OUTPUT_DIR, filename);

        const monthInt = getMonthNumber(month);
        const dateObj = new Date(year, monthInt - 1, 1);

        // Map processed rows for database storage
        const dbRows = processedData.processedData.map(row => 
            mapRowToJiomartSchema(row, monthInt, year, filename, dateObj)
        );

        await Model.sync();
        await Model.bulkCreate(dbRows);

        // 5. Save Excel File
        XLSX.writeFile(processedData.outputWorkbook, filepath);

        res.json({
            success: true,
            message: 'JioMart working file generated successfully',
            data: { filename, count: dbRows.length }
        });

    } catch (error) {
        console.error('JioMart Generation Error:', error);
        next(error);
    }
};

module.exports = {
    uploadSkuMaster,
    uploadLedgerMaster,
    getMasterData,
    generate
};
