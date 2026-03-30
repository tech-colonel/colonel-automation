const salesService = require('../../../services/salesService');
const { Brand, Agent } = require('../../../models/master');
const { getBrandConnection } = require('../../../config/database');
const { getDynamicModel } = require('../../../models/brand');

const { amazonB2BProcessor } = require('../../../services/processors/amazon/amazonB2BProcessor');
const { amazonB2CProcessor } = require('../../../services/processors/amazon/amazonB2CProcessor');

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');

const OUTPUT_DIR = path.join(__dirname, '../../../../outputs');

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
 * Generate Amazon Working File
 */

const mapRowToAmazonSchema = (row, fileType, useInventory) => ({
    type: fileType?.toUpperCase() || null,
    Inventory: useInventory ? 'With' : 'Without',

    Seller_Gstin: row['Seller Gstin'],
    Invoice_Number: row['Invoice Number'],
    Invoice_Date: row['Invoice Date'],
    Transaction_Type: row['Transaction Type'],
    Order_Id: row['Order Id'],
    Shipment_Id: row['Shipment Id'],
    Shipment_Date: row['Shipment Date'],
    Order_Date: row['Order Date'],
    Shipment_Item_Id: row['Shipment Item Id'],
    Quantity: row['Quantity'],
    Item_Description: row['Item Description'],
    Asin: row['Asin'],
    Hsn_Sac: row['Hsn Sac'],
    Sku: row['Sku'],
    FG: row['FG'],
    Product_Tax_Code: row['Product Tax Code'],

    Bill_From_City: row['Bill From City'],
    Bill_From_State: row['Bill From State'],
    Bill_From_Country: row['Bill From Country'],
    Bill_From_Postal_Code: row['Bill From Postal Code'],

    Ship_From_City: row['Ship From City'],
    Ship_From_State: row['Ship From State'],
    Ship_From_Country: row['Ship From Country'],
    Ship_From_Postal_Code: row['Ship From Postal Code'],

    Ship_To_City: row['Ship To City'],
    Ship_To_State: row['Ship To State'],
    Ship_To_State_Tally_Ledger: row['Ship To State Tally Ledger'],
    Final_Invoice_No: row['Final Invoice No'],
    Ship_To_Country: row['Ship To Country'],
    Ship_To_Postal_Code: row['Ship To Postal Code'],

    Invoice_Amount: row['Invoice Amount'],
    Tax_Exclusive_Gross: row['Tax Exclusive Gross'],
    Total_Tax_Amount: row['Total Tax Amount'],

    Cgst_Rate: row['Cgst Rate'],
    Sgst_Rate: row['Sgst Rate'],
    Utgst_Rate: row['Utgst Rate'],
    Igst_Rate: row['Igst Rate'],
    Compensatory_Cess_Rate: row['Compensatory Cess Rate'],

    Principal_Amount: row['Principal Amount'],
    Principal_Amount_Basis: row['Principal Amount Basis'],

    Cgst_Tax: row['Cgst Tax'],
    Sgst_Tax: row['Sgst Tax'],
    Utgst_Tax: row['Utgst Tax'],
    Igst_Tax: row['Igst Tax'],
    Compensatory_Cess_Tax: row['Compensatory Cess Tax'],

    Final_Tax_Rate: row['Final Tax Rate'],
    Final_Taxable_Sales_Value: row['Final Taxable Sales Value'],
    Final_Taxable_Shipping_Value: row['Final Taxable Shipping Value'],

    Final_CGST_Tax: row['Final CGST Tax'],
    Final_SGST_Tax: row['Final SGST Tax'],
    Final_IGST_Tax: row['Final IGST Tax'],

    Final_Shipping_CGST_Tax: row['Final Shipping CGST Tax'],
    Final_Shipping_SGST_Tax: row['Final Shipping SGST Tax'],
    Final_Shipping_IGST_Tax: row['Final Shipping IGST Tax'],

    Final_Amount_Receivable: row['Final Amount Receivable'],

    Shipping_Amount: row['Shipping Amount'],
    Shipping_Amount_Basis: row['Shipping Amount Basis'],

    Shipping_Cgst_Tax: row['Shipping Cgst Tax'],
    Shipping_Sgst_Tax: row['Shipping Sgst Tax'],
    Shipping_Utgst_Tax: row['Shipping Utgst Tax'],
    Shipping_Igst_Tax: row['Shipping Igst Tax'],
    Shipping_Cess_Tax: row['Shipping Cess Tax'],

    Gift_Wrap_Amount: row['Gift Wrap Amount'],
    Gift_Wrap_Amount_Basis: row['Gift Wrap Amount Basis'],

    Gift_Wrap_Cgst_Tax: row['Gift Wrap Cgst Tax'],
    Gift_Wrap_Sgst_Tax: row['Gift Wrap Sgst Tax'],
    Gift_Wrap_Utgst_Tax: row['Gift Wrap Utgst Tax'],
    Gift_Wrap_Igst_Tax: row['Gift Wrap Igst Tax'],
    Gift_Wrap_Compensatory_Cess_Tax: row['Gift Wrap Compensatory Cess Tax'],

    Item_Promo_Discount: row['Item Promo Discount'],
    Item_Promo_Discount_Basis: row['Item Promo Discount Basis'],
    Item_Promo_Tax: row['Item Promo Tax'],

    Shipping_Promo_Discount: row['Shipping Promo Discount'],
    Shipping_Promo_Discount_Basis: row['Shipping Promo Discount Basis'],
    Shipping_Promo_Tax: row['Shipping Promo Tax'],

    Gift_Wrap_Promo_Discount: row['Gift Wrap Promo Discount'],
    Gift_Wrap_Promo_Discount_Basis: row['Gift Wrap Promo Discount Basis'],
    Gift_Wrap_Promo_Tax: row['Gift Wrap Promo Tax'],

    Tcs_Cgst_Rate: row['Tcs Cgst Rate'],
    Tcs_Cgst_Amount: row['Tcs Cgst Amount'],
    Tcs_Sgst_Rate: row['Tcs Sgst Rate'],
    Tcs_Sgst_Amount: row['Tcs Sgst Amount'],
    Tcs_Utgst_Rate: row['Tcs Utgst Rate'],
    Tcs_Utgst_Amount: row['Tcs Utgst Amount'],
    Tcs_Igst_Rate: row['Tcs Igst Rate'],
    Tcs_Igst_Amount: row['Tcs Igst Amount'],

    Warehouse_Id: row['Warehouse Id'],
    Fulfillment_Channel: row['Fulfillment Channel'],
    Payment_Method_Code: row['Payment Method Code'],

    Bill_To_City: row['Bill To City'],
    Bill_To_State: row['Bill To State'],
    Bill_To_Country: row['Bill To Country'],
    Bill_To_Postalcode: row['Bill To Postalcode'],

    Customer_Bill_To_Gstid: row['Customer Bill To Gstid'],
    Customer_Ship_To_Gstid: row['Customer Ship To Gstid'],
    Buyer_Name: row['Buyer Name'],

    Credit_Note_No: row['Credit Note No'],
    Credit_Note_Date: row['Credit Note Date'],

    Irn_Number: row['Irn Number'],
    Irn_Filing_Status: row['Irn Filing Status'],
    Irn_Date: row['Irn Date'],
    Irn_Error_Code: row['Irn Error Code']
});

