const { DataTypes, Model } = require('sequelize');
const sequelize = require('./index');
const Owner = require('./owner');

class IncomeSummary extends Model {}

IncomeSummary.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  owner_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'owners', key: 'id' },
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  total_sales: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  total_profit: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  total_items_sold: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  sequelize,
  modelName: 'IncomeSummary',
  tableName: 'income_summary',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['owner_id', 'date'] },
  ],
});

IncomeSummary.belongsTo(Owner, { foreignKey: 'owner_id', as: 'owner' });
Owner.hasMany(IncomeSummary, { foreignKey: 'owner_id', as: 'incomeSummaries' });

module.exports = IncomeSummary;