const express = require('express');
const UnitConversionController = require('../controllers/unitConversionController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All unit conversion routes require authentication
router.use(authenticateToken);

// Get all conversions (optionally filter by ?item_id=)
router.get('/', UnitConversionController.getConversions);

// Create a new conversion
router.post('/', UnitConversionController.createConversion);

// Update conversion rate
router.put('/:id', UnitConversionController.updateConversion);

// Delete a conversion
router.delete('/:id', UnitConversionController.deleteConversion);

// Sync quantities between linked items
router.post('/:id/sync', UnitConversionController.syncQuantities);

module.exports = router;
