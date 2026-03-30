const salesService = require('../services/salesService');
const { Brand, Agent } = require('../models/master');
const { getBrandConnection } = require('../config/database');
const { getDynamicModel } = require('../models/brand');
const path = require('path');
const fs = require('fs-extra');
const { amazonB2BProcessor } = require('../services/processors/amazon/amazonB2BProcessor');
const { amazonB2CProcessor } = require('../services/processors/amazon/amazonB2CProcessor');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');
const { QueryTypes } = require('sequelize');

const OUTPUT_DIR = path.join(__dirname, '../../outputs');

/**
 * Shared logic for working file management across all agents
 */
const getWorkingFiles = async (req, res, next) => {
  try {
    const { brandId, agentId } = req.params;

    const brand = await Brand.findByPk(brandId);
    const agent = await Agent.findByPk(agentId);

    if (!brand || !agent) {
      return res.status(404).json({ error: 'Brand or Agent not found' });
    }

    const brandDb = getBrandConnection(brand.db_name);
    const tableName = agent.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    const WorkingFileModel = getDynamicModel(
      brandDb,
      tableName,
      agent.columns
    );

    // ✅ Fetch all rows sorted (latest first)
    const rows = await WorkingFileModel.findAll({
      attributes: [
        'id',
        'filename',
        'month',
        'year',
        'file_type',
        'inventory_type',
        'created_at'
      ],
      order: [
        ['filename', 'ASC'],
        ['created_at', 'DESC']
      ],
      raw: true
    });

    // =====================================================
    // ✅ GROUP BY filename (keep latest)
    // =====================================================
    const uniqueFilesMap = new Map();

    for (const row of rows) {
      if (!uniqueFilesMap.has(row.filename)) {
        uniqueFilesMap.set(row.filename, row);
      }
    }

    const files = Array.from(uniqueFilesMap.values());

    res.json(files);

  } catch (error) {
    next(error);
  }
};

