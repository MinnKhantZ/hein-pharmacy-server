'use strict';

// Keep this in sync with hein-pharmacy-client/types/printLayout.ts (DEFAULT_PRINT_LAYOUT)
const DEFAULT_PRINT_LAYOUT = {
  paperWidth: 576,
  scale: 3,
  paddingBase: 12,
  fontSizes: {
    storeName: 42,
    storeInfo: 21,
    sectionTitle: 21,
    normal: 21,
    small: 18,
    total: 28,
  },
  columnWidths: {
    name: 0.4,
    quantity: 0.1,
    unit: 0.1,
    price: 0.2,
    total: 0.2,
  },
  margins: {
    dividerVertical: 10,
    infoSection: 6,
    infoRow: 3,
    itemsHeaderBottom: 6,
    itemRow: 4,
    totalRow: 8,
    footerTop: 14,
    footerBottom: 40,
  },
  lineHeights: {
    default: 1.3,
    itemName: 1.4,
    footer: 1.4,
  },
};

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add column with default preset
    await queryInterface.addColumn('devices', 'print_layout_config', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: DEFAULT_PRINT_LAYOUT,
      comment: 'Receipt print layout configuration JSON (per device)',
    });

    // Backfill existing rows that may have null
    await queryInterface.sequelize.query(
      `UPDATE devices
       SET print_layout_config = COALESCE(print_layout_config, $1::jsonb)
       WHERE print_layout_config IS NULL`,
      {
        bind: [JSON.stringify(DEFAULT_PRINT_LAYOUT)],
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('devices', 'print_layout_config');
  },
};
