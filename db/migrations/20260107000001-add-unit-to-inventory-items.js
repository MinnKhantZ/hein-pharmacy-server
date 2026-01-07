'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('inventory_items', 'unit', {
      type: Sequelize.STRING(50),
      defaultValue: 'unit',
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('inventory_items', 'unit');
  }
};
