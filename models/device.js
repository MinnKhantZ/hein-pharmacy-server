const { DataTypes } = require('sequelize');
const sequelize = require('./index');

/**
 * Device model to store push notification tokens
 */
const Device = sequelize.define('Device', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  owner_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'owners',
      key: 'id',
    },
  },
  push_token: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  device_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  device_model: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  last_active: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  low_stock_alerts: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  sales_notifications: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  low_stock_alert_time: {
    type: DataTypes.TIME,
    allowNull: false,
    defaultValue: '09:00:00',
  },
  expiry_alerts: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  expiry_alert_days_before: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30,
  },
  expiry_alert_time: {
    type: DataTypes.TIME,
    allowNull: false,
    defaultValue: '09:00:00',
  },
  print_layout_config: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
}, {
  tableName: 'devices',
  timestamps: true,
  underscored: true,
});

module.exports = Device;
