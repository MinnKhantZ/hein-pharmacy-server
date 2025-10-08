const { DataTypes, Model } = require('sequelize');
const sequelize = require('./index');
const Sale = require('./sale');
const InventoryItem = require('./inventory_item');
const Owner = require('./owner');

class SaleItem extends Model {}

SaleItem.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  sale_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'sales', key: 'id' },
  },
  inventory_item_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'inventory_items', key: 'id' },
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  unit_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  total_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  owner_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'owners', key: 'id' },
  },
}, {
  sequelize,
  modelName: 'SaleItem',
  tableName: 'sale_items',
  timestamps: true,
});

SaleItem.belongsTo(Sale, { foreignKey: 'sale_id', as: 'sale' });
Sale.hasMany(SaleItem, { foreignKey: 'sale_id', as: 'items' });

SaleItem.belongsTo(InventoryItem, { foreignKey: 'inventory_item_id', as: 'inventoryItem' });
InventoryItem.hasMany(SaleItem, { foreignKey: 'inventory_item_id', as: 'saleItems' });

SaleItem.belongsTo(Owner, { foreignKey: 'owner_id', as: 'owner' });
Owner.hasMany(SaleItem, { foreignKey: 'owner_id', as: 'saleItems' });

module.exports = SaleItem;