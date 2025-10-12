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
      const { items, payment_method, customer_name, customer_phone, notes } = req.body;
      
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
      const sale = await Sale.create({
        total_amount: totalAmount,
        payment_method: payment_method || 'cash',
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
      
      // Update income summaries
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
        const devicesResult = await pool.query(
          'SELECT push_token, low_stock_alerts, sales_notifications FROM devices WHERE is_active = true'
        );
        
        console.log(`📱 Found ${devicesResult.rows.length} active device(s) for notifications`);
        
        if (devicesResult.rows.length === 0) {
          console.log('⚠️ No active devices found. Notifications will not be sent.');
        } else {
          // 1. Check for low stock items and send alerts
          const lowStockTokens = devicesResult.rows
            .filter(device => device.low_stock_alerts)
            .map(device => device.push_token);
          
          if (lowStockTokens.length > 0) {
            for (const saleItemData of saleItemsData) {
              const updatedItem = await InventoryItem.findByPk(saleItemData.inventory_item_id);
              if (updatedItem && updatedItem.quantity <= updatedItem.minimum_stock) {
                console.log(`📉 Low stock detected: ${updatedItem.name} (${updatedItem.quantity}/${updatedItem.minimum_stock})`);
                console.log(`   Sending to ${lowStockTokens.length} device(s) with low stock alerts enabled`);
                await notificationService.sendLowStockAlert(lowStockTokens, {
                  id: updatedItem.id,
                  name: updatedItem.name,
                  current_quantity: updatedItem.quantity,
                  minimum_stock: updatedItem.minimum_stock,
                });
              }
            }
          } else {
            console.log('⚠️ No devices have low stock alerts enabled');
          }
          
          // 2. Send sales notification to devices that have it enabled
          const salesTokens = devicesResult.rows
            .filter(device => device.sales_notifications)
            .map(device => device.push_token);
          
          if (salesTokens.length > 0) {
            console.log(`💰 Sending sales notification for sale #${sale.id} to ${salesTokens.length} device(s)`);
            await notificationService.sendDailySalesNotification(salesTokens, {
              sale_id: sale.id,
              total_amount: totalAmount,
              items_count: saleItemsData.length,
            });
          } else {
            console.log('⚠️ No devices have sales notifications enabled');
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
      const { page = 1, limit = 20, start_date, end_date, owner_id } = req.query;
      const offset = (page - 1) * limit;

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
        WHERE 1=1
      `;
      let params = [];
      let paramCount = 0;

      // Date filters
      if (start_date) {
        paramCount++;
        query += ` AND s.sale_date >= $${paramCount}`;
        params.push(start_date);
      }
      
      if (end_date) {
        paramCount++;
        query += ` AND s.sale_date <= $${paramCount}`;
        params.push(end_date + ' 23:59:59');
      }

      // Everyone can see all sales (no admin restriction)
      // Apply owner filter if requested
      if (owner_id) {
        paramCount++;
        query += ` AND si.owner_id = $${paramCount}`;
        params.push(owner_id);
      }

      query += ` GROUP BY s.id ORDER BY s.sale_date DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      let countQuery = `
        SELECT COUNT(DISTINCT s.id) 
        FROM sales s
        JOIN sale_items si ON s.id = si.sale_id
        WHERE 1=1
      `;
      let countParams = [];
      let countParamCount = 0;

      if (start_date) {
        countParamCount++;
        countQuery += ` AND s.sale_date >= $${countParamCount}`;
        countParams.push(start_date);
      }
      
      if (end_date) {
        countParamCount++;
        countQuery += ` AND s.sale_date <= $${countParamCount}`;
        countParams.push(end_date + ' 23:59:59');
      }

      // Everyone can see all sales (no admin restriction)
      if (owner_id) {
        countParamCount++;
        countQuery += ` AND si.owner_id = $${countParamCount}`;
        countParams.push(owner_id);
      }

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
}

module.exports = SalesController;