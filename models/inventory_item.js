const { DataTypes, Model } = require('sequelize');
const sequelize = require('./index');
const Owner = require('./owner');

class InventoryItem extends Model {}

InventoryItem.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  description: DataTypes.TEXT,
  owner_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'owners', key: 'id' },
  },
  category: DataTypes.STRING(100),
  unit: {
    type: DataTypes.STRING(50),
    defaultValue: 'unit',
    allowNull: false,
  },
  unit_type: {
    type: DataTypes.STRING(50),
    defaultValue: 'pieces',
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  unit_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  selling_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  minimum_stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  barcode: DataTypes.STRING(100),
  expiry_date: DataTypes.DATEONLY,
  supplier: DataTypes.STRING(200),
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  sequelize,
  modelName: 'InventoryItem',
  tableName: 'inventory_items',
  timestamps: true,
});

InventoryItem.belongsTo(Owner, { foreignKey: 'owner_id', as: 'owner' });
Owner.hasMany(InventoryItem, { foreignKey: 'owner_id', as: 'items' });

module.exports = InventoryItem;