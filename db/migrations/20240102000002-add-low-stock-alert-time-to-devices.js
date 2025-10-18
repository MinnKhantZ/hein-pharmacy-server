'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add low_stock_alert_time column to devices table
    await queryInterface.addColumn('devices', 'low_stock_alert_time', {
      type: Sequelize.TIME,
      allowNull: false,
      defaultValue: '09:00:00',
      comment: 'Time of day to send low stock notifications (HH:MM:SS format)',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the column if rolling back
    await queryInterface.removeColumn('devices', 'low_stock_alert_time');
  },
};
