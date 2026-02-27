'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('invoices', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
      },
      invoice_id: {
        type: Sequelize.STRING(120),
        allowNull: false,
        unique: true
      },
      company_name: {
        type: Sequelize.STRING(200),
        allowNull: false
      },
      payment_method: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      invoice_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      image_url: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'owners',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addConstraint('invoices', {
      fields: ['payment_method'],
      type: 'check',
      name: 'invoices_payment_method_check',
      where: {
        payment_method: ['cash', 'credit']
      }
    });

    await queryInterface.addIndex('invoices', ['invoice_date']);
    await queryInterface.addIndex('invoices', ['company_name']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('invoices', ['company_name']);
    await queryInterface.removeIndex('invoices', ['invoice_date']);
    await queryInterface.removeConstraint('invoices', 'invoices_payment_method_check');
    await queryInterface.dropTable('invoices');
  }
};
