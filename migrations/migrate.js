const sequelize = require('../models/index');
const Owner = require('../models/owner');
const InventoryItem = require('../models/inventory_item');
const Sale = require('../models/sale');
const SaleItem = require('../models/sale_item');
const IncomeSummary = require('../models/income_summary');
const bcrypt = require('bcryptjs');

const createTables = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('All models were synchronized successfully.');
  } catch (error) {
    console.error('Error syncing models:', error);
    throw error;
  }
};

const seedData = async () => {
  try {
    // Check if owners already exist
    const existingOwners = await Owner.count();
    if (existingOwners > 0) {
      console.log('Data already seeded');
      return;
    }

    // Create sample owners
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const owner1 = await Owner.create({
      username: 'ayeayesan',
      password: hashedPassword,
      full_name: 'Daw Aye Aye San',
      email: 'aas@pharmacy.com',
      phone: '+959777888999'
    });

    const owner2 = await Owner.create({
      username: 'uhtoo',
      password: hashedPassword,
      full_name: 'U Htoo',
      email: 'uhtoo@pharmacy.com',
      phone: '+959999888777'
    });

    await Owner.create({
      username: 'admin',
      password: hashedPassword,
      full_name: 'Admin',
      email: 'admin@pharmacy.com',
      phone: '+959711822933'
    });

    // Create sample inventory items
    await InventoryItem.bulkCreate([
      {
        name: 'Paracetamol 500mg',
        description: 'Pain relief tablets',
        owner_id: owner1.id,
        category: 'Pain Relief',
        quantity: 100,
        unit_price: 500,
        selling_price: 1000,
        minimum_stock: 20
      },
      {
        name: 'Ibuprofen 400mg',
        description: 'Anti-inflammatory tablets',
        owner_id: owner1.id,
        category: 'Pain Relief',
        quantity: 80,
        unit_price: 750,
        selling_price: 1500,
        minimum_stock: 15
      },
      {
        name: 'Amoxicillin 250mg',
        description: 'Antibiotic capsules',
        owner_id: owner2.id,
        category: 'Antibiotics',
        quantity: 50,
        unit_price: 2000,
        selling_price: 4000,
        minimum_stock: 10
      },
      {
        name: 'Vitamin C 1000mg',
        description: 'Vitamin supplement',
        owner_id: owner2.id,
        category: 'Vitamins',
        quantity: 120,
        unit_price: 1000,
        selling_price: 2000,
        minimum_stock: 30
      },
      {
        name: 'Cough Syrup',
        description: 'For dry cough',
        owner_id: owner1.id,
        category: 'Cough & Cold',
        quantity: 40,
        unit_price: 3000,
        selling_price: 6000,
        minimum_stock: 10
      }
    ]);

    console.log('Sample data seeded successfully');
  } catch (error) {
    console.error('Error seeding data:', error);
    throw error;
  }
};

module.exports = {
  createTables,
  seedData
};