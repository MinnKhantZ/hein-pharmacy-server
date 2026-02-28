const pool = require('../config/database');

class InventoryController {
  static getDatabaseErrorCode(error) {
    return error?.parent?.code || error?.original?.code || error?.code;
  }

  static isRetryableDatabaseError(error) {
    const code = InventoryController.getDatabaseErrorCode(error);
    return code === '40P01' || code === '40001' || code === '55P03';
  }

  static async getItems(req, res) {
    try {
      const { page = 1, limit = 20, search, category, owner_id, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT i.*, o.username as owner_username, o.full_name as owner_name
        FROM inventory_items i
        JOIN owners o ON i.owner_id = o.id
        WHERE i.is_active = true
      `;
      const params = [];
      let paramCount = 0;

      // Everyone can see all items (no admin restriction)
      // Apply owner filter if requested
      if (owner_id) {
        paramCount++;
        query += ` AND i.owner_id = $${paramCount}`;
        params.push(owner_id);
      }

      // Search filter
      if (search) {
        paramCount++;
        query += ` AND (i.name ILIKE $${paramCount} OR i.description ILIKE $${paramCount} OR i.barcode ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      // Category filter
      if (category) {
        paramCount++;
        query += ` AND i.category = $${paramCount}`;
        params.push(category);
      }

      // Sorting - validate and sanitize sort parameters
      const validSortFields = ['name', 'quantity', 'unit_price', 'selling_price', 'created_at', 'category', 'expiry_date'];
      const validSortOrders = ['ASC', 'DESC'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      if (sortField === 'expiry_date') {
        query += ` ORDER BY i.expiry_date IS NULL ASC, i.expiry_date ${sortDirection} LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      } else {
        query += ` ORDER BY i.${sortField} ${sortDirection} LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      }
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) FROM inventory_items i WHERE i.is_active = true
      `;
      const countParams = [];
      let countParamCount = 0;

      // Everyone can see all items (no admin restriction)
      if (owner_id) {
        countParamCount++;
        countQuery += ` AND i.owner_id = $${countParamCount}`;
        countParams.push(owner_id);
      }

      if (search) {
        countParamCount++;
        countQuery += ` AND (i.name ILIKE $${countParamCount} OR i.description ILIKE $${countParamCount} OR i.barcode ILIKE $${countParamCount})`;
        countParams.push(`%${search}%`);
      }

      if (category) {
        countParamCount++;
        countQuery += ` AND i.category = $${countParamCount}`;
        countParams.push(category);
      }

      const countResult = await pool.query(countQuery, countParams);

      res.json({
        items: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          pages: Math.ceil(countResult.rows[0].count / limit)
        }
      });
    } catch (error) {
      console.error('Get items error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getItem(req, res) {
    try {
      const { id } = req.params;
      
      let query = `
        SELECT i.*, o.username as owner_username, o.full_name as owner_name
        FROM inventory_items i
        JOIN owners o ON i.owner_id = o.id
        WHERE i.id = $1 AND i.is_active = true
      `;
      const params = [id];

      // Non-admin users can only see their own items
      if (req.user.username !== 'admin') {
        query += ` AND i.owner_id = $2`;
        params.push(req.user.id);
      }

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get item error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async createItem(req, res) {
    try {
      const {
        name, description, category, unit, unit_type, quantity,
        unit_price, selling_price, minimum_stock, barcode,
        expiry_date, supplier, owner_id
      } = req.body;

      // Determine which owner_id to use
      let finalOwnerId = req.user.id; // Default to current user
      
      // If admin is creating item and specifies owner_id, use that
      if (req.user.username === 'admin' && owner_id) {
        finalOwnerId = owner_id;
      }

      const result = await pool.query(
        `INSERT INTO inventory_items 
         (name, description, owner_id, category, unit, unit_type, quantity, 
          unit_price, selling_price, minimum_stock, barcode, expiry_date, supplier, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
         RETURNING *`,
        [name, description, finalOwnerId, category, unit || 'unit', unit_type, quantity,
         unit_price, selling_price, minimum_stock, barcode, expiry_date, supplier]
      );

      res.status(201).json({
        message: 'Item created successfully',
        item: result.rows[0]
      });
    } catch (error) {
      console.error('Create item error:', error);
      if (error.code === '23505') { // Unique constraint violation
        res.status(400).json({ error: 'Barcode already exists' });
      } else if (InventoryController.isRetryableDatabaseError(error)) {
        res.status(409).json({ error: 'Request conflicted with another update. Please retry.' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  static async updateItem(req, res) {
    try {
      const { id } = req.params;
      const {
        name, description, category, unit, unit_type, quantity,
        unit_price, selling_price, minimum_stock, barcode,
        expiry_date, supplier, owner_id
      } = req.body;

      const hasExpiryDateField = Object.prototype.hasOwnProperty.call(req.body, 'expiry_date');

      // Check if item belongs to user (non-admin)
      if (req.user.username !== 'admin') {
        const ownerCheck = await pool.query(
          'SELECT owner_id FROM inventory_items WHERE id = $1',
          [id]
        );
        
        if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].owner_id !== req.user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      // Get old quantity before update
      let oldQuantity = 0;
      if (quantity !== undefined) {
        const oldItem = await pool.query('SELECT quantity FROM inventory_items WHERE id = $1', [id]);
        if (oldItem.rows.length > 0) {
          oldQuantity = oldItem.rows[0].quantity;
        }
      }

      // Build dynamic query for owner_id
      let query = `UPDATE inventory_items 
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             category = COALESCE($3, category),
             unit = COALESCE($4, unit),
             unit_type = COALESCE($5, unit_type),
             quantity = COALESCE($6, quantity),
             unit_price = COALESCE($7, unit_price),
             selling_price = COALESCE($8, selling_price),
             minimum_stock = COALESCE($9, minimum_stock),
             barcode = COALESCE($10, barcode),
             expiry_date = CASE WHEN $13::boolean THEN $11::date ELSE expiry_date END,
             supplier = COALESCE($12, supplier),
             updated_at = NOW()`;
      
      const params = [name, description, category, unit, unit_type, quantity,
         unit_price, selling_price, minimum_stock, barcode,
        expiry_date || null, supplier, hasExpiryDateField];
      
      // Admin can change owner_id
      if (req.user.username === 'admin' && owner_id !== undefined) {
        query += `, owner_id = $14 WHERE id = $15 AND is_active = true RETURNING *`;
        params.push(owner_id, id);
      } else {
        query += ` WHERE id = $14 AND is_active = true RETURNING *`;
        params.push(id);
      }

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // If quantity was updated, sync related items
      if (quantity !== undefined) {
        const UnitConversionService = require('../services/unitConversionService');
        const sequelize = require('../models/index');
        const transaction = await sequelize.transaction();
        try {
          const delta = Number(quantity) - Number(oldQuantity);
          
          if (delta !== 0) {
            await UnitConversionService.propagateQuantityChange(id, delta, transaction);
          }
          await transaction.commit();
        } catch (err) {
          await transaction.rollback();
          console.error('Error propagating quantity change:', err);
        }
      }

      // If expiry date was explicitly provided, sync to all linked items
      if (hasExpiryDateField) {
        const UnitConversionService = require('../services/unitConversionService');
        const sequelize = require('../models/index');
        const transaction = await sequelize.transaction();
        try {
          await UnitConversionService.propagateExpiryDateChange(id, expiry_date || null, transaction);
          await transaction.commit();
        } catch (err) {
          await transaction.rollback();
          console.error('Error propagating expiry date change:', err);
        }
      }

      res.json({
        message: 'Item updated successfully',
        item: result.rows[0]
      });
    } catch (error) {
      console.error('Update item error:', error);
      if (InventoryController.isRetryableDatabaseError(error)) {
        return res.status(409).json({ error: 'Request conflicted with another update. Please retry.' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deleteItem(req, res) {
    try {
      const { id } = req.params;

      // Check if item belongs to user (non-admin)
      if (req.user.username !== 'admin') {
        const ownerCheck = await pool.query(
          'SELECT owner_id FROM inventory_items WHERE id = $1',
          [id]
        );
        
        if (ownerCheck.rows.length === 0 || ownerCheck.rows[0].owner_id !== req.user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const result = await pool.query(
        'UPDATE inventory_items SET is_active = false WHERE id = $1 RETURNING id',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.json({ message: 'Item deleted successfully' });
    } catch (error) {
      console.error('Delete item error:', error);
      if (InventoryController.isRetryableDatabaseError(error)) {
        return res.status(409).json({ error: 'Request conflicted with another update. Please retry.' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getLowStockItems(req, res) {
    try {
      let query = `
        SELECT i.*, o.username as owner_username, o.full_name as owner_name
        FROM inventory_items i
        JOIN owners o ON i.owner_id = o.id
        WHERE i.is_active = true AND i.quantity <= i.minimum_stock
      `;
      const params = [];

      // Filter by owner if not admin
      if (req.user.username !== 'admin') {
        query += ` AND i.owner_id = $1`;
        params.push(req.user.id);
      }

      query += ` ORDER BY (i.quantity - i.minimum_stock) ASC`;

      const result = await pool.query(query, params);

      res.json(result.rows);
    } catch (error) {
      console.error('Get low stock items error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getCategories(req, res) {
    try {
      // Everyone can see all categories (no admin restriction)
      const query = `
        SELECT DISTINCT category 
        FROM inventory_items 
        WHERE is_active = true AND category IS NOT NULL AND category != ''
        ORDER BY category
      `;

      const result = await pool.query(query);

      res.json(result.rows.map(row => row.category));
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getOwners(req, res) {
    try {
      // Everyone can see all owners (no admin restriction)
      const query = `
        SELECT id, username, full_name
        FROM owners 
        WHERE is_active = true
        ORDER BY full_name
      `;

      const result = await pool.query(query);

      res.json(result.rows);
    } catch (error) {
      console.error('Get owners error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = InventoryController;