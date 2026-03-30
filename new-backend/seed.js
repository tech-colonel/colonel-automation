const bcrypt = require('bcryptjs');
const { masterSequelize } = require('./src/config/database');
const { User, Agent } = require('./src/models/master/index.js');

const seedDatabase = async () => {
    console.log("seed");
    try {
        await masterSequelize.sync({ force: false });

        const adminExists = await User.findOne({ where: { email: 'admin@colonel.com' } });

        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await User.create({
                name: 'Admin User',
                email: 'admin@colonel.com',
                password: hashedPassword,
                role: 'admin'
            });
            console.log('✓ Admin user created (email: admin@colonel.com, password: admin123)');
        } else {
            console.log('✓ Admin user already exists');
        }

        const accountantExists = await User.findOne({ where: { email: 'accountant@colonel.com' } });

        if (!accountantExists) {
            const hashedPassword = await bcrypt.hash('accountant123', 10);
            await User.create({
                name: 'Accountant User',
                email: 'accountant@colonel.com',
                password: hashedPassword,
                role: 'accountant'
            });
            console.log('✓ Accountant user created (email: accountant@colonel.com, password: accountant123)');
        } else {
            console.log('✓ Accountant user already exists');
        }

        const salesAmazonExists = await Agent.findOne({ where: { name: 'Sales-Amazon' } });

        if (!salesAmazonExists) {
            await Agent.create({
                name: 'Sales-Amazon',
                description: 'Process Amazon sales data and generate working files with SKU and Ledger mapping',
                columns: [
                    { name: 'SKU', type: 'STRING' },
                    { name: 'Product_Name', type: 'STRING' },
                    { name: 'Quantity', type: 'INTEGER' },
                    { name: 'Amount', type: 'DECIMAL' },
                    { name: 'State', type: 'STRING' }
                ]
            });
            console.log('✓ Sales-Amazon agent created');
        } else {
            console.log('✓ Sales-Amazon agent already exists');
        }

        const salesFlipkartExists = await Agent.findOne({ where: { name: 'Sales-Flipkart' } });

        if (!salesFlipkartExists) {
            await Agent.create({
                name: 'Sales-Flipkart',
                description: 'Process Flipkart sales data and generate working files with SKU and Ledger mapping',
                columns: [
                    { name: 'SKU', type: 'STRING' },
                    { name: 'Product_Name', type: 'STRING' },
                    { name: 'Quantity', type: 'INTEGER' },
                    { name: 'Amount', type: 'DECIMAL' },
                    { name: 'State', type: 'STRING' }
                ]
            });
            console.log('✓ Sales-Flipkart agent created');
        } else {
            console.log('✓ Sales-Flipkart agent already exists');
        }

        console.log('\n✓ Database seeding completed successfully!');
        console.log('\nLogin Credentials:');
        console.log('Admin: admin@colonel.com / admin123');
        console.log('Accountant: accountant@colonel.com / accountant123');
        console.log('');

        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    }
};

seedDatabase();
