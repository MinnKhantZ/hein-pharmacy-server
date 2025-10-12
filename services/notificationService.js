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

    const { title, body, data = {} } = notification;

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
}

module.exports = new NotificationService();
