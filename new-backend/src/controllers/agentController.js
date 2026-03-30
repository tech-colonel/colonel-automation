const { Agent, Brand, BrandAgent } = require('../models/master');
const { getBrandConnection } = require('../config/database');
const { getBrandAgentModel, getDynamicModel } = require('../models/brand');

/**
 * Create a new agent type (Admin only)
 */
const createAgent = async (req, res, next) => {
  try {
    const { name, description, columns } = req.body;

    const existingAgent = await Agent.findOne({ where: { name } });
    if (existingAgent) {
      return res.status(400).json({ error: 'Agent already exists' });
    }

    const agent = await Agent.create({
      name,
      description,
      columns
    });

    res.status(201).json({
      message: 'Agent created successfully',
      agent
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all available agents
 */
const getAllAgents = async (req, res, next) => {
  try {
    const agents = await Agent.findAll({ order: [['createdAt', 'DESC']] });
    res.json(agents);
  } catch (error) {
    next(error);
  }
};

/**
 * Assign an agent to a brand
 * This involves creating the brand-agent link in Master DB
 * and initializing the agent's tables in the Brand DB
 */
const assignAgentToBrand = async (req, res, next) => {
  try {
    const { brand_id, agent_id } = req.body;

    const brand = await Brand.findByPk(brand_id);
    const agent = await Agent.findByPk(agent_id);

    if (!brand || !agent) {
      return res.status(404).json({ error: 'Brand or Agent not found' });
    }

    // 1. Create relation in Master DB
    console.log('[DEBUG] Assigning Agent:', { brand_id, agent_id });
    await BrandAgent.findOrCreate({ where: { brand_id, agent_id } });

    // 2. Initialize tables in Brand DB
    const brandDb = getBrandConnection(brand.db_name);
    
    // Core brand_agents table for this brand
    const BrandAgentModel = getBrandAgentModel(brandDb);

    // Dynamic table for this specific agent's processed files
    const tableName = agent.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    getDynamicModel(brandDb, tableName, agent.columns);

    await brandDb.sync();

    // 3. Initialize the agent record in Brand DB
    await BrandAgentModel.findOrCreate({
      where: { brand_id, agent_id }
    });

    res.json({ message: 'Agent assigned to brand successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get agents assigned to a specific brand
 */
const getBrandAgents = async (req, res, next) => {
  try {
    const brand = await Brand.findByPk(req.params.brandId, {
      include: [{ model: Agent, through: { attributes: [] } }]
    });

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    res.json(brand.Agents || []);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAgent,
  getAllAgents,
  assignAgentToBrand,
  getBrandAgents
};
