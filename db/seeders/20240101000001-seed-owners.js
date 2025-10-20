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
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('owners', null, {});
  },
};
