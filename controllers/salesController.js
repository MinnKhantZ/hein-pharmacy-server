const Sale = require('../models/sale');
const SaleItem = require('../models/sale_item');
const InventoryItem = require('../models/inventory_item');
const IncomeSummary = require('../models/income_summary');
const sequelize = require('../models/index');
const pool = require('../config/database');

class SalesController {
  static async createSale(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { items, payment_method, customer_name, customer_phone, notes, device_push_token } = req.body;
      
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'No items provided' });
      }

      let totalAmount = 0;
      const saleItemsData = [];
      
      // Validate items and calculate total
      for (const item of items) {
        const inventoryItem = await InventoryItem.findOne({
          where: { id: item.inventory_item_id, is_active: true },
          transaction
        });
        
        if (!inventoryItem) {
          await transaction.rollback();
          return res.status(400).json({ error: `Item with ID ${item.inventory_item_id} not found` });
        }
        
        if (inventoryItem.quantity < item.quantity) {
          await transaction.rollback();
          return res.status(400).json({ 
            error: `Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.quantity}, Requested: ${item.quantity}` 
          });
        }
        
        const itemTotal = Number(inventoryItem.selling_price) * item.quantity;
        const unitCost = Number(inventoryItem.unit_price);
        const income = (Number(inventoryItem.selling_price) - unitCost) * item.quantity;
        
        totalAmount += itemTotal;
        
        saleItemsData.push({
          inventory_item_id: item.inventory_item_id,
          quantity: item.quantity,
          unit_price: inventoryItem.selling_price,
          total_price: itemTotal,
          owner_id: inventoryItem.owner_id,
          item_cost: unitCost,
          income: income,
          inventoryItem: inventoryItem
        });
      }
      
      // Create sale record
      // For credit payment, set is_paid to false; for cash/mobile, set to true with paid_date
      const isPaid = payment_method !== 'credit';
      const sale = await Sale.create({
        total_amount: totalAmount,
        payment_method: payment_method || 'cash',
        is_paid: isPaid,
        paid_date: isPaid ? new Date() : null,
        customer_name,
        customer_phone,
        notes
      }, { transaction });
      
      // Create sale items and update inventory
      for (const saleItemData of saleItemsData) {
        // Insert sale item
        await SaleItem.create({
          sale_id: sale.id,
          inventory_item_id: saleItemData.inventory_item_id,
          quantity: saleItemData.quantity,
          unit_price: saleItemData.unit_price,
          total_price: saleItemData.total_price,
          owner_id: saleItemData.owner_id
        }, { transaction });
        
        // Update inventory quantity
        await saleItemData.inventoryItem.decrement('quantity', { 
          by: saleItemData.quantity,
          transaction 
        });
      }
      
      // Calculate income per owner
      const ownerIncomes = {};
      for (const saleItemData of saleItemsData) {
        if (!ownerIncomes[saleItemData.owner_id]) {
          ownerIncomes[saleItemData.owner_id] = {
            total_sales: 0,
            total_profit: 0,
            total_items_sold: 0
          };
        }
        ownerIncomes[saleItemData.owner_id].total_sales += saleItemData.total_price;
        ownerIncomes[saleItemData.owner_id].total_profit += saleItemData.income;
        ownerIncomes[saleItemData.owner_id].total_items_sold += saleItemData.quantity;
      }
      
      // Update income summaries ONLY if the sale is paid (not credit or already paid)
      if (isPaid) {
        const today = new Date().toISOString().split('T')[0];
        for (const [ownerId, incomeData] of Object.entries(ownerIncomes)) {
          const [summary, created] = await IncomeSummary.findOrCreate({
            where: { owner_id: ownerId, date: today },
            defaults: {
              owner_id: ownerId,
              date: today,
              total_sales: incomeData.total_sales,
              total_profit: incomeData.total_profit,
              total_items_sold: incomeData.total_items_sold
            },
            transaction
          });
          
          // If already exists, increment the values
          if (!created) {
            await summary.increment({
              total_sales: incomeData.total_sales,
              total_profit: incomeData.total_profit,
              total_items_sold: incomeData.total_items_sold
            }, { transaction });
          }
        }
      }
      
      await transaction.commit();
      
      // Fetch the created sale with items using Sequelize
      const completeSale = await Sale.findByPk(sale.id, {
        include: [{
          model: SaleItem,
          as: 'items',
          include: [{
            model: InventoryItem,
            as: 'inventoryItem',
            attributes: ['name']
          }]
        }]
      });
      
      // Send notifications after successful transaction
      const notificationService = require('../services/notificationService');
      
      try {
        // Get all active devices with their notification preferences
        // Exclude the device that created the sale from receiving the sales notification
        const devicesResult = await pool.query(
          'SELECT push_token, low_stock_alerts, sales_notifications FROM devices WHERE is_active = true'
        );
        
        console.log(`📱 Found ${devicesResult.rows.length} active device(s) for notifications`);
        
        if (devicesResult.rows.length === 0) {
          console.log('⚠️ No active devices found. Notifications will not be sent.');
        } else {
          // Send sales notification to devices that have it enabled
          // EXCLUDE the device that created this sale
          const salesTokens = devicesResult.rows
            .filter(device => device.sales_notifications)
            .filter(device => device.push_token !== device_push_token) // Exclude creating device
            .map(device => device.push_token);
          
          if (salesTokens.length > 0) {
            console.log(`💰 Sending sales notification for sale #${sale.id} to ${salesTokens.length} device(s) (excluding creator)`);
            await notificationService.sendDailySalesNotification(salesTokens, {
              sale_id: sale.id,
              total_amount: totalAmount,
              items_count: saleItemsData.length,
            });
          } else {
            console.log('⚠️ No other devices to notify about this sale');
          }
        }
      } catch (notifError) {
        // Don't fail the sale if notification fails
        console.error('❌ Error sending notifications:', notifError.message);
      }
      
      res.status(201).json({
        message: 'Sale created successfully',
        sale: completeSale
      });
      
    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }
      console.error('Create sale error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getSales(req, res) {
    try {
      const { page = 1, limit = 20, start_date, end_date, owner_id, search, payment_method, sortBy = 'sale_date', sortOrder = 'DESC' } = req.query;
      const offset = (page - 1) * limit;

      // Build WHERE conditions for filtering sales
      let whereConditions = [];
      let params = [];
      let paramCount = 0;

      // Date filters
      if (start_date) {
        paramCount++;
        whereConditions.push(`s.sale_date >= $${paramCount}`);
        params.push(start_date);
      }
      
      if (end_date) {
        paramCount++;
        whereConditions.push(`s.sale_date <= $${paramCount}`);
        params.push(end_date + ' 23:59:59');
      }

      // Payment method filter
      if (payment_method) {
        paramCount++;
        whereConditions.push(`s.payment_method = $${paramCount}`);
        params.push(payment_method);
      }

      // Search filter - customer name, phone, or item name
      if (search) {
        paramCount++;
        whereConditions.push(`(
          s.customer_name ILIKE $${paramCount} 
          OR s.customer_phone ILIKE $${paramCount}
          OR EXISTS (
            SELECT 1 FROM sale_items si2
            JOIN inventory_items i2 ON si2.inventory_item_id = i2.id
            WHERE si2.sale_id = s.id AND i2.name ILIKE $${paramCount}
          )
        )`);
        params.push(`%${search}%`);
      }

      // Build the WHERE clause
      const whereClause = whereConditions.length > 0 
        ? 'WHERE ' + whereConditions.join(' AND ')
        : '';

      // Sorting - validate and sanitize sort parameters
      const validSortFields = ['sale_date', 'total_amount', 'payment_method', 'customer_name'];
      const validSortOrders = ['ASC', 'DESC'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'sale_date';
      const sortDirection = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // Main query - get filtered sales with items
      let query = `
        SELECT s.*, 
               json_agg(
                 json_build_object(
                   'id', si.id,
                   'inventory_item_id', si.inventory_item_id,
                   'item_name', i.name,
                   'quantity', si.quantity,
                   'unit_price', si.unit_price,
                   'total_price', si.total_price,
                   'owner_id', si.owner_id,
                   'owner_name', o.full_name
                 )
               ) as items
        FROM sales s
        ${whereClause}
        ORDER BY s.${sortField} ${sortDirection}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      
      // Add the items join as a lateral subquery
      query = `
        SELECT filtered_sales.*, 
               (
                 SELECT json_agg(
                   json_build_object(
                     'id', si.id,
                     'inventory_item_id', si.inventory_item_id,
                     'item_name', i.name,
                     'quantity', si.quantity,
                     'unit_price', si.unit_price,
                     'total_price', si.total_price,
                     'owner_id', si.owner_id,
                     'owner_name', o.full_name
                   )
                 )
                 FROM sale_items si
                 JOIN inventory_items i ON si.inventory_item_id = i.id
                 JOIN owners o ON si.owner_id = o.id
                 WHERE si.sale_id = filtered_sales.id
               ) as items
        FROM (
          SELECT s.*
          FROM sales s
          ${whereClause}
          ${owner_id ? `AND EXISTS (
            SELECT 1 FROM sale_items si3
            WHERE si3.sale_id = s.id AND si3.owner_id = $${paramCount + 3}
          )` : ''}
          ORDER BY s.${sortField} ${sortDirection}
          LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        ) as filtered_sales
      `;
      
      params.push(limit, offset);
      if (owner_id) {
        params.push(owner_id);
      }

      const result = await pool.query(query, params);

      // Get total count - reuse the same WHERE conditions
      let countQuery = `
        SELECT COUNT(*) 
        FROM sales s
        ${whereClause}
        ${owner_id ? `AND EXISTS (
          SELECT 1 FROM sale_items si3
          WHERE si3.sale_id = s.id AND si3.owner_id = $${paramCount + 3}
        )` : ''}
      `;
      
      // Reuse the same params for count (excluding limit and offset)
      const countParams = params.slice(0, owner_id ? paramCount + 1 : paramCount);

      const countResult = await pool.query(countQuery, countParams);

      res.json({
        sales: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          pages: Math.ceil(countResult.rows[0].count / limit)
        }
      });
    } catch (error) {
      console.error('Get sales error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getSale(req, res) {
    try {
      const { id } = req.params;
      
      let query = `
        SELECT s.*, 
               json_agg(
                 json_build_object(
                   'id', si.id,
                   'inventory_item_id', si.inventory_item_id,
                   'item_name', i.name,
                   'quantity', si.quantity,
                   'unit_price', si.unit_price,
                   'total_price', si.total_price,
                   'owner_id', si.owner_id,
                   'owner_name', o.full_name
                 )
               ) as items
        FROM sales s
        JOIN sale_items si ON s.id = si.sale_id
        JOIN inventory_items i ON si.inventory_item_id = i.id
        JOIN owners o ON si.owner_id = o.id
        WHERE s.id = $1
      `;
      let params = [id];

      // Everyone can see all sales (no admin restriction)
      query += ` GROUP BY s.id`;

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Sale not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get sale error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async markAsPaid(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      
      // Find the sale
      const sale = await Sale.findByPk(id, { transaction });
      
      if (!sale) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Sale not found' });
      }
      
      // Check if already paid
      if (sale.is_paid) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Sale is already marked as paid' });
      }
      
      // Get the sale date (original transaction date)
      const saleDate = new Date(sale.sale_date).toISOString().split('T')[0];
      
      // Mark as paid
      sale.is_paid = true;
      sale.paid_date = new Date();
      await sale.save({ transaction });
      
      // Get sale items with inventory details to calculate income
      const saleItems = await SaleItem.findAll({
        where: { sale_id: id },
        include: [{
          model: InventoryItem,
          as: 'inventoryItem',
          attributes: ['unit_price', 'selling_price']
        }],
        transaction
      });
      
      // Calculate income per owner based on the ORIGINAL sale date
      const ownerIncomes = {};
      for (const saleItem of saleItems) {
        if (!ownerIncomes[saleItem.owner_id]) {
          ownerIncomes[saleItem.owner_id] = {
            total_sales: 0,
            total_profit: 0,
            total_items_sold: 0
          };
        }
        
        const itemTotal = Number(saleItem.total_price);
        const unitCost = Number(saleItem.inventoryItem.unit_price);
        const income = (Number(saleItem.unit_price) - unitCost) * saleItem.quantity;
        
        ownerIncomes[saleItem.owner_id].total_sales += itemTotal;
        ownerIncomes[saleItem.owner_id].total_profit += income;
        ownerIncomes[saleItem.owner_id].total_items_sold += saleItem.quantity;
      }
      
      // Update income summaries for the ORIGINAL sale date (not today)
      for (const [ownerId, incomeData] of Object.entries(ownerIncomes)) {
        const [summary, created] = await IncomeSummary.findOrCreate({
          where: { owner_id: ownerId, date: saleDate },
          defaults: {
            owner_id: ownerId,
            date: saleDate,
            total_sales: incomeData.total_sales,
            total_profit: incomeData.total_profit,
            total_items_sold: incomeData.total_items_sold
          },
          transaction
        });
        
        // If already exists, increment the values
        if (!created) {
          await summary.increment({
            total_sales: incomeData.total_sales,
            total_profit: incomeData.total_profit,
            total_items_sold: incomeData.total_items_sold
          }, { transaction });
        }
      }
      
      await transaction.commit();
      
      res.json({
        message: 'Sale marked as paid successfully',
        sale: {
          id: sale.id,
          is_paid: sale.is_paid,
          paid_date: sale.paid_date,
          sale_date: sale.sale_date
        }
      });
      
    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }
      console.error('Mark as paid error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateSale(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      const { items, customer_name, customer_phone, notes, payment_method } = req.body;
      
      // Find the sale
      const sale = await Sale.findByPk(id, { transaction });
      
      if (!sale) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Sale not found' });
      }

      // If sale is paid, don't allow editing
      if (sale.is_paid) {
        await transaction.rollback();
        return res.status(400).json({ error: 'Cannot edit a paid sale' });
      }
      
      // Get old sale items to restore inventory
      const oldSaleItems = await SaleItem.findAll({
        where: { sale_id: id },
        include: [{
          model: InventoryItem,
          as: 'inventoryItem'
        }],
        transaction
      });
      
      // Restore inventory for old items
      for (const saleItem of oldSaleItems) {
        await saleItem.inventoryItem.increment('quantity', {
          by: saleItem.quantity,
          transaction
        });
      }
      
      // Delete old sale items
      await SaleItem.destroy({
        where: { sale_id: id },
        transaction
      });
      
      // Validate new items
      let totalAmount = 0;
      const saleItemsData = [];
      
      for (const item of items) {
        const inventoryItem = await InventoryItem.findOne({
          where: { id: item.inventory_item_id, is_active: true },
          transaction
        });
        
        if (!inventoryItem) {
          await transaction.rollback();
          return res.status(400).json({ error: `Item with ID ${item.inventory_item_id} not found` });
        }
        
        if (inventoryItem.quantity < item.quantity) {
          await transaction.rollback();
          return res.status(400).json({ 
            error: `Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.quantity}, Requested: ${item.quantity}` 
          });
        }
        
        const itemTotal = Number(inventoryItem.selling_price) * item.quantity;
        totalAmount += itemTotal;
        
        saleItemsData.push({
          inventory_item_id: item.inventory_item_id,
          quantity: item.quantity,
          unit_price: inventoryItem.selling_price,
          total_price: itemTotal,
          owner_id: inventoryItem.owner_id,
          inventoryItem: inventoryItem
        });
      }
      
      // Update sale
      sale.total_amount = totalAmount;
      sale.customer_name = customer_name || null;
      sale.customer_phone = customer_phone || null;
      sale.notes = notes || null;
      sale.payment_method = payment_method || sale.payment_method;
      await sale.save({ transaction });
      
      // Create new sale items and update inventory
      for (const saleItemData of saleItemsData) {
        await SaleItem.create({
          sale_id: sale.id,
          inventory_item_id: saleItemData.inventory_item_id,
          quantity: saleItemData.quantity,
          unit_price: saleItemData.unit_price,
          total_price: saleItemData.total_price,
          owner_id: saleItemData.owner_id
        }, { transaction });
        
        // Decrease inventory
        await saleItemData.inventoryItem.decrement('quantity', {
          by: saleItemData.quantity,
          transaction
        });
      }
      
      await transaction.commit();
      
      // Fetch updated sale
      const updatedSale = await Sale.findByPk(id, {
        include: [{
          model: SaleItem,
          as: 'items',
          include: [{
            model: InventoryItem,
            as: 'inventoryItem',
            attributes: ['name']
          }]
        }]
      });
      
      res.json({
        message: 'Sale updated successfully',
        sale: updatedSale
      });
      
    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }
      console.error('Update sale error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deleteSale(req, res) {
    const transaction = await sequelize.transaction();
    
    try {
      const { id } = req.params;
      
      // Find the sale
      const sale = await Sale.findByPk(id, { transaction });
      
      if (!sale) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Sale not found' });
      }

      // Get sale items
      const saleItems = await SaleItem.findAll({
        where: { sale_id: id },
        include: [{
          model: InventoryItem,
          as: 'inventoryItem'
        }],
        transaction
      });
      
      // Restore inventory
      for (const saleItem of saleItems) {
        await saleItem.inventoryItem.increment('quantity', {
          by: saleItem.quantity,
          transaction
        });
      }
      
      // If sale was paid, adjust income summary
      if (sale.is_paid) {
        const saleDate = new Date(sale.sale_date).toISOString().split('T')[0];
        
        // Calculate income to remove
        const ownerIncomes = {};
        for (const saleItem of saleItems) {
          if (!ownerIncomes[saleItem.owner_id]) {
            ownerIncomes[saleItem.owner_id] = {
              total_sales: 0,
              total_profit: 0,
              total_items_sold: 0
            };
          }
          
          const itemTotal = Number(saleItem.total_price);
          const unitCost = Number(saleItem.inventoryItem.unit_price);
          const income = (Number(saleItem.unit_price) - unitCost) * saleItem.quantity;
          
          ownerIncomes[saleItem.owner_id].total_sales += itemTotal;
          ownerIncomes[saleItem.owner_id].total_profit += income;
          ownerIncomes[saleItem.owner_id].total_items_sold += saleItem.quantity;
        }
        
        // Decrement income summaries
        for (const [ownerId, incomeData] of Object.entries(ownerIncomes)) {
          const summary = await IncomeSummary.findOne({
            where: { owner_id: ownerId, date: saleDate },
            transaction
          });
          
          if (summary) {
            // Decrement the values
            await summary.decrement({
              total_sales: incomeData.total_sales,
              total_profit: incomeData.total_profit,
              total_items_sold: incomeData.total_items_sold
            }, { transaction });
          }
        }
      }
      
      // Delete sale items
      await SaleItem.destroy({
        where: { sale_id: id },
        transaction
      });
      
      // Delete sale
      await sale.destroy({ transaction });
      
      await transaction.commit();
      
      res.json({
        message: 'Sale deleted successfully',
        sale_id: id
      });
      
    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }
      console.error('Delete sale error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = SalesController;