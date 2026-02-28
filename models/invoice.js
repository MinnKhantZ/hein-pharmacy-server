const { DataTypes, Model } = require('sequelize');
const sequelize = require('./index');
const Owner = require('./owner');

class Invoice extends Model {}

Invoice.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  invoice_id: {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true,
  },
  company_name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  payment_method: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['cash', 'credit']],
    },
  },
  invoice_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'owners',
      key: 'id',
    },
  },
}, {
  sequelize,
  modelName: 'Invoice',
  tableName: 'invoices',
  timestamps: true,
});

Invoice.belongsTo(Owner, { foreignKey: 'created_by', as: 'creator' });

module.exports = Invoice;
