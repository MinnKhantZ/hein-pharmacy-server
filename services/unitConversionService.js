const UnitConversion = require('../models/unit_conversion');
const InventoryItem = require('../models/inventory_item');
const { Op } = require('sequelize');

class UnitConversionService {
  /**
   * Propagate a quantity change through the unit conversion chain.
   * When an item's quantity changes by `delta`, all related items
   * are updated proportionally based on their conversion rates.
   *
   * @param {number} itemId - The item whose quantity changed
   * @param {number} delta - The quantity change (negative = decrease, positive = increase)
   * @param {object} transaction - Sequelize transaction
   * @param {Set} visited - Set of already-processed item IDs (prevents infinite loops)
   */
  static async propagateQuantityChange(itemId, delta, transaction, visited = new Set()) {
    const numericItemId = Number(itemId);
    if (visited.has(numericItemId)) return;
    visited.add(numericItemId);

    // Skip negligible deltas (floating point threshold)
    if (Math.abs(delta) < 0.000001) return;

    // Find all conversions involving this item
    const conversions = await UnitConversion.findAll({
      where: {
        [Op.or]: [
          { base_item_id: numericItemId },
          { package_item_id: numericItemId }
        ]
      },
      transaction
    });

    for (const conversion of conversions) {
      let relatedItemId;
      let relatedDelta;

      if (Number(conversion.base_item_id) === numericItemId) {
        // This item is the base; related is the package
        // e.g., card is sold, box quantity decreases by delta / rate
        relatedItemId = Number(conversion.package_item_id);
        relatedDelta = delta / Number(conversion.conversion_rate);
      } else {
        // This item is the package; related is the base
        // e.g., box is sold, card quantity decreases by delta * rate
        relatedItemId = Number(conversion.base_item_id);
        relatedDelta = delta * Number(conversion.conversion_rate);
      }

      if (visited.has(relatedItemId)) continue;

      // Lock and update the related item's quantity
      const relatedItem = await InventoryItem.findByPk(relatedItemId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (relatedItem && relatedItem.is_active) {
        const newQuantity = Number(relatedItem.quantity) + relatedDelta;
        await relatedItem.update({ quantity: newQuantity }, { transaction });

        // Recurse to propagate further in the chain
        await UnitConversionService.propagateQuantityChange(
          relatedItemId, relatedDelta, transaction, visited
        );
      }
    }
  }
}

module.exports = UnitConversionService;
