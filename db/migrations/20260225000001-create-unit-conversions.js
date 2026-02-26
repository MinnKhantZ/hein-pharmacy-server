'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create unit_conversions table
    await queryInterface.createTable('unit_conversions', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      base_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inventory_items', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      package_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'inventory_items', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      conversion_rate: {
        type: Sequelize.DECIMAL(15, 6),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    // Prevent duplicate relationships (A→B and B→A)
    await queryInterface.addIndex('unit_conversions', ['base_item_id', 'package_item_id'], {
      unique: true,
      name: 'unique_base_package_pair',
    });

    // Change quantity column from INTEGER to DECIMAL(15, 6) to support fractional quantities
    await queryInterface.changeColumn('inventory_items', 'quantity', {
      type: Sequelize.DECIMAL(15, 6),
      defaultValue: 0,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('unit_conversions');

    // Revert quantity column back to INTEGER
    await queryInterface.changeColumn('inventory_items', 'quantity', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    });
  },
};
