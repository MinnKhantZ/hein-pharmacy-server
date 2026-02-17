'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('devices', 'expiry_alerts', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Enable or disable daily expiration window notifications',
    });

    await queryInterface.addColumn('devices', 'expiry_alert_days_before', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 30,
      comment: 'Number of days before expiry date to start daily alerts',
    });

    await queryInterface.addColumn('devices', 'expiry_alert_time', {
      type: Sequelize.TIME,
      allowNull: false,
      defaultValue: '09:00:00',
      comment: 'Time of day to send expiry notifications (HH:MM:SS format)',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('devices', 'expiry_alert_time');
    await queryInterface.removeColumn('devices', 'expiry_alert_days_before');
    await queryInterface.removeColumn('devices', 'expiry_alerts');
  },
};
