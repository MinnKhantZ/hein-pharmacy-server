const pool = require('../config/database');
const Device = require('../models/device');

class DeviceController {
  /**
   * Register or update a device push token
   */
  static async registerDevice(req, res) {
    try {
      const { 
        push_token, 
        device_id, 
        device_model,
        low_stock_alerts = true,
        sales_notifications = true,
        low_stock_alert_time = '09:00:00'
      } = req.body;
      const owner_id = req.user.id;

      if (!push_token) {
        return res.status(400).json({ error: 'Push token is required' });
      }

      // Register or update device
      const result = await pool.query(
        `INSERT INTO devices (
          owner_id, push_token, device_id, device_model, 
          low_stock_alerts, sales_notifications, low_stock_alert_time,
          last_active, created_at, updated_at
        ) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (push_token) 
         DO UPDATE SET 
           owner_id = EXCLUDED.owner_id,
           device_id = EXCLUDED.device_id,
           device_model = EXCLUDED.device_model,
           low_stock_alerts = EXCLUDED.low_stock_alerts,
           sales_notifications = EXCLUDED.sales_notifications,
           low_stock_alert_time = EXCLUDED.low_stock_alert_time,
           last_active = CURRENT_TIMESTAMP,
           is_active = true,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id, push_token, low_stock_alerts, sales_notifications, low_stock_alert_time`,
        [owner_id, push_token, device_id, device_model, low_stock_alerts, sales_notifications, low_stock_alert_time]
      );

      console.log(`✅ Device registered for owner ${owner_id}: ${push_token}`);

      res.json({ 
        message: 'Device registered successfully',
        device: result.rows[0]
      });
    } catch (error) {
      console.error('Device registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Unregister a device (mark as inactive)
   */
  static async unregisterDevice(req, res) {
    try {
      const { push_token } = req.body;
      const owner_id = req.user.id;

      if (!push_token) {
        return res.status(400).json({ error: 'Push token is required' });
      }

      const result = await pool.query(
        `UPDATE devices 
         SET is_active = false, updated_at = CURRENT_TIMESTAMP
         WHERE push_token = $1 AND owner_id = $2`,
        [push_token, owner_id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Device not found' });
      }

      console.log(`🔕 Device unregistered for owner ${owner_id}: ${push_token}`);

      res.json({ message: 'Device unregistered successfully' });
    } catch (error) {
      console.error('Device unregistration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get all devices for the current user
   */
  static async getMyDevices(req, res) {
    try {
      const owner_id = req.user.id;

      const result = await pool.query(
        `SELECT id, push_token, device_id, device_model, is_active, 
                low_stock_alerts, sales_notifications,
                last_active, created_at, updated_at
         FROM devices 
         WHERE owner_id = $1
         ORDER BY last_active DESC`,
        [owner_id]
      );

      res.json({
        devices: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      console.error('Get devices error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get all active devices (admin only)
   */
  static async getAllDevices(req, res) {
    try {
      const result = await pool.query(
        `SELECT d.id, d.push_token, d.device_id, d.device_model, d.is_active, 
                d.low_stock_alerts, d.sales_notifications,
                d.last_active, d.created_at, d.updated_at,
                o.username, o.full_name
         FROM devices d
         JOIN owners o ON d.owner_id = o.id
         WHERE d.is_active = true
         ORDER BY d.last_active DESC`
      );

      res.json({
        devices: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      console.error('Get all devices error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update notification preferences for a device
   */
  static async updateNotificationPreferences(req, res) {
    try {
      const { push_token, low_stock_alerts, sales_notifications, low_stock_alert_time } = req.body;
      const owner_id = req.user.id;

      if (!push_token) {
        return res.status(400).json({ error: 'Push token is required' });
      }

      const result = await pool.query(
        `UPDATE devices 
         SET low_stock_alerts = COALESCE($1, low_stock_alerts),
             sales_notifications = COALESCE($2, sales_notifications),
             low_stock_alert_time = COALESCE($3, low_stock_alert_time),
             updated_at = CURRENT_TIMESTAMP
         WHERE push_token = $4 AND owner_id = $5
         RETURNING id, push_token, low_stock_alerts, sales_notifications, low_stock_alert_time`,
        [low_stock_alerts, sales_notifications, low_stock_alert_time, push_token, owner_id]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Device not found' });
      }

      console.log(`⚙️ Notification preferences updated for device: ${push_token}`);

      res.json({
        message: 'Notification preferences updated successfully',
        device: result.rows[0]
      });
    } catch (error) {
      console.error('Update preferences error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Test notification - send a test push notification
   */
  static async testNotification(req, res) {
    try {
      const { push_token, title, body } = req.body;
      const notificationService = require('../services/notificationService');

      if (!push_token) {
        return res.status(400).json({ error: 'Push token is required' });
      }

      const result = await notificationService.sendPushNotifications(
        [push_token],
        {
          title: title || '🧪 Test Notification',
          body: body || 'This is a test notification from Hein Pharmacy',
          data: { type: 'test' }
        }
      );

      res.json({
        message: 'Test notification sent',
        result
      });
    } catch (error) {
      console.error('Test notification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = DeviceController;
