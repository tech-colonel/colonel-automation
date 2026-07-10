/**
 * One-time migration: populate agentType for existing agents based on name matching.
 * Run once after server restart (which will add the agentType column via alter:true).
 *   node migrate-agent-types.js
 */
const { masterSequelize } = require('./src/config/database.js');
const { Agent } = require('./src/models/master/index.js');

const TYPE_MAP = [
  { keyword: 'amazon',        type: 'amazon' },
  { keyword: 'flipkart',      type: 'flipkart' },
  { keyword: 'myntra',        type: 'myntra' },
  { keyword: 'blinkit',       type: 'blinkit' },
  { keyword: 'zepto',         type: 'zepto' },
  { keyword: 'firstcry',      type: 'firstcry' },
  { keyword: 'jiomart',       type: 'jiomart' },
  { keyword: 'cread',         type: 'cread' },
  { keyword: 'limeroad',      type: 'limeroad' },
  { keyword: 'mirrow',        type: 'mirrow' },
  { keyword: 'nykaa',         type: 'nykaa' },
  { keyword: 'total-sales',   type: 'total-sales-analyzer' },
  { keyword: 'shopify',       type: 'shopify' },
];

const detectType = (name) => {
  const lower = (name || '').toLowerCase();
  for (const { keyword, type } of TYPE_MAP) {
    if (lower.includes(keyword)) return type;
  }
  return null;
};

const run = async () => {
  try {
    await masterSequelize.sync({ alter: true });
    console.log('DB synced (agentType column added if missing).');

    const agents = await Agent.findAll();
    let updated = 0;

    for (const agent of agents) {
      if (agent.agentType) {
        console.log(`  SKIP  ${agent.name} — already set to "${agent.agentType}"`);
        continue;
      }
      const type = detectType(agent.name);
      if (type) {
        await agent.update({ agentType: type });
        console.log(`  SET   ${agent.name} → "${type}"`);
        updated++;
      } else {
        console.log(`  WARN  ${agent.name} — no matching type found`);
      }
    }

    console.log(`\nDone. ${updated} agent(s) updated.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
};

run();
