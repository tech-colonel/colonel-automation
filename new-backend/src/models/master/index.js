const { DataTypes } = require('sequelize');
const { masterSequelize } = require('../../config/database');

const User = masterSequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'accountant', 'brand_executive'),
    defaultValue: 'accountant'
  }
}, {
  tableName: 'users',
  freezeTableName: true
});

const Brand = masterSequelize.define('Brand', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT
  },
  image_url: {
    type: DataTypes.STRING
  },
  db_name: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  }
}, {
  tableName: 'brands',
  freezeTableName: true
});

const Agent = masterSequelize.define('Agent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT
  },
  columns: {
    type: DataTypes.JSONB,
    defaultValue: []
  }
}, {
  tableName: 'agents',
  freezeTableName: true
});

// Many-to-Many: User <-> Brand
const BrandUser = masterSequelize.define('brand_users', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  brand_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  tableName: 'brand_users',
  freezeTableName: true
});

User.belongsToMany(Brand, { through: BrandUser, foreignKey: 'user_id', otherKey: 'brand_id' });
Brand.belongsToMany(User, { through: BrandUser, foreignKey: 'brand_id', otherKey: 'user_id' });

// Many-to-Many: Brand <-> Agent
const BrandAgent = masterSequelize.define('brand_agents', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  brand_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  agent_id: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  tableName: 'brand_agents',
  freezeTableName: true
});

Brand.belongsToMany(Agent, { through: BrandAgent, foreignKey: 'brand_id', otherKey: 'agent_id' });
Agent.belongsToMany(Brand, { through: BrandAgent, foreignKey: 'agent_id', otherKey: 'brand_id' });

module.exports = {
  User,
  Brand,
  Agent,
  BrandUser,
  BrandAgent
};
