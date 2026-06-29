const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { AgentWorkflow, Agent, Brand, BrandAgent } = require('../models/master');
const { getBrandConnection } = require('../config/database');
const { getBrandAgentModel } = require('../models/brand');

const upload = multer({ storage: multer.memoryStorage() });

// ─── Formula Evaluator ────────────────────────────────────────────────────────

function evaluateFormula(formula, scope) {
  try {
    let expr = formula.replace(/\{([^}]+)\}/g, (_, colRef) => {
      const val = scope[colRef];
      if (val === null || val === undefined || val === '') return '0';
      const num = parseFloat(String(val).replace(/,/g, ''));
      if (!isNaN(num)) return String(num);
      return `"${String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    });

    expr = expr.replace(
      /\bIF\s*\(([^,()]+(?:\([^()]*\)[^,()]*)*)\s*,\s*([^,()]+(?:\([^()]*\)[^,()]*)*)\s*,\s*([^()]+(?:\([^()]*\)[^()]*)*)\)/gi,
      '(($1) ? ($2) : ($3))'
    );

    // eslint-disable-next-line no-new-func
    const result = new Function('"use strict"; return (' + expr + ');')();
    if (result === null || result === undefined || (typeof result === 'number' && isNaN(result))) return '';
    return result;
  } catch {
    return '';
  }
}

// ─── Excel Formula Evaluator (cross-row: SUMIF, VLOOKUP, etc.) ───────────────

function evaluateFormulaWithHelpers(formula, rowScope, allRows) {
  try {
    // Replace {ColumnName} with current row values
    let expr = formula.replace(/\{([^}]+)\}/g, (_, colRef) => {
      const val = rowScope[colRef];
      if (val === null || val === undefined || val === '') return '0';
      const num = parseFloat(String(val).replace(/,/g, ''));
      if (!isNaN(num)) return String(num);
      return `"${String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    });

    // IF() → ternary (word-boundary \b prevents matching SUMIF / COUNTIF)
    expr = expr.replace(
      /\bIF\s*\(([^,()]+(?:\([^()]*\)[^,()]*)*)\s*,\s*([^,()]+(?:\([^()]*\)[^,()]*)*)\s*,\s*([^()]+(?:\([^()]*\)[^()]*)*)\)/gi,
      '(($1) ? ($2) : ($3))'
    );

    const toNum = v => {
      const n = parseFloat(String(v === null || v === undefined ? '' : v).replace(/,/g, ''));
      return isNaN(n) ? null : n;
    };
    const cmp = v => String(v === null || v === undefined ? '' : v).trim().toLowerCase();

    /* ── injected helpers — column args are plain column-name strings ── */

    const SUMIF = (rangeCol, criteria, sumCol) => {
      const crit = cmp(criteria);
      return allRows.reduce((acc, r) => {
        if (cmp(r[rangeCol]) === crit) { const n = toNum(r[sumCol]); if (n !== null) acc += n; }
        return acc;
      }, 0);
    };

    const SUMIFS = (sumCol, ...pairs) => {
      const conds = [];
      for (let i = 0; i + 1 < pairs.length; i += 2) conds.push({ col: String(pairs[i]), val: cmp(pairs[i + 1]) });
      return allRows.reduce((acc, r) => {
        if (conds.every(c => cmp(r[c.col]) === c.val)) { const n = toNum(r[sumCol]); if (n !== null) acc += n; }
        return acc;
      }, 0);
    };

    const COUNTIF = (rangeCol, criteria) => {
      const crit = cmp(criteria);
      return allRows.filter(r => cmp(r[rangeCol]) === crit).length;
    };

    const COUNTIFS = (...pairs) => {
      const conds = [];
      for (let i = 0; i + 1 < pairs.length; i += 2) conds.push({ col: String(pairs[i]), val: cmp(pairs[i + 1]) });
      return allRows.filter(r => conds.every(c => cmp(r[c.col]) === c.val)).length;
    };

    const AVERAGEIF = (rangeCol, criteria, avgCol) => {
      const crit = cmp(criteria);
      const nums = allRows.filter(r => cmp(r[rangeCol]) === crit).map(r => toNum(r[avgCol])).filter(n => n !== null);
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : '';
    };

    const VLOOKUP = (lookupVal, lookupCol, returnCol) => {
      const lv = cmp(lookupVal);
      const found = allRows.find(r => cmp(r[lookupCol]) === lv);
      return found ? (found[returnCol] ?? '') : '';
    };

    const MAXIF = (rangeCol, criteria, maxCol) => {
      const nums = allRows.filter(r => cmp(r[rangeCol]) === cmp(criteria)).map(r => toNum(r[maxCol])).filter(n => n !== null);
      return nums.length ? Math.max(...nums) : '';
    };

    const MINIF = (rangeCol, criteria, minCol) => {
      const nums = allRows.filter(r => cmp(r[rangeCol]) === cmp(criteria)).map(r => toNum(r[minCol])).filter(n => n !== null);
      return nums.length ? Math.min(...nums) : '';
    };

    // eslint-disable-next-line no-new-func
    const result = new Function(
      'SUMIF', 'SUMIFS', 'COUNTIF', 'COUNTIFS', 'AVERAGEIF', 'VLOOKUP', 'MAXIF', 'MINIF',
      '"use strict"; return (' + expr + ');'
    )(SUMIF, SUMIFS, COUNTIF, COUNTIFS, AVERAGEIF, VLOOKUP, MAXIF, MINIF);

    if (result === null || result === undefined || (typeof result === 'number' && isNaN(result))) return '';
    return result;
  } catch {
    return '';
  }
}

// ─── Row Filters ──────────────────────────────────────────────────────────────

function testFilter(row, filter) {
  const rawVal = row[filter.column];
  const cellStr = String(rawVal === null || rawVal === undefined ? '' : rawVal).trim();
  const filterVal = String(filter.value || '').trim();

  switch (filter.operator) {
    case 'equals':
      return cellStr.toLowerCase() === filterVal.toLowerCase();
    case 'not_equals':
      return cellStr.toLowerCase() !== filterVal.toLowerCase();
    case 'contains':
      return cellStr.toLowerCase().includes(filterVal.toLowerCase());
    case 'not_contains':
      return !cellStr.toLowerCase().includes(filterVal.toLowerCase());
    case 'gt': {
      const n = parseFloat(cellStr.replace(/,/g, ''));
      const nf = parseFloat(filterVal.replace(/,/g, ''));
      return !isNaN(n) && !isNaN(nf) && n > nf;
    }
    case 'lt': {
      const n = parseFloat(cellStr.replace(/,/g, ''));
      const nf = parseFloat(filterVal.replace(/,/g, ''));
      return !isNaN(n) && !isNaN(nf) && n < nf;
    }
    case 'is_empty':
      return cellStr === '';
    case 'is_not_empty':
      return cellStr !== '';
    default:
      return true;
  }
}

function applyFilters(rows, filters) {
  if (!filters || filters.length === 0) return rows;
  return rows.filter(row => filters.every(f => testFilter(row, f)));
}

// ─── Master Data Lookup ───────────────────────────────────────────────────────

function resolveMasterLookup(col, row, masterData) {
  const { masterType, lookupColumn, matchField, returnField } = col;
  const lookupValue = String(row[lookupColumn] || '').trim().toLowerCase();
  if (!lookupValue) return '';

  const master = masterType === 'sku'
    ? (masterData.sku_master || [])
    : (masterData.ledger_master || []);

  const keyField = masterType === 'sku' ? (matchField || 'salesPortalSku') : (matchField || '');

  const match = master.find(entry => {
    const entryVal = String(entry[keyField] || '').trim().toLowerCase();
    return entryVal === lookupValue;
  });

  if (!match) return '';
  return match[returnField] !== undefined ? match[returnField] : '';
}

// ─── File Header Extraction ───────────────────────────────────────────────────

function extractHeadersFromBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  for (const row of rows) {
    const headers = row.map(h => String(h || '').trim()).filter(h => h !== '');
    if (headers.length > 0) return headers;
  }
  return [];
}

// ─── Group By / Aggregation ───────────────────────────────────────────────────

function aggregate(values, method) {
  const nums = values
    .map(v => parseFloat(String(v === null || v === undefined ? '' : v).replace(/,/g, '')))
    .filter(n => !isNaN(n));
  switch (method) {
    case 'sum':    return nums.reduce((a, b) => a + b, 0);
    case 'avg':    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : '';
    case 'count':  return values.length;
    case 'min':    return nums.length ? Math.min(...nums) : '';
    case 'max':    return nums.length ? Math.max(...nums) : '';
    case 'first':  return values[0] ?? '';
    case 'last':   return values[values.length - 1] ?? '';
    case 'concat': return values.filter(v => v !== '' && v !== null && v !== undefined).join(', ');
    default:       return values[0] ?? '';
  }
}

function applyGroupBy(outputRows, groupByConfig) {
  if (!groupByConfig?.enabled || !groupByConfig.columns?.length || !outputRows.length) return outputRows;

  const groupColumns  = groupByConfig.columns;
  const aggregations  = groupByConfig.aggregations || {};
  const allColLabels  = Object.keys(outputRows[0]);
  const nonGroupLabels = allColLabels.filter(l => !groupColumns.includes(l));

  const groupMap = new Map();
  for (const row of outputRows) {
    const key = groupColumns.map(c => String(row[c] ?? '')).join('\x00');
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key).push(row);
  }

  return Array.from(groupMap.values()).map(groupRows => {
    const result = {};
    for (const col of groupColumns)    result[col] = groupRows[0][col];
    for (const col of nonGroupLabels)  result[col] = aggregate(groupRows.map(r => r[col]), aggregations[col] || 'sum');
    return result;
  });
}

// ─── Multi-Sheet Workflow Apply ───────────────────────────────────────────────

function applyMultiSheetWorkflow(sheets, fileBuffer, masterData = {}) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true, raw: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const allRawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

  const outBook   = XLSX.utils.book_new();
  const sheetResults = []; // sheetResults[i] = allRowsData after full evaluation

  for (let sheetIdx = 0; sheetIdx < sheets.length; sheetIdx++) {
    const wfSheet    = sheets[sheetIdx];
    const rawRows    = applyFilters(allRawRows, wfSheet.filters || []);
    const orderedCols = [...(wfSheet.columns || [])].sort((a, b) => a.order - b.order);

    // ── Pass 1: seed source + master + cross-sheet refs for ALL rows ──────────
    const allRowsData = rawRows.map((rawRow, rowIdx) => {
      const row = {};
      // cross-sheet refs
      for (let prevIdx = 0; prevIdx < sheetIdx; prevIdx++) {
        const prevSheet  = sheets[prevIdx];
        const prevRowData = sheetResults[prevIdx]?.[rowIdx] || {};
        for (const [label, value] of Object.entries(prevRowData)) {
          row[`${prevSheet.name}.${label}`] = value;
        }
      }
      // source + master columns
      for (const col of orderedCols) {
        if (col.type === 'source') {
          row[col.label] = rawRow[col.key] !== undefined ? rawRow[col.key] : '';
        } else if (col.type === 'master_lookup') {
          row[col.label] = resolveMasterLookup(col, rawRow, masterData);
        }
      }
      return row;
    });

    // ── Pass 2: evaluate derived columns in order, updating allRowsData ───────
    // Each column is computed for ALL rows before moving to the next, so
    // SUMIF / VLOOKUP always see a consistent snapshot of already-evaluated cols.
    for (const col of orderedCols) {
      if (col.type !== 'computed' && col.type !== 'excel') continue;

      const vals = allRowsData.map(rowScope =>
        col.type === 'excel'
          ? evaluateFormulaWithHelpers(col.formula || '', rowScope, allRowsData)
          : evaluateFormula(col.formula || '', rowScope)
      );
      vals.forEach((v, i) => { allRowsData[i][col.label] = v; });
    }

    // ── Build ordered output rows ─────────────────────────────────────────────
    const outputRows = allRowsData.map(row => {
      const out = {};
      for (const col of orderedCols) out[col.label] = row[col.label] ?? '';
      return out;
    });

    sheetResults.push(allRowsData); // preserve for cross-sheet refs (pre-grouped)

    const finalRows = applyGroupBy(outputRows, wfSheet.groupBy);
    const safeSheetName = (wfSheet.name || `Sheet${sheetIdx + 1}`)
      .replace(/[:\\/?*[\]]/g, '').slice(0, 31);

    XLSX.utils.book_append_sheet(outBook, XLSX.utils.json_to_sheet(finalRows), safeSheetName);
  }

  return XLSX.write(outBook, { type: 'buffer', bookType: 'xlsx' });
}

function applyLegacyWorkflow(columns, fileBuffer) {
  return applyMultiSheetWorkflow(
    [{ id: 'default', name: 'Output', filters: [], columns }],
    fileBuffer,
    {}
  );
}

// ─── Fetch Brand Master Data ──────────────────────────────────────────────────

async function fetchMasterData(brandId, agentId) {
  if (!brandId || !agentId) return { sku_master: [], ledger_master: [] };
  try {
    const brand = await Brand.findByPk(brandId);
    if (!brand) {
      console.log(`[workflow] fetchMasterData: brand ${brandId} not found`);
      return { sku_master: [], ledger_master: [] };
    }

    const brandDb = getBrandConnection(brand.db_name);
    const BrandAgentModel = getBrandAgentModel(brandDb);

    // Use findOrCreate consistent with salesService — creates an empty record if none exists
    const [record] = await BrandAgentModel.findOrCreate({
      where: { brand_id: brandId, agent_id: agentId }
    });

    console.log(`[workflow] fetchMasterData: sku=${record.sku_master?.length ?? 0} ledger=${record.ledger_master?.length ?? 0}`);

    return {
      sku_master:    record.sku_master    || [],
      ledger_master: record.ledger_master || []
    };
  } catch (err) {
    console.error('[workflow] fetchMasterData error:', err.message);
    return { sku_master: [], ledger_master: [] };
  }
}

// Returns the set of field names found in sku_master / ledger_master across all brands for an agent
async function scanMasterSchema(agentId) {
  const skuFields    = new Set();
  const ledgerFields = new Set();

  try {
    const brandAgents = await BrandAgent.findAll({ where: { agent_id: agentId } });
    for (const ba of brandAgents) {
      if (skuFields.size > 0 && ledgerFields.size > 0) break; // found enough
      const brand = await Brand.findByPk(ba.brand_id);
      if (!brand) continue;
      try {
        const brandDb = getBrandConnection(brand.db_name);
        const BrandAgentModel = getBrandAgentModel(brandDb);
        const [record] = await BrandAgentModel.findOrCreate({
          where: { brand_id: ba.brand_id, agent_id: agentId }
        });
        if (record.sku_master?.length)    Object.keys(record.sku_master[0]).forEach(k => skuFields.add(k));
        if (record.ledger_master?.length) Object.keys(record.ledger_master[0]).forEach(k => ledgerFields.add(k));
      } catch { continue; }
    }
  } catch (err) {
    console.error('[workflow] scanMasterSchema error:', err.message);
  }

  return { sku: Array.from(skuFields), ledger: Array.from(ledgerFields) };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

const getWorkflows = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const workflows = await AgentWorkflow.findAll({
      where: { agent_id: agentId },
      order: [['createdAt', 'ASC']]
    });
    res.json(workflows);
  } catch (error) {
    next(error);
  }
};

const getWorkflow = async (req, res, next) => {
  try {
    const { workflowId } = req.params;
    const workflow = await AgentWorkflow.findByPk(workflowId);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    res.json(workflow);
  } catch (error) {
    next(error);
  }
};

const createWorkflow = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const { name, description, sample_columns, sheets } = req.body;

    const agent = await Agent.findByPk(agentId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Workflow name is required' });
    if (!sheets || sheets.length === 0) return res.status(400).json({ error: 'At least one sheet is required' });

    const workflow = await AgentWorkflow.create({
      agent_id:       agentId,
      name:           name.trim(),
      description:    description || '',
      sample_columns: sample_columns || [],
      sheets:         sheets || [],
      columns:        []
    });

    res.status(201).json({ message: 'Workflow created', workflow });
  } catch (error) {
    next(error);
  }
};

const updateWorkflow = async (req, res, next) => {
  try {
    const { workflowId } = req.params;
    const { name, description, sample_columns, sheets } = req.body;

    const workflow = await AgentWorkflow.findByPk(workflowId);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

    await workflow.update({
      ...(name           !== undefined && { name: name.trim() }),
      ...(description    !== undefined && { description }),
      ...(sample_columns !== undefined && { sample_columns }),
      ...(sheets         !== undefined && { sheets })
    });

    res.json({ message: 'Workflow updated', workflow });
  } catch (error) {
    next(error);
  }
};

const deleteWorkflow = async (req, res, next) => {
  try {
    const { workflowId } = req.params;
    const workflow = await AgentWorkflow.findByPk(workflowId);
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    await workflow.destroy();
    res.json({ message: 'Workflow deleted' });
  } catch (error) {
    next(error);
  }
};

const extractColumns = [
  upload.single('file'),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const headers = extractHeadersFromBuffer(req.file.buffer);
      if (headers.length === 0) return res.status(400).json({ error: 'Could not extract columns from file' });
      res.json({ columns: headers });
    } catch (error) {
      next(error);
    }
  }
];

const applyWorkflow = [
  upload.single('file'),
  async (req, res, next) => {
    try {
      const { workflowId } = req.params;
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const workflow = await AgentWorkflow.findByPk(workflowId);
      if (!workflow) return res.status(404).json({ error: 'Workflow not found' });

      // Fetch master data if brand/agent context provided
      const brandId = req.body.brandId;
      const agentId = req.body.agentId;
      const masterData = await fetchMasterData(brandId, agentId);

      let outputBuffer;
      if (workflow.sheets && workflow.sheets.length > 0) {
        outputBuffer = applyMultiSheetWorkflow(workflow.sheets, req.file.buffer, masterData);
      } else if (workflow.columns && workflow.columns.length > 0) {
        outputBuffer = applyLegacyWorkflow(workflow.columns, req.file.buffer);
      } else {
        return res.status(400).json({ error: 'Workflow has no sheets defined' });
      }

      const outputDir = path.join(__dirname, '../../outputs');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const filename = `workflow_${workflow.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, outputBuffer);

      res.json({ message: 'Workflow applied successfully', filename });
    } catch (error) {
      next(error);
    }
  }
];

const getMasterSchema = async (req, res, next) => {
  try {
    const { agentId } = req.params;
    const schema = await scanMasterSchema(agentId);
    res.json(schema);
  } catch (error) {
    next(error);
  }
};

const downloadWorkflowOutput = async (req, res, next) => {
  try {
    const { filename } = req.params;
    if (!/^[\w\-. ]+\.xlsx$/.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const filepath = path.join(__dirname, '../../outputs', filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
    res.download(filepath, filename);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  extractColumns,
  applyWorkflow,
  downloadWorkflowOutput,
  getMasterSchema
};
