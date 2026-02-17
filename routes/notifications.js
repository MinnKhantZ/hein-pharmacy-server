const express = require('express');
const router = express.Router();
const { authenticateCron } = require('../middleware/cronAuth');
const cronService = require('../services/cronService');

/**
 * POST /api/notifications/cron/low-stock
 * Endpoint to be called by external cron service to trigger low stock notifications
 * Requires X-Cron-Api-Key header for authentication
 */
router.post('/cron/low-stock', authenticateCron, async (req, res) => {
  try {
    console.log('🔔 Low stock notification cron endpoint called');
    
    // Call the same function that the internal cron job would call
    await cronService.checkAndNotifyLowStockPerDevice();
    
    res.json({ 
      success: true,
      message: 'Low stock notifications processed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error processing low stock notifications:', error);
    res.status(500).json({ 
      error: 'Failed to process low stock notifications',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/notifications/cron/expiry
 * Endpoint to be called by external cron service to trigger expiry notifications
 * Requires X-Cron-Api-Key header for authentication
 */
router.post('/cron/expiry', authenticateCron, async (req, res) => {
  try {
    console.log('⏰ Expiry notification cron endpoint called');

    await cronService.checkAndNotifyExpiryPerDevice();

    res.json({
      success: true,
      message: 'Expiry notifications processed successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error processing expiry notifications:', error);
    res.status(500).json({
      error: 'Failed to process expiry notifications',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/notifications/health
 * Health check endpoint for the notifications service (no auth required)
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'notifications',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