const generate = async (req, res, next) => {
    try {
        console.log('=== AMAZON GENERATE REQUEST ===');
        console.log('Body:', req.body);
        console.log('Params:', req.params);

        // =====================================================
        // ✅ INPUT NORMALIZATION (BASED ON YOUR PAYLOAD)
        // =====================================================
        const { brandId, agentId } = req.params;

        const month = req.body.month;
        const year = parseInt(req.body.year);

        const fileType = String(req.body.file_type || '').toLowerCase().trim();

        let useInventory = true;

        if (req.body.inventory_type) {
            const val = String(req.body.inventory_type).toLowerCase().trim();

            if (
                val === 'without' ||
                val === 'false' ||
                val === '0' ||
                val === 'no'
            ) {
                useInventory = false;
            }
        }

        console.log('Normalized:', { month, year, fileType, useInventory });

        // =====================================================
        // ✅ VALIDATION
        // =====================================================
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: 'File is required' });
        }

        if (!month || !year || !fileType) {
            return res.status(400).json({ error: 'month, year, file_type required' });
        }

        // =====================================================
        // ✅ FETCH BRAND + AGENT
        // =====================================================
        const brand = await Brand.findByPk(brandId);
        const agent = await Agent.findByPk(agentId);

        if (!brand || !agent) {
            return res.status(404).json({ error: 'Brand or Agent not found' });
        }

        const brandDb = getBrandConnection(brand.db_name);
        const tableName = agent.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const Model = getDynamicModel(brandDb, tableName, agent.columns);

        // =====================================================
        // ✅ MASTER DATA
        // =====================================================
        const masterData = await salesService.getMasterData(brandId, agentId);

        // =====================================================
        // ✅ SKU BUFFER (MACROS STYLE)
        // =====================================================
        let skuFileBuffer;
        let sourceSheetData = [];

        if (!useInventory) {
            console.log('WITHOUT INVENTORY MODE');

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet([]);
            XLSX.utils.book_append_sheet(wb, ws, 'Source');

            skuFileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        } else {
            console.log('WITH INVENTORY MODE');

            if (!masterData.sku_master || masterData.sku_master.length === 0) {
                return res.status(400).json({ error: 'No SKUs found' });
            }

            sourceSheetData = masterData.sku_master.map(sku => ({
                SKU: sku['Sales portal SKU'] || sku['SKU'] || sku.salesPortalSku || sku.sku,
                FG: sku['Tally new SKU'] || sku['Tally SKU'] || sku.tallyNewSku || sku.fg || sku.FG
            }));
            console.log("SKU ", masterData.sku_master);
            console.log("source sheet data", sourceSheetData);

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(sourceSheetData);
            XLSX.utils.book_append_sheet(wb, ws, 'Source');

            skuFileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        }

        // =====================================================
        // ✅ STATE CONFIG (OPTIONAL)
        // =====================================================
        let stateConfigData = null;

        if (masterData.ledger_master) {
            stateConfigData = masterData.ledger_master;
        }

        // =====================================================
        // 🔥 PROCESSOR CALL
        // =====================================================
        let processedData;

        try {
            if (fileType === 'b2b') {
                processedData = await amazonB2BProcessor(
                    req.file.buffer,
                    skuFileBuffer,
                    brand.name,
                    new Date().toISOString(),
                    sourceSheetData,
                    stateConfigData,
                    useInventory
                );
            } else if (fileType === 'b2c') {
                processedData = await amazonB2CProcessor(
                    req.file.buffer,
                    skuFileBuffer,
                    brand.name,
                    new Date().toISOString(),
                    sourceSheetData,
                    stateConfigData,
                    useInventory
                );
            } else {
                return res.status(400).json({ error: 'Invalid file_type' });
            }
        } catch (error) {
            if (error.missingSKUs) {
                return res.status(400).json({
                    error: 'Missing SKUs',
                    missingSKUs: error.missingSKUs
                });
            }
            throw error;
        }

        if (!processedData || !processedData.process1Json) {
            return res.status(400).json({ error: 'Invalid processor output' });
        }

        // =====================================================
        // ✅ FILE GENERATION
        // =====================================================
        await ensureDir();

        const id = uuidv4();

        const processFile = `amazon_${fileType}_${brand.name}_${id}.xlsx`;
        const processPath = path.join(OUTPUT_DIR, processFile);

        // ==================================
        // ✅ SAVE DB
        // ==================================
        const finalData = processedData.process1Json.map(row => ({
            ...mapRowToAmazonSchema(row, fileType, useInventory),

            month,
            year,
            file_type: fileType,
            inventory_type: useInventory ? 'With' : 'Without',
            filename: processFile
        }));

        const rows = await Model.bulkCreate(finalData, { returning: true });

        // ==================================
        // 🔥 USE PROCESSOR WORKBOOK (ALL SHEETS INCLUDED)
        // ==================================
        if (processedData.workbook) {
            await processedData.workbook.xlsx.writeFile(processPath);
        } else {
            throw new Error('Processor did not return workbook');
        }

        // ==================================
        // ✅ RESPONSE
        // ==================================
        res.json({
            success: true,
            message: 'Amazon working file generated successfully',
            data: {
                processFile,
                count: finalData.length
            }
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