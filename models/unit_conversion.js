const { DataTypes, Model } = require('sequelize');
const sequelize = require('./index');
const InventoryItem = require('./inventory_item');

class UnitConversion extends Model {}

UnitConversion.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  base_item_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'inventory_items', key: 'id' },
  },
  package_item_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'inventory_items', key: 'id' },
  },
  conversion_rate: {
    type: DataTypes.DECIMAL(15, 6),
    allowNull: false,
  },
}, {
  sequelize,
  modelName: 'UnitConversion',
  tableName: 'unit_conversions',
  timestamps: true,
});

UnitConversion.belongsTo(InventoryItem, { foreignKey: 'base_item_id', as: 'baseItem' });
UnitConversion.belongsTo(InventoryItem, { foreignKey: 'package_item_id', as: 'packageItem' });
InventoryItem.hasMany(UnitConversion, { foreignKey: 'base_item_id', as: 'baseConversions' });
InventoryItem.hasMany(UnitConversion, { foreignKey: 'package_item_id', as: 'packageConversions' });

module.exports = UnitConversion;
