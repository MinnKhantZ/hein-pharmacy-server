const cron = require('node-cron');
const pool = require('../config/database');
const notificationService = require('./notificationService');

function getMyanmarTime() {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  
  // Myanmar Time = UTC + 6 hours 30 minutes
  let myanmarHours = utcHours + 6;
  let myanmarMinutes = utcMinutes + 30;
  
  // Handle overflows
  if (myanmarMinutes >= 60) {
    myanmarHours += 1;
    myanmarMinutes -= 60;
  }
  if (myanmarHours >= 24) {
    myanmarHours -= 24;
  }
  
  return {
    hours: String(myanmarHours).padStart(2, '0'),
    minutes: String(myanmarMinutes).padStart(2, '0'),
    fullTime: `${String(myanmarHours).padStart(2, '0')}:${String(myanmarMinutes).padStart(2, '0')}:00`
  };
}

class CronService {
  constructor() {
    this.jobs = [];
  }

  /**
   * Start all scheduled cron jobs
   */
  startJobs() {
    // Check every minute for devices that should receive low stock notifications
    // This allows per-device notification times
    const lowStockJob = cron.schedule('* * * * *', async () => {
      await this.checkAndNotifyLowStockPerDevice();
    }, {
      scheduled: true,
      timezone: "Asia/Yangon" // Myanmar timezone
    });

    this.jobs.push({ name: 'lowStockNotificationPerDevice', job: lowStockJob });
    console.log('✅ Cron jobs started: Per-device low stock notifications (checking every minute)');
  }

  /**
   * Check for low stock items and send notifications per device based on their preferred time
   */
  async checkAndNotifyLowStockPerDevice() {
    try {
      const myanmarTime = getMyanmarTime();
      
      const devicesResult = await pool.query(`
        SELECT push_token, low_stock_alert_time 
        FROM devices 
        WHERE is_active = true 
          AND low_stock_alerts = true
          AND low_stock_alert_time::text LIKE $1
      `, [`${myanmarTime.hours}:${myanmarTime.minutes}%`]);

      if (devicesResult.rows.length === 0) {
        return; // No devices to notify at this time
      }

      // Get all low stock items
      const lowStockResult = await pool.query(`
        SELECT 
          i.id,
          i.name,
          i.quantity as current_quantity,
          i.minimum_stock,
          i.category,
          o.full_name as owner_name
        FROM inventory_items i
        JOIN owners o ON i.owner_id = o.id
        WHERE i.is_active = true 
          AND i.quantity <= i.minimum_stock
        ORDER BY (i.quantity - i.minimum_stock) ASC
      `);

      const lowStockItems = lowStockResult.rows;

      if (lowStockItems.length === 0) {
        return; // No low stock items
      }

      const lowStockTokens = devicesResult.rows.map(d => d.push_token);
      
      console.log(`🔔 [${myanmarTime.fullTime}] Sending low stock alerts to ${lowStockTokens.length} device(s) for ${lowStockItems.length} item(s)`);

      // Send notification for each low stock item
      for (const item of lowStockItems) {
        await notificationService.sendLowStockAlert(lowStockTokens, {
          id: item.id,
          name: item.name,
          current_quantity: item.current_quantity,
          minimum_stock: item.minimum_stock,
        });
      }

      console.log('✅ Low stock notifications sent successfully');
    } catch (error) {
      console.error('❌ Error in low stock notification cron job:', error);
    }
  }

  /**
   * Legacy method - Check for low stock items and send notifications (kept for manual triggers)
   */
  async checkAndNotifyLowStock() {
    try {
      console.log('🔍 Checking for low stock items...');
      
      // Get all low stock items
      const lowStockResult = await pool.query(`
        SELECT 
          i.id,
          i.name,
          i.quantity as current_quantity,
          i.minimum_stock,
          i.category,
          o.full_name as owner_name
        FROM inventory_items i
        JOIN owners o ON i.owner_id = o.id
        WHERE i.is_active = true 
          AND i.quantity <= i.minimum_stock
        ORDER BY (i.quantity - i.minimum_stock) ASC
      `);

      const lowStockItems = lowStockResult.rows;

      if (lowStockItems.length === 0) {
        console.log('✅ No low stock items found');
        return;
      }

      console.log(`📉 Found ${lowStockItems.length} low stock item(s)`);

      // Get all active devices with low stock alerts enabled
      const devicesResult = await pool.query(`
        SELECT push_token 
        FROM devices 
        WHERE is_active = true AND low_stock_alerts = true
      `);

      const lowStockTokens = devicesResult.rows.map(d => d.push_token);

      if (lowStockTokens.length === 0) {
        console.log('⚠️ No devices have low stock alerts enabled');
        return;
      }

      console.log(`📱 Sending low stock alerts to ${lowStockTokens.length} device(s)`);

      // Send notification for each low stock item
      for (const item of lowStockItems) {
        await notificationService.sendLowStockAlert(lowStockTokens, {
          id: item.id,
          name: item.name,
          current_quantity: item.current_quantity,
          minimum_stock: item.minimum_stock,
        });
      }

      console.log('✅ Low stock notifications sent successfully');
    } catch (error) {
      console.error('❌ Error in low stock notification cron job:', error);
    }
  }

  /**
   * Stop all cron jobs
   */
  stopJobs() {
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      console.log(`🛑 Stopped cron job: ${name}`);
    });
    this.jobs = [];
  }

  /**
   * Get status of all jobs
   */
  getJobsStatus() {
    return this.jobs.map(({ name, job }) => ({
      name,
      running: job.running || false,
    }));
  }
}

module.exports = new CronService();
