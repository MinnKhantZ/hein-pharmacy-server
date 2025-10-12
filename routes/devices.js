const express = require('express');
const DeviceController = require('../controllers/deviceController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All device routes require authentication
router.use(authenticateToken);

// Register or update a device
router.post('/register', DeviceController.registerDevice);

// Unregister a device
router.post('/unregister', DeviceController.unregisterDevice);

// Get my devices
router.get('/my-devices', DeviceController.getMyDevices);

// Get all devices (for admin/testing)
router.get('/all', DeviceController.getAllDevices);

// Update notification preferences
router.put('/preferences', DeviceController.updateNotificationPreferences);

// Test notification
router.post('/test-notification', DeviceController.testNotification);

module.exports = router;
