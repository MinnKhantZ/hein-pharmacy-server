const cron = require('node-cron');
const pool = require('../config/database');
const notificationService = require('./notificationService');

function getMyanmarTime() {
  // Myanmar Time = UTC + 6 hours 30 minutes
  const myanmarOffsetMs = ((6 * 60) + 30) * 60 * 1000;
  const myanmarNow = new Date(Date.now() + myanmarOffsetMs);

  const year = myanmarNow.getUTCFullYear();
  const month = String(myanmarNow.getUTCMonth() + 1).padStart(2, '0');
  const day = String(myanmarNow.getUTCDate()).padStart(2, '0');
  const hours = String(myanmarNow.getUTCHours()).padStart(2, '0');
  const minutes = String(myanmarNow.getUTCMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    hours,
    minutes,
    fullTime: `${hours}:${minutes}:00`,
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
    // Check every minute for devices that should receive time-based notifications
    // This allows per-device notification times
    const lowStockJob = cron.schedule('* * * * *', async () => {
      await this.checkAndNotifyLowStockPerDevice();
      await this.checkAndNotifyExpiryPerDevice();
    }, {
      scheduled: true,
      timezone: "Asia/Yangon" // Myanmar timezone
    });

    this.jobs.push({ name: 'deviceNotificationsPerMinute', job: lowStockJob });
    console.log('✅ Cron jobs started: Per-device low stock + expiry notifications (checking every minute)');
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
   * Check for expiring items and send notifications per device based on preferred time
   */
  async checkAndNotifyExpiryPerDevice() {
    try {
      const myanmarTime = getMyanmarTime();

      const devicesResult = await pool.query(`
        SELECT push_token, expiry_alert_days_before
        FROM devices
        WHERE is_active = true
          AND expiry_alerts = true
          AND expiry_alert_time::text LIKE $1
      `, [`${myanmarTime.hours}:${myanmarTime.minutes}%`]);

      if (devicesResult.rows.length === 0) {
        return;
      }

      const tokensByWindow = new Map();
      for (const row of devicesResult.rows) {
        const daysBefore = Number.isInteger(row.expiry_alert_days_before)
          ? row.expiry_alert_days_before
          : parseInt(row.expiry_alert_days_before, 10);
        const safeDays = Number.isNaN(daysBefore) ? 30 : Math.max(0, daysBefore);

        if (!tokensByWindow.has(safeDays)) {
          tokensByWindow.set(safeDays, []);
        }
        tokensByWindow.get(safeDays).push(row.push_token);
      }

      for (const [daysBefore, tokens] of tokensByWindow.entries()) {
        const expiringResult = await pool.query(`
          SELECT
            i.id,
            i.name,
            i.expiry_date
          FROM inventory_items i
          WHERE i.is_active = true
            AND i.expiry_date IS NOT NULL
            AND i.expiry_date >= $1::date
            AND i.expiry_date <= ($1::date + ($2::int * INTERVAL '1 day'))
          ORDER BY i.expiry_date ASC
        `, [myanmarTime.date, daysBefore]);

        const expiringItems = expiringResult.rows;
        if (expiringItems.length === 0) {
          continue;
        }

        const uniqueTokens = [...new Set(tokens)];
        console.log(`🔔 [${myanmarTime.fullTime}] Sending individual expiry alerts to ${uniqueTokens.length} device(s) for ${expiringItems.length} item(s)`);

        for (const item of expiringItems) {
          // Calculate exact days remaining for the notification body
          const expiryDate = new Date(item.expiry_date);
          const todayDate = new Date(myanmarTime.date);
          const diffMs = expiryDate.getTime() - todayDate.getTime();
          const daysUntil = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

          await notificationService.sendSingleExpiryAlert(uniqueTokens, item, daysUntil);
        }
      }
    } catch (error) {
      console.error('❌ Error in expiry notification cron job:', error);
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
