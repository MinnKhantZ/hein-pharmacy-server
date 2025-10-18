const pool = require('../config/database');

class InventoryController {
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
      let params = [];
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
      const validSortFields = ['name', 'quantity', 'unit_price', 'selling_price', 'created_at', 'category'];
      const validSortOrders = ['ASC', 'DESC'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      query += ` ORDER BY i.${sortField} ${sortDirection} LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) FROM inventory_items i WHERE i.is_active = true
      `;
      let countParams = [];
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
      let params = [id];

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
        name, description, category, unit_type, quantity,
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
         (name, description, owner_id, category, unit_type, quantity, 
          unit_price, selling_price, minimum_stock, barcode, expiry_date, supplier, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
         RETURNING *`,
        [name, description, finalOwnerId, category, unit_type, quantity,
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
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  static async updateItem(req, res) {
    try {
      const { id } = req.params;
      const {
        name, description, category, unit_type, quantity,
        unit_price, selling_price, minimum_stock, barcode,
        expiry_date, supplier, owner_id
      } = req.body;

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

      // Build dynamic query for owner_id
      let query = `UPDATE inventory_items 
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             category = COALESCE($3, category),
             unit_type = COALESCE($4, unit_type),
             quantity = COALESCE($5, quantity),
             unit_price = COALESCE($6, unit_price),
             selling_price = COALESCE($7, selling_price),
             minimum_stock = COALESCE($8, minimum_stock),
             barcode = COALESCE($9, barcode),
             expiry_date = COALESCE($10, expiry_date),
             supplier = COALESCE($11, supplier),
             updated_at = NOW()`;
      
      let params = [name, description, category, unit_type, quantity,
         unit_price, selling_price, minimum_stock, barcode,
         expiry_date, supplier];
      
      // Admin can change owner_id
      if (req.user.username === 'admin' && owner_id !== undefined) {
        query += `, owner_id = $12 WHERE id = $13 AND is_active = true RETURNING *`;
        params.push(owner_id, id);
      } else {
        query += ` WHERE id = $12 AND is_active = true RETURNING *`;
        params.push(id);
      }

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Item not found' });
      }

      res.json({
        message: 'Item updated successfully',
        item: result.rows[0]
      });
    } catch (error) {
      console.error('Update item error:', error);
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
      let params = [];

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
      let query = `
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
      let query = `
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