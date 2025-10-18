'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    const now = new Date();

    // Insert owners
    const owners = await queryInterface.bulkInsert('owners', [
      {
        username: 'ayeayesan',
        password: hashedPassword,
        full_name: 'Daw Aye Aye San',
        email: 'aas@pharmacy.com',
        phone: '+959777888999',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        username: 'uhtoo',
        password: hashedPassword,
        full_name: 'U Htoo',
        email: 'uhtoo@pharmacy.com',
        phone: '+959999888777',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        username: 'admin',
        password: hashedPassword,
        full_name: 'Admin',
        email: 'admin@pharmacy.com',
        phone: '+959711822933',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ], { returning: true });

    // Get owner IDs (for PostgreSQL)
    const ownerRecords = await queryInterface.sequelize.query(
      'SELECT id, username FROM owners ORDER BY id',
      { type: Sequelize.QueryTypes.SELECT }
    );

    const owner1Id = ownerRecords.find(o => o.username === 'ayeayesan').id;
    const owner2Id = ownerRecords.find(o => o.username === 'uhtoo').id;

    // Insert inventory items
    await queryInterface.bulkInsert('inventory_items', [
      {
        name: 'Paracetamol 500mg',
        description: 'Pain relief tablets',
        owner_id: owner1Id,
        category: 'Pain Relief',
        unit_type: 'pieces',
        quantity: 100,
        unit_price: 500,
        selling_price: 1000,
        minimum_stock: 20,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Ibuprofen 400mg',
        description: 'Anti-inflammatory tablets',
        owner_id: owner1Id,
        category: 'Pain Relief',
        unit_type: 'pieces',
        quantity: 80,
        unit_price: 750,
        selling_price: 1500,
        minimum_stock: 15,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Amoxicillin 250mg',
        description: 'Antibiotic capsules',
        owner_id: owner2Id,
        category: 'Antibiotics',
        unit_type: 'pieces',
        quantity: 50,
        unit_price: 2000,
        selling_price: 4000,
        minimum_stock: 10,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Vitamin C 1000mg',
        description: 'Vitamin supplement',
        owner_id: owner2Id,
        category: 'Vitamins',
        unit_type: 'pieces',
        quantity: 120,
        unit_price: 1000,
        selling_price: 2000,
        minimum_stock: 30,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Cough Syrup',
        description: 'For dry cough',
        owner_id: owner1Id,
        category: 'Cough & Cold',
        unit_type: 'pieces',
        quantity: 40,
        unit_price: 3000,
        selling_price: 6000,
        minimum_stock: 10,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('inventory_items', null, {});
    await queryInterface.bulkDelete('owners', null, {});
  },
};
