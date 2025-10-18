const { DataTypes, Model } = require('sequelize');
const sequelize = require('./index');
const Owner = require('./owner');

class Sale extends Model {}

Sale.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  sale_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  payment_method: {
    type: DataTypes.ENUM('cash', 'mobile'),
    defaultValue: 'cash',
  },
  customer_name: DataTypes.STRING(100),
  customer_phone: DataTypes.STRING(20),
  notes: DataTypes.TEXT,
}, {
  sequelize,
  modelName: 'Sale',
  tableName: 'sales',
  timestamps: true,
});

module.exports = Sale;