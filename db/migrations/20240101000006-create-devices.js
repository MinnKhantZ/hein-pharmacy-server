'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('devices', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      owner_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'owners',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      push_token: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      device_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      device_model: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      last_active: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      low_stock_alerts: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      sales_notifications: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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
    await queryInterface.dropTable('devices');
  },
};
