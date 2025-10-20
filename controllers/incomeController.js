const IncomeSummary = require('../models/income_summary');
const Owner = require('../models/owner');
const { Op } = require('sequelize');
const pool = require('../config/database');

class IncomeController {
  static async getIncomeSummary(req, res) {
    try {
      const { period } = req.query;
      
      const whereClause = {};
      
      // Calculate date range based on period
      if (period) {
        const now = new Date();
        let startDate;
        
        if (period === 'daily') {
          // Last 30 days
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 30);
        } else if (period === 'monthly') {
          // Last 12 months
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 12);
        } else if (period === 'yearly') {
          // Last 5 years
          startDate = new Date(now);
          startDate.setFullYear(startDate.getFullYear() - 5);
        }
        
        if (startDate) {
          whereClause.date = {
            [Op.gte]: startDate.toISOString().split('T')[0]
          };
        }
      }

      const summaries = await IncomeSummary.findAll({
        where: whereClause,
        include: [{
          model: Owner,
          as: 'owner',
          attributes: ['id', 'full_name', 'username', 'email']
        }],
        order: [['date', 'DESC']],
        limit: 100
      });

      const formattedSummaries = summaries.map(summary => ({
        id: summary.id,
        owner_id: summary.owner_id,
        owner_name: summary.owner ? summary.owner.full_name : 'Unknown',
        period: summary.date,
        total_sales: summary.total_sales,
        total_income: summary.total_profit,
        item_count: summary.total_items_sold
      }));

      res.json({ summaries: formattedSummaries });
    } catch (error) {
      console.error('Get income summary error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getDailyIncome(req, res) {
    try {
      const { start_date, end_date, owner_id } = req.query;
      
      let query = `
        SELECT 
          ins.date,
          owner_id,
          o.full_name as owner_name,
          total_sales,
          total_items_sold
        FROM income_summary ins
        JOIN owners o ON ins.owner_id = o.id
        WHERE 1=1
      `;
      let params = [];
      let paramCount = 0;

      // Date filters
      if (start_date) {
        paramCount++;
        query += ` AND ins.date >= $${paramCount}`;
        params.push(start_date);
      }
      
      if (end_date) {
        paramCount++;
        query += ` AND ins.date <= $${paramCount}`;
        params.push(end_date);
      }

      // Owner filter
      if (req.user.username !== 'admin') {
        paramCount++;
        query += ` AND ins.owner_id = $${paramCount}`;
        params.push(req.user.id);
      } else if (owner_id) {
        paramCount++;
        query += ` AND ins.owner_id = $${paramCount}`;
        params.push(owner_id);
      }

      query += ` ORDER BY ins.date DESC, total_sales DESC`;

      const result = await pool.query(query, params);

      res.json(result.rows);
    } catch (error) {
      console.error('Get daily income error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getMonthlyIncome(req, res) {
    try {
      const { year = new Date().getFullYear(), owner_id } = req.query;
      
      let query = `
        SELECT 
          EXTRACT(MONTH FROM date) as month,
          EXTRACT(YEAR FROM date) as year,
          owner_id,
          o.full_name as owner_name,
          SUM(total_sales) as total_sales,
          SUM(total_items_sold) as total_items_sold
        FROM income_summary ins
        JOIN owners o ON ins.owner_id = o.id
        WHERE EXTRACT(YEAR FROM date) = $1
      `;
      let params = [year];
      let paramCount = 1;

      // Owner filter
      if (req.user.username !== 'admin') {
        paramCount++;
        query += ` AND ins.owner_id = $${paramCount}`;
        params.push(req.user.id);
      } else if (owner_id) {
        paramCount++;
        query += ` AND ins.owner_id = $${paramCount}`;
        params.push(owner_id);
      }

      query += ` GROUP BY EXTRACT(MONTH FROM date), EXTRACT(YEAR FROM date), owner_id, o.full_name ORDER BY month, total_sales DESC`;

      const result = await pool.query(query, params);

      res.json(result.rows);
    } catch (error) {
      console.error('Get monthly income error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getIncomeByCategory(req, res) {
    try {
      const { start_date, end_date, owner_id } = req.query;
      
      let query = `
        SELECT 
          i.category,
          si.owner_id,
          o.full_name as owner_name,
          SUM(si.total_price) as total_sales,
          SUM(si.quantity) as total_items_sold
        FROM sale_items si
        JOIN inventory_items i ON si.inventory_item_id = i.id
        JOIN owners o ON si.owner_id = o.id
        JOIN sales s ON si.sale_id = s.id
        WHERE s.is_paid = TRUE
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

      // Owner filter
      if (req.user.username !== 'admin') {
        paramCount++;
        query += ` AND si.owner_id = $${paramCount}`;
        params.push(req.user.id);
      } else if (owner_id) {
        paramCount++;
        query += ` AND si.owner_id = $${paramCount}`;
        params.push(owner_id);
      }

      query += ` GROUP BY i.category, si.owner_id, o.full_name ORDER BY total_sales DESC`;

      const result = await pool.query(query, params);

      res.json(result.rows);
    } catch (error) {
      console.error('Get income by category error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getTopSellingItems(req, res) {
    try {
      const { start_date, end_date, owner_id, limit = 10 } = req.query;
      
      let query = `
        SELECT 
          i.id,
          i.name,
          i.category,
          si.owner_id,
          o.full_name as owner_name,
          SUM(si.quantity) as total_quantity_sold,
          SUM(si.total_price) as total_sales,
          AVG(si.unit_price) as avg_selling_price
        FROM sale_items si
        JOIN inventory_items i ON si.inventory_item_id = i.id
        JOIN owners o ON si.owner_id = o.id
        JOIN sales s ON si.sale_id = s.id
        WHERE s.is_paid = TRUE
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

      // Owner filter
      if (req.user.username !== 'admin') {
        paramCount++;
        query += ` AND si.owner_id = $${paramCount}`;
        params.push(req.user.id);
      } else if (owner_id) {
        paramCount++;
        query += ` AND si.owner_id = $${paramCount}`;
        params.push(owner_id);
      }

      query += ` GROUP BY i.id, i.name, i.category, si.owner_id, o.full_name 
                 ORDER BY total_quantity_sold DESC 
                 LIMIT $${paramCount + 1}`;
      params.push(limit);

      const result = await pool.query(query, params);

      res.json(result.rows);
    } catch (error) {
      console.error('Get top selling items error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getOverallStats(req, res) {
    try {
      const { start_date, end_date, owner_id } = req.query;
      
      let ownerFilter = '';
      let params = [];
      let paramCount = 0;

      // Date and owner filters
      let dateFilter = '';
      if (start_date) {
        paramCount++;
        dateFilter += ` AND s.sale_date >= $${paramCount}`;
        params.push(start_date);
      }
      
      if (end_date) {
        paramCount++;
        dateFilter += ` AND s.sale_date <= $${paramCount}`;
        params.push(end_date + ' 23:59:59');
      }

      if (req.user.username !== 'admin') {
        paramCount++;
        ownerFilter = ` AND si.owner_id = $${paramCount}`;
        params.push(req.user.id);
      } else if (owner_id) {
        paramCount++;
        ownerFilter = ` AND si.owner_id = $${paramCount}`;
        params.push(owner_id);
      }

      // Get overall statistics
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT s.id) as total_sales,
          SUM(si.total_price) as total_revenue,
          SUM(si.quantity) as total_items_sold,
          COUNT(DISTINCT si.owner_id) as active_owners,
          COUNT(DISTINCT si.inventory_item_id) as unique_items_sold,
          AVG(s.total_amount) as avg_sale_amount
        FROM sales s
        JOIN sale_items si ON s.id = si.sale_id
        WHERE s.is_paid = TRUE ${dateFilter} ${ownerFilter}
      `;

      const statsResult = await pool.query(statsQuery, params);

      res.json(statsResult.rows[0]);
    } catch (error) {
      console.error('Get overall stats error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = IncomeController;