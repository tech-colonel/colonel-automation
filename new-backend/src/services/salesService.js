const xlsx = require('xlsx');
const XLSX_STYLE = require('xlsx-js-style');
const path = require('path');
const fs = require('fs-extra');
const { getBrandConnection } = require('../config/database');
const { getBrandAgentModel, getDynamicModel } = require('../models/brand');
const { Brand, Agent } = require('../models/master');

// Import processors
const { processMacros: processAmazonB2C } = require('./processors/macrosProcessorB2C');
const { processMacrosB2B: processAmazonB2B } = require('./processors/macrosProcessorB2B');

/**
 * Upload SKU or Ledger master for a brand-agent
 */
const uploadMasterData = async (brandId, agentId, type, fileBuffer) => {
  const brand = await Brand.findByPk(brandId);
  if (!brand) throw new Error('Brand not found');

  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const brandDb = getBrandConnection(brand.db_name);
  const BrandAgentModel = getBrandAgentModel(brandDb);

  const [brandAgent] = await BrandAgentModel.findOrCreate({
    where: { brand_id: brandId, agent_id: agentId }
  });

  const updateData = {};
  if (type === 'sku') updateData.sku_master = data;
  else if (type === 'ledger') updateData.ledger_master = data;

  await brandAgent.update(updateData);
  return { count: data.length };
};

/**
 * Get master data for a brand-agent
 */
const getMasterData = async (brandId, agentId) => {
  const brand = await Brand.findByPk(brandId);
  if (!brand) throw new Error('Brand not found');

  const brandDb = getBrandConnection(brand.db_name);
  const BrandAgentModel = getBrandAgentModel(brandDb);

  const [brandAgent] = await BrandAgentModel.findOrCreate({
    where: { brand_id: brandId, agent_id: agentId }
  });

  return {
    sku_master: brandAgent.sku_master || [],
    ledger_master: brandAgent.ledger_master || []
  };
};

/**
 * Generate working file for Amazon
 */
const generateAmazonWorkingFile = async (brandId, agentId, options, fileBuffer) => {
  const { month, year, file_type, inventory_type } = options;
  
  const brand = await Brand.findByPk(brandId);
  const agent = await Agent.findByPk(agentId);
  if (!brand || !agent) throw new Error('Brand or Agent not found');

  const brandDb = getBrandConnection(brand.db_name);
  const BrandAgentModel = getBrandAgentModel(brandDb);

  const [brandAgent] = await BrandAgentModel.findOrCreate({
    where: { brand_id: brandId, agent_id: agentId }
  });

  if (!brandAgent.sku_master || !brandAgent.ledger_master) {
    throw new Error('Master data (SKU/Ledger) missing. Please upload them first.');
  }

  const useInventory = inventory_type === 'With';
  const dateString = `${year}-${month}-01`;

  let result;
  if (file_type === 'B2B') {
    result = await processAmazonB2B(
      fileBuffer,
      null,
      brand.name,
      dateString,
      brandAgent.sku_master,
      brandAgent.ledger_master,
      useInventory
    );
  } else {
    result = await processAmazonB2C(
      fileBuffer,
      null,
      brand.name,
      dateString,
      brandAgent.sku_master,
      brandAgent.ledger_master,
      useInventory
    );
  }

  // Save the output file
  const outputBuffer = XLSX_STYLE.write(result.outputWorkbook, {
    type: 'buffer',
    bookType: 'xlsx'
  });

  const timestamp = Date.now();
  const filename = `${brand.name}_Amazon_${file_type}_${month}_${year}_${timestamp}.xlsx`;
  const outputPath = path.join(__dirname, '../../outputs', filename);

  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, outputBuffer);

  // Record in dynamic table
  const tableName = agent.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const WorkingFileModel = getDynamicModel(brandDb, tableName, agent.columns);

  const workingFile = await WorkingFileModel.create({
    month,
    year,
    file_type,
    inventory_type,
    filename
  });

  return {
    fileId: workingFile.id,
    filename,
    recordCount: result.pivotData?.length || 0
  };
};

/**
 * Generate working file for Flipkart
 */
const generateFlipkartWorkingFile = async (brandId, agentId, options, fileBuffer) => {
  const { month, year, inventory_type } = options;
  
  const brand = await Brand.findByPk(brandId);
  const agent = await Agent.findByPk(agentId);
  if (!brand || !agent) throw new Error('Brand or Agent not found');

  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const salesData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const brandDb = getBrandConnection(brand.db_name);
  const BrandAgentModel = getBrandAgentModel(brandDb);

  const [brandAgent] = await BrandAgentModel.findOrCreate({
    where: { brand_id: brandId, agent_id: agentId }
  });

  if (!brandAgent.sku_master || !brandAgent.ledger_master) {
    throw new Error('Master data (SKU/Ledger) missing. Please upload them first.');
  }

  // Simple mapping logic for Flipkart
  const processedData = salesData.map(row => {
    const skuMatch = brandAgent.sku_master.find(
      sku => (sku['Sales Portal SKU'] || sku['SKU']) === row['SKU']
    );
    
    const ledgerMatch = brandAgent.ledger_master.find(
      ledger => ledger['State'] === row['State']
    );

    return {
      ...row,
      'Tally New SKU': skuMatch ? (skuMatch['Tally New SKU'] || skuMatch['Tally SKU']) : '',
      'Ledger': ledgerMatch ? ledgerMatch['Ledger'] : '',
      'Invoice No': ledgerMatch ? (ledgerMatch['Invoice No.'] || ledgerMatch['Invoice No']) : ''
    };
  });

  // Create workbook and write to file
  const worksheet = xlsx.utils.json_to_sheet(processedData);
  const outputWorkbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(outputWorkbook, worksheet, 'Processed');

  const outputBuffer = xlsx.write(outputWorkbook, { type: 'buffer', bookType: 'xlsx' });

  const timestamp = Date.now();
  const filename = `${brand.name}_Flipkart_${month}_${year}_${timestamp}.xlsx`;
  const outputPath = path.join(__dirname, '../../outputs', filename);

  await fs.ensureDir(path.dirname(outputPath));
  await fs.writeFile(outputPath, outputBuffer);

  // Record in dynamic table
  const tableName = agent.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  const WorkingFileModel = getDynamicModel(brandDb, tableName, agent.columns);

  const workingFile = await WorkingFileModel.create({
    month,
    year,
    inventory_type,
    filename
  });

  return {
    fileId: workingFile.id,
    filename,
    recordCount: processedData.length
  };
};

module.exports = {
  uploadMasterData,
  getMasterData,
  generateAmazonWorkingFile,
  generateFlipkartWorkingFile
};
