const salesService = require('../../../services/salesService');
const { Brand, Agent } = require('../../../models/master');
const { getBrandConnection } = require('../../../config/database');
const { getDynamicModel } = require('../../../models/brand');

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

// ✅ Single Flipkart Processor
const { flipkartProcessor } = require('../../../services/processors/flipkart/flipkartProcessor');

const OUTPUT_DIR = path.join(__dirname, '../../../../outputs');
const { getMonthNumber } = require('../../../utils/dateUtils');

/**
 * Ensure output directory exists
 */
async function ensureDir() {
    await fs.ensureDir(OUTPUT_DIR);
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

        res.json({
            message: 'SKU Master uploaded successfully',
            ...result
        });
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

        res.json({
            message: 'Ledger Master uploaded successfully',
            ...result
        });
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
 * Generate Flipkart Working File
 */
const generate = async (req, res, next) => {
    try {
        const { brandId, agentId } = req.params;
        const { month, year, inventory_type } = req.body;

        // ✅ Validate
        if (!req.file) {
            return res.status(400).json({ error: 'File is required' });
        }

        if (!month || !year) {
            return res.status(400).json({ error: 'month and year are required' });
        }

        // ✅ Fetch brand & agent
        const brand = await Brand.findByPk(brandId);
        const agent = await Agent.findByPk(agentId);

        if (!brand || !agent) {
            return res.status(404).json({ error: 'Brand or Agent not found' });
        }

        // ✅ DB setup
        const brandDb = getBrandConnection(brand.db_name);
        const tableName = agent.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const Model = getDynamicModel(brandDb, tableName, agent.columns);

        const useInventory = inventory_type === 'With';

        // ✅ Get master data
        const masterData = await salesService.getMasterData(brandId, agentId);

        let sourceSheetData = [];
        if (useInventory && masterData.sku_master) {
            sourceSheetData = masterData.sku_master.map(sku => ({
                SKU: sku['Sales portal SKU'] || sku['Sales Portal SKU'] || sku['SKU'] || sku.salesPortalSku || sku.sku,
                FG: sku['Tally new SKU'] || sku['Tally New SKU'] || sku['Tally SKU'] || sku.tallyNewSku || sku.fg || sku.FG
            }));
        } else {
            sourceSheetData = masterData.sku_master;
        }

        // =====================================================
        // 🔥 SINGLE PROCESSOR
        // =====================================================
        const processedData = await flipkartProcessor(
            req.file.buffer,
            sourceSheetData,
            masterData.ledger_master,
            brand.name,
            new Date().toISOString(),
            useInventory
        );

        if (!processedData || !processedData.workingFileData) {
            return res.status(400).json({ error: 'Processor must return workingFileData' });
        }

        // =====================================================
        // ✅ FILE GENERATION
        // =====================================================
        await ensureDir();

        const fileId = uuidv4();
        const fileName = `flipkart_${brand.name}_${fileId}.xlsx`;
        const filePath = path.join(OUTPUT_DIR, fileName);

        // =====================================================
        // ✅ PREPARE DATA FOR DB
        // =====================================================
        const monthInt = getMonthNumber(month);
        const dateObj = new Date(year, monthInt - 1, 1);

        const finalData = processedData.workingFileData.map(row => ({
            // meta
            month: monthInt,
            year: parseInt(year),
            inventory_type,
            filename: fileName,
            date: dateObj,

            // seller info
            seller_gstin: row.seller_gstin,
            seller_state: row.seller_state,

            // order info
            order_id: row.order_id,
            order_item_id: row.order_item_id,
            order_type: row.order_type,
            event_type: row.event_type,
            event_sub_type: row.event_sub_type,
            order_date: row.order_date,
            order_approval_date: row.order_approval_date,

            // product
            sku: row.sku,
            fg: row.fg,
            fsn: row.fsn,
            item_description: row.product_title,
            hsn_code: row.hsn_code,
            quantity: row.item_quantity,

            // fulfillment
            fulfilment_type: row.fulfilment_type,
            warehouse_id: row.warehouse_id,
            ship_from_state: row.order_shipped_from_state,

            // pricing
            price_before_discount: row.price_before_discount,
            total_discount: row.total_discount,
            price_after_discount: row.price_after_discount,
            shipping_charges: row.shipping_charges,

            // final values
            final_taxable_sales_value: row.final_taxable_sales_value,
            final_shipping_taxable_value: row.final_shipping_taxable_value,
            final_invoice_amount: row.final_invoice_amount,

            // GST
            gst_rate: row.final_gst_rate,
            cgst_rate: row.cgst_rate,
            sgst_rate: row.sgst_rate,
            igst_rate: row.igst_rate,
            cgst_amount: row.cgst_amount,
            sgst_amount: row.sgst_amount,
            igst_amount: row.igst_amount,

            // final GST
            final_cgst_tax: row.final_cgst_taxable,
            final_sgst_tax: row.final_sgst_taxable,
            final_igst_tax: row.final_igst_taxable,

            // shipping tax
            shipping_cgst_tax: row.final_cgst_shipping,
            shipping_sgst_tax: row.final_sgst_shipping,
            shipping_igst_tax: row.final_igst_shipping,

            // TCS
            tcs_igst_amount: row.tcs_igst_amount,
            tcs_cgst_amount: row.tcs_cgst_amount,
            tcs_sgst_amount: row.tcs_sgst_amount,
            total_tcs: row.total_tcs_deducted,

            // TDS
            tds_rate: row.tds_rate,
            tds_amount: row.tds_amount,

            // invoice
            buyer_invoice_id: row.buyer_invoice_id,
            buyer_invoice_date: row.buyer_invoice_date,
            buyer_invoice_amount: row.buyer_invoice_amount,
            final_invoice_number: row.final_invoice_no,

            // customer
            billing_state: row.customer_billing_state,
            billing_pincode: row.customer_billing_pincode,
            shipping_state: row.customer_delivery_state,
            shipping_pincode: row.customer_delivery_pincode,

            // business
            business_name: row.business_name,
            business_gstin: row.business_gst_number,

            // extra
            is_shopsy_order: row.is_shopsy_order,
            tally_ledger: row.tally_ledgers,
            imei: row.imei
        }));

        // =====================================================
        // ✅ SAVE TO DB
        // =====================================================
        const resultRows = await Model.bulkCreate(finalData, { returning: true });
        const firstId = resultRows[0]?.id;

        // ==================================
        // 🔥 SAVE MULTI-SHEET EXCEL
        // ==================================
        const XLSX = require('xlsx');
        if (processedData.outputWorkbook) {
            XLSX.writeFile(processedData.outputWorkbook, filePath);
        } else {
            // Fallback if outputWorkbook is missing
            const workbook = new ExcelJS.Workbook();
            const sheet1 = workbook.addWorksheet('process1');
            const headers1 = Object.keys(processedData.process1Json[0] || {});
            sheet1.addRow(headers1);
            processedData.process1Json.forEach(row => {
                sheet1.addRow(headers1.map(h => row[h]));
            });
            await workbook.xlsx.writeFile(filePath);
        }

        // =====================================================
        // ✅ RESPONSE
        // =====================================================
        res.json({
            message: 'Flipkart working file generated successfully',
            count: finalData.length,
            file: fileName,
            fileId: firstId
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    uploadSkuMaster,
    uploadLedgerMaster,
    getMasterData,
    generate
};