const pool = require('../config/database');
const UnitConversion = require('../models/unit_conversion');
const InventoryItem = require('../models/inventory_item');
const sequelize = require('../models/index');
const { Op } = require('sequelize');

class UnitConversionController {
  // Get all conversions, optionally filtered by item_id
  static async getConversions(req, res) {
    try {
      const { item_id } = req.query;

      let query = `
        SELECT uc.*,
               base.name as base_item_name, base.unit as base_item_unit,
               base.quantity as base_item_quantity, base.selling_price as base_item_price,
               pkg.name as package_item_name, pkg.unit as package_item_unit,
               pkg.quantity as package_item_quantity, pkg.selling_price as package_item_price
        FROM unit_conversions uc
        JOIN inventory_items base ON uc.base_item_id = base.id
        JOIN inventory_items pkg ON uc.package_item_id = pkg.id
      `;
      const params = [];

      if (item_id) {
        query += ` WHERE uc.base_item_id = $1 OR uc.package_item_id = $1`;
        params.push(item_id);
      }

      query += ` ORDER BY uc.created_at DESC`;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Get conversions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Create a new unit conversion between two items
  static async createConversion(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const { base_item_id, package_item_id, conversion_rate, sync_source_item_id } = req.body;

      if (!base_item_id || !package_item_id || !conversion_rate) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'base_item_id, package_item_id, and conversion_rate are required'
        });
      }

      if (Number(base_item_id) === Number(package_item_id)) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Base and package items must be different' });
      }

      if (Number(conversion_rate) <= 0) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Conversion rate must be positive' });
      }

      // Lock both items to prevent race conditions
      const baseItem = await InventoryItem.findByPk(base_item_id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      const packageItem = await InventoryItem.findByPk(package_item_id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!baseItem || !baseItem.is_active) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Base item not found' });
      }

      if (!packageItem || !packageItem.is_active) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Package item not found' });
      }

      // Check for existing conversion between these items (in either direction)
      const existing = await UnitConversion.findOne({
        where: {
          [Op.or]: [
            { base_item_id, package_item_id },
            { base_item_id: package_item_id, package_item_id: base_item_id }
          ]
        },
        transaction
      });

      if (existing) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'A conversion between these items already exists'
        });
      }

      // Create the conversion
      const conversion = await UnitConversion.create({
        base_item_id,
        package_item_id,
        conversion_rate
      }, { transaction });

      // Sync quantities and expiry dates if a source item is specified
      if (sync_source_item_id) {
        const rate = Number(conversion_rate);

        if (Number(sync_source_item_id) === Number(base_item_id)) {
          // Use base item's quantity and expiry date as the source of truth
          const baseQty = Number(baseItem.quantity);
          const newPackageQty = baseQty / rate;
          await packageItem.update({ 
            quantity: newPackageQty,
            expiry_date: baseItem.expiry_date 
          }, { transaction });
        } else if (Number(sync_source_item_id) === Number(package_item_id)) {
          // Use package item's quantity and expiry date as the source of truth
          const packageQty = Number(packageItem.quantity);
          const newBaseQty = packageQty * rate;
          await baseItem.update({ 
            quantity: newBaseQty,
            expiry_date: packageItem.expiry_date 
          }, { transaction });
        }
      }

      await transaction.commit();

      // Fetch the full conversion data for response
      const result = await pool.query(`
        SELECT uc.*,
               base.name as base_item_name, base.unit as base_item_unit,
               base.quantity as base_item_quantity, base.selling_price as base_item_price,
               pkg.name as package_item_name, pkg.unit as package_item_unit,
               pkg.quantity as package_item_quantity, pkg.selling_price as package_item_price
        FROM unit_conversions uc
        JOIN inventory_items base ON uc.base_item_id = base.id
        JOIN inventory_items pkg ON uc.package_item_id = pkg.id
        WHERE uc.id = $1
      `, [conversion.id]);

      res.status(201).json({
        message: 'Unit conversion created successfully',
        conversion: result.rows[0]
      });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('Create conversion error:', error);
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          error: 'A conversion between these items already exists'
        });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Update conversion rate
  static async updateConversion(req, res) {
    try {
      const { id } = req.params;
      const { conversion_rate } = req.body;

      if (!conversion_rate || Number(conversion_rate) <= 0) {
        return res.status(400).json({ error: 'Valid conversion rate is required' });
      }

      const conversion = await UnitConversion.findByPk(id);
      if (!conversion) {
        return res.status(404).json({ error: 'Conversion not found' });
      }

      await conversion.update({ conversion_rate });

      const result = await pool.query(`
        SELECT uc.*,
               base.name as base_item_name, base.unit as base_item_unit,
               base.quantity as base_item_quantity, base.selling_price as base_item_price,
               pkg.name as package_item_name, pkg.unit as package_item_unit,
               pkg.quantity as package_item_quantity, pkg.selling_price as package_item_price
        FROM unit_conversions uc
        JOIN inventory_items base ON uc.base_item_id = base.id
        JOIN inventory_items pkg ON uc.package_item_id = pkg.id
        WHERE uc.id = $1
      `, [id]);

      res.json({
        message: 'Conversion updated successfully',
        conversion: result.rows[0]
      });
    } catch (error) {
      console.error('Update conversion error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Delete a conversion
  static async deleteConversion(req, res) {
    try {
      const { id } = req.params;

      const conversion = await UnitConversion.findByPk(id);
      if (!conversion) {
        return res.status(404).json({ error: 'Conversion not found' });
      }

      await conversion.destroy();

      res.json({ message: 'Conversion deleted successfully' });
    } catch (error) {
      console.error('Delete conversion error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Sync quantities between linked items using one as the source of truth
  static async syncQuantities(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const { id } = req.params;
      const { source_item_id } = req.body;

      const conversion = await UnitConversion.findByPk(id, { transaction });
      if (!conversion) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Conversion not found' });
      }

      const baseItem = await InventoryItem.findByPk(conversion.base_item_id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      const packageItem = await InventoryItem.findByPk(conversion.package_item_id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!baseItem || !packageItem) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Related items not found' });
      }

      const rate = Number(conversion.conversion_rate);

      if (Number(source_item_id) === Number(conversion.base_item_id)) {
        const baseQty = Number(baseItem.quantity);
        await packageItem.update({ quantity: baseQty / rate }, { transaction });
      } else if (Number(source_item_id) === Number(conversion.package_item_id)) {
        const packageQty = Number(packageItem.quantity);
        await baseItem.update({ quantity: packageQty * rate }, { transaction });
      } else {
        await transaction.rollback();
        return res.status(400).json({
          error: 'source_item_id must be one of the items in this conversion'
        });
      }

      await transaction.commit();

      res.json({ message: 'Quantities synced successfully' });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('Sync quantities error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = UnitConversionController;