const deleteWorkingFile = async (req, res, next) => {
  try {
    const { brandId, agentId, fileId } = req.params;
    const brand = await Brand.findByPk(brandId);
    const agent = await Agent.findByPk(agentId);

    const brandDb = getBrandConnection(brand.db_name);
    const tableName = agent.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const WorkingFileModel = getDynamicModel(brandDb, tableName, agent.columns);

    const file = await WorkingFileModel.findByPk(fileId);
    if (file && file.filename) {
      const filePath = path.join(OUTPUT_DIR, file.filename);
      if (await fs.exists(filePath)) {
        await fs.unlink(filePath);
      }
      await file.destroy();
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const downloadWorkingFile = async (req, res, next) => {
  try {
    const { brandId, agentId, fileId } = req.params;
    const brand = await Brand.findByPk(brandId);
    const agent = await Agent.findByPk(agentId);

    const brandDb = getBrandConnection(brand.db_name);
    const tableName = agent.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const WorkingFileModel = getDynamicModel(brandDb, tableName, agent.columns);

    const file = await WorkingFileModel.findByPk(fileId);
    if (!file || !file.filename) return res.status(404).json({ error: 'File not found' });

    const filePath = path.join(OUTPUT_DIR, file.filename);
    if (!(await fs.pathExists(filePath))) return res.status(404).json({ error: 'File not found on disk' });

    res.download(filePath, file.filename);
  } catch (error) {
    next(error);
  }
};

// ensure dir
async function ensureDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}
ensureDir();
const amazon = {
  uploadSkuMaster: async (req, res, next) => {
    try {
      const result = await salesService.uploadMasterData(req.params.brandId, req.params.agentId, 'sku', req.file.buffer);
      res.json({ message: 'SKU Master uploaded successfully', ...result });
    } catch (error) { next(error); }
  },
  uploadLedgerMaster: async (req, res, next) => {
    try {
      const result = await salesService.uploadMasterData(req.params.brandId, req.params.agentId, 'ledger', req.file.buffer);
      res.json({ message: 'Ledger Master uploaded successfully', ...result });
    } catch (error) { next(error); }
  },
  getMasterData: async (req, res, next) => {
    try {
      const result = await salesService.getMasterData(req.params.brandId, req.params.agentId);
      res.json(result);
    } catch (error) { next(error); }
  },
  // generate: async (req, res, next) => {
  //   try {
  //     const result = await salesService.generateAmazonWorkingFile(req.params.brandId, req.params.agentId, req.body, req.file.buffer);
  //     res.json({ message: 'Working file generated successfully', ...result });
  //   } catch (error) { next(error); }
  // }


  generate: async (req, res, next) => {
    try {
      const brand = await Brand.findByPk(req.params.brandId);
      const agent = await Agent.findByPk(req.params.agentId);

      if (!brand || !agent) {
        return res.status(404).json({ error: 'Brand or Agent not found' });
      }

      const brandDb = getBrandConnection(brand.db_name);
      const tableName = agent.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const Model = getDynamicModel(brandDb, tableName, agent.columns);

      let processedData;
      const useInventory = req.body.inventory_type === 'With';

      // Fetch master data needed by processors
      const masterData = await salesService.getMasterData(req.params.brandId, req.params.agentId);

      // 🔥 PROCESSING
      if (req.body.file_type?.toLowerCase() === 'b2b') {
        processedData = await amazonB2BProcessor(
          req.file.buffer,
          null, // skuFileBuffer (already in masterData)
          brand.name,
          new Date().toISOString(), // Use current date for invoice month logic
          masterData.sku_master,
          masterData.ledger_master,
          useInventory
        );
      } else if (req.body.file_type?.toLowerCase() === 'b2c') {
        processedData = await amazonB2CProcessor(
          req.file.buffer,
          null,
          brand.name,
          new Date().toISOString(),
          masterData.sku_master,
          masterData.ledger_master,
          useInventory
        );
      } else {
        return res.status(400).json({ error: 'Invalid type. Use b2b or b2c' });
      }

      if (!processedData || !processedData.process1Json) {
        return res.status(400).json({ error: 'Processor must return array of JSON' });
      }

      // ✅ UNIQUE FILE NAME (MACROS STYLE)
      const fileId = uuidv4();
      const fileName = `amazon_${req.body.file_type}_${brand.name}_${fileId}.xlsx`;
      const filePath = path.join(OUTPUT_DIR, fileName);
      await fs.ensureDir(OUTPUT_DIR);

      // ✅ FINAL DATA (FOR DB)
      const finalData = processedData.process1Json.map(row => ({
        ...row,
        month: req.body.month,
        year: req.body.year,
        file_type: req.body.file_type,
        inventory_type: req.body.inventory_type,
        filename: fileName
      }));

      // ✅ SAVE DB
      const resultRows = await Model.bulkCreate(finalData, { returning: true });
      const firstId = resultRows[0]?.id;

      // =====================================================
      // 🔥 MULTI-SHEET EXCEL GENERATION (LIKE MACROS)
      // =====================================================

      const workbook = new ExcelJS.Workbook();
      // ... (Rest of Excel generation)
      const sheet1 = workbook.addWorksheet('process1');
      const headers1 = Object.keys(processedData.process1Json[0] || {});
      sheet1.addRow(headers1);
      processedData.process1Json.forEach(row => {
        sheet1.addRow(headers1.map(h => row[h]));
      });

      if (processedData.pivotData && processedData.pivotData.length > 0) {
        const sheet2 = workbook.addWorksheet('pivot');
        const headers2 = Object.keys(processedData.pivotData[0]);
        sheet2.addRow(headers2);
        processedData.pivotData.forEach(row => {
          sheet2.addRow(headers2.map(h => row[h]));
        });
      }

      await workbook.xlsx.writeFile(filePath);

      res.json({
        message: 'Amazon working file generated successfully',
        count: finalData.length,
        file: fileName,
        fileId: firstId
      });

    } catch (error) {
      next(error);
    }
  }
};

const flipkart = {
  uploadSkuMaster: async (req, res, next) => {
    try {
      const result = await salesService.uploadMasterData(req.params.brandId, req.params.agentId, 'sku', req.file.buffer);
      res.json({ message: 'SKU Master uploaded successfully', ...result });
    } catch (error) { next(error); }
  },
  uploadLedgerMaster: async (req, res, next) => {
    try {
      const result = await salesService.uploadMasterData(req.params.brandId, req.params.agentId, 'ledger', req.file.buffer);
      res.json({ message: 'Ledger Master uploaded successfully', ...result });
    } catch (error) { next(error); }
  },
  getMasterData: async (req, res, next) => {
    try {
      const result = await salesService.getMasterData(req.params.brandId, req.params.agentId);
      res.json(result);
    } catch (error) { next(error); }
  },
  generate: async (req, res, next) => {
    try {
      const result = await salesService.generateFlipkartWorkingFile(req.params.brandId, req.params.agentId, req.body, req.file.buffer);
      res.json({ message: 'Working file generated successfully', ...result });
    } catch (error) { next(error); }
  }
};

module.exports = {
  amazon,
  flipkart,
  getWorkingFiles,
  deleteWorkingFile,
  downloadWorkingFile
};
