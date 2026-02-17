const { Expo } = require('expo-server-sdk');
require('dotenv').config();

/**
 * Notification Service to send push notifications via Expo Push API
 */
class NotificationService {
  constructor() {
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: true,
    });
  }

  /**
   * Send push notifications to multiple devices
   * @param {Array<string>} pushTokens - Array of Expo push tokens
   * @param {Object} notification - Notification object {title, body, data}
   * @returns {Promise<Object>} Response from Expo API
   */
  async sendPushNotifications(pushTokens, notification) {
    if (!pushTokens || pushTokens.length === 0) {
      console.log('No push tokens provided');
      return { success: false, message: 'No push tokens' };
    }

    const { title, body, data = {}, android = {}, ios = {} } = notification;

    // Filter valid Expo push tokens
    const validTokens = pushTokens.filter(token => 
      token && Expo.isExpoPushToken(token)
    );

    if (validTokens.length === 0) {
      console.log('No valid Expo push tokens');
      return { success: false, message: 'No valid tokens' };
    }

    // Build push notification messages
    const messages = validTokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
      channelId: 'default',
      android: {
        ...android,
      },
      ios: {
        ...ios,
      },
    }));

    try {
      // Chunk messages to handle large batches
      const messageChunks = this.expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of messageChunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('Error sending push notification chunk:', error);
        }
      }

      console.log('Push notification tickets:', tickets);

      // Check for errors in tickets
      const errors = tickets.filter(ticket => ticket.status === 'error');
      if (errors.length > 0) {
        console.error('Some notifications failed:', errors);
      }

      return { success: true, tickets };
    } catch (error) {
      console.error('Error sending push notification:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send low stock alert notification
   * @param {Array<string>} pushTokens - Array of device push tokens
   * @param {Object} item - Inventory item {name, current_quantity, minimum_stock}
   */
  async sendLowStockAlert(pushTokens, item) {
    console.log(`📤 Sending low stock alert for: ${item.name}`);
    const result = await this.sendPushNotifications(pushTokens, {
      title: '⚠️ Low Stock Alert',
      body: `${item.name} is running low! Only ${item.current_quantity} left (minimum: ${item.minimum_stock})`,
      data: {
        type: 'low_stock',
        item_id: item.id,
        item_name: item.name,
        current_quantity: item.current_quantity,
        minimum_stock: item.minimum_stock,
      },
      android: {
        tag: `low_stock_${item.id}`,
      },
      ios: {
        threadId: 'low_stock_alerts',
      },
    });
    
    if (result.success) {
      console.log(`✅ Low stock alert sent successfully`);
    } else {
      console.error(`❌ Low stock alert failed:`, result.error);
    }
    
    return result;
  }

  /**
   * Send daily sales notification
   * @param {Array<string>} pushTokens - Array of device push tokens
   * @param {Object} salesData - Sales data {total_amount, items_count}
   */
  async sendDailySalesNotification(pushTokens, salesData) {
    console.log(`📤 Sending sales notification for sale #${salesData.sale_id}`);
    const result = await this.sendPushNotifications(pushTokens, {
      title: '📊 New Sale Recorded',
      body: `Sale of ${salesData.total_amount} Ks completed. ${salesData.items_count} item(s) sold.`,
      data: {
        type: 'daily_sales',
        total_amount: salesData.total_amount,
        items_count: salesData.items_count,
        sale_id: salesData.sale_id,
      },
    });
    
    if (result.success) {
      console.log(`✅ Sales notification sent successfully`);
    } else {
      console.error(`❌ Sales notification failed:`, result.error);
    }
    
    return result;
  }

  /**
   * Send expiring items notification
   * @param {Array<string>} pushTokens - Array of device push tokens
   * @param {Array<Object>} items - Expiring inventory items {id, name, expiry_date}
   * @param {number} daysBefore - User-configured days-before-expiry window
   */
  async sendExpiryWindowAlert(pushTokens, items, daysBefore) {
    const safeItems = Array.isArray(items) ? items : [];

    if (safeItems.length === 0) {
      return { success: true, message: 'No expiring items to notify' };
    }

    const previewNames = safeItems.slice(0, 3).map((item) => item.name).join(', ');
    const moreCount = Math.max(0, safeItems.length - 3);
    const suffix = moreCount > 0 ? ` and ${moreCount} more` : '';

    const result = await this.sendPushNotifications(pushTokens, {
      title: '⏰ Expiration Alert',
      body: `${safeItems.length} item(s) expire within ${daysBefore} day(s): ${previewNames}${suffix}`,
      data: {
        type: 'expiry_window',
        days_before: daysBefore,
        item_count: safeItems.length,
        item_ids: safeItems.map((item) => item.id),
      },
    });

    if (result.success) {
      console.log(`✅ Expiration alert sent successfully (${safeItems.length} item(s))`);
    } else {
      console.error('❌ Expiration alert failed:', result.error);
    }

    return result;
  }

  /**
   * Send single item expiration alert
   * @param {Array<string>} pushTokens - Array of device push tokens
   * @param {Object} item - Expiring item {id, name, expiry_date}
   * @param {number} daysUntil - Days until expiry
   */
  async sendSingleExpiryAlert(pushTokens, item, daysUntil) {
    if (!item) return { success: false, message: 'No item provided' };

    // Ensure date is only YYYY-MM-DD
    let dateStr = item.expiry_date || 'N/A';
    if (typeof dateStr === 'object' && dateStr instanceof Date) {
      dateStr = dateStr.toISOString().split('T')[0];
    } else if (typeof dateStr === 'string' && dateStr.includes(' ')) {
      // Handle cases like "2026-02-16 00:00:00+00"
      dateStr = dateStr.split(' ')[0];
    } else if (typeof dateStr === 'string' && dateStr.includes('T')) {
      dateStr = dateStr.split('T')[0];
    }

    const result = await this.sendPushNotifications(pushTokens, {
      title: '⏰ Item Expiring Soon',
      body: `${item.name} will expire in ${daysUntil} day(s) (${dateStr})!`,
      data: {
        type: 'expiry_window',
        item_id: item.id,
        item_name: item.name,
        expiry_date: dateStr,
        days_until: daysUntil,
      },
      android: {
        tag: `expiry_${item.id}`,
      },
      ios: {
        threadId: 'expiry_alerts',
      },
    });

    if (result.success) {
      console.log(`✅ Single expiry alert sent for: ${item.name}`);
    } else {
      console.error(`❌ Single expiry alert failed for ${item.name}:`, result.error);
    }

    return result;
  }
}

module.exports = new NotificationService();
