'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, drop the enum type if it exists (for clean slate)
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_sales_payment_method CASCADE
    `);

    await queryInterface.createTable('sales', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      sale_date: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      payment_method: {
        type: Sequelize.ENUM('cash', 'mobile', 'credit'),
        defaultValue: 'cash',
      },
      is_paid: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      paid_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      customer_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      customer_phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop table and the enum type
    await queryInterface.sequelize.query(`
      DROP TYPE IF EXISTS enum_sales_payment_method CASCADE
    `);
    await queryInterface.dropTable('sales');
  },
};