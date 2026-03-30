const { Brand, BrandUser, User, Agent } = require('../models/master');
const { getBrandConnection, createBrandDatabase } = require('../config/database');
const { getBrandAgentModel } = require('../models/brand');

/**
 * Create a new brand and its dedicated database
 */
const createBrand = async (req, res, next) => {
  try {
    const { name, description, image_url } = req.body;
    const db_name = `colonel_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const existingBrand = await Brand.findOne({ where: { name } });
    if (existingBrand) {
      return res.status(400).json({ error: 'Brand already exists' });
    }

    // 1. Create the Postgres database
    await createBrandDatabase(db_name);

    // 2. Create the brand record in Master DB
    const brand = await Brand.create({
      name,
      description,
      image_url,
      db_name
    });

    // 3. Initialize the Brand DB with basic tables (like brand_agents)
    const brandDb = getBrandConnection(db_name);
    getBrandAgentModel(brandDb);
    await brandDb.sync();

    res.status(201).json({
      message: 'Brand created successfully',
      brand
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all brands (admin see all, others see assigned)
 */
const getAllBrands = async (req, res, next) => {
  console.log('[DEBUG] getAllBrands hit', { user: req.user.email, path: req.path });
  try {
    if (req.user.role === 'admin') {
      const brands = await Brand.findAll({ order: [['createdAt', 'DESC']] });
      return res.json(brands);
    }

    const user = await User.findByPk(req.user.id, {
      include: [{ model: Brand, through: { attributes: [] } }]
    });

    res.json(user.Brands || []);
  } catch (error) {
    next(error);
  }
};

/**
 * Get brand by ID
 */
const getBrandById = async (req, res, next) => {
  if (req.params.id === 'my-brands') return next();
  try {
    const brand = await Brand.findByPk(req.params.id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    res.json(brand);
  } catch (error) {
    next(error);
  }
};

/**
 * Assign a user to a brand
 */
const assignUserToBrand = async (req, res, next) => {
  try {
    const { brand_id, user_id } = req.body;

    const brand = await Brand.findByPk(brand_id);
    const user = await User.findByPk(user_id);

    if (!brand || !user) {
      return res.status(404).json({ error: 'Brand or User not found' });
    }

    await BrandUser.findOrCreate({
      where: { brand_id, user_id }
    });

    res.json({ message: 'User assigned to brand successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * List users assigned to a brand
 */
const getBrandUsers = async (req, res, next) => {
  try {
    const brand = await Brand.findByPk(req.params.brandId, {
      include: [{ model: User, through: { attributes: [] } }]
    });

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    res.json(brand.Users || []);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBrand,
  getAllBrands,
  getBrandById,
  assignUserToBrand,
  getBrandUsers
};
