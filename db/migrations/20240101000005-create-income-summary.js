'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('income_summary', {
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
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      total_sales: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0,
      },
      total_profit: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0,
      },
      total_items_sold: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
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

    // Add unique index for owner_id and date combination
    await queryInterface.addIndex('income_summary', ['owner_id', 'date'], {
      unique: true,
      name: 'income_summary_owner_id_date_unique',
    }).catch(err => {
      // Ignore error if index already exists
      if (err.message.includes('already exists')) {
        console.log('Index already exists, skipping creation');
      } else {
        throw err;
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('income_summary');
  },
};
