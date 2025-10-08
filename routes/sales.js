const express = require('express');
const SalesController = require('../controllers/salesController');
const { authenticateToken } = require('../middleware/auth');
const { validateSale } = require('../middleware/validation');

const router = express.Router();

// All sales routes require authentication
router.use(authenticateToken);

// Get all sales
router.get('/', SalesController.getSales);

// Get single sale
router.get('/:id', SalesController.getSale);

// Create new sale
router.post('/', validateSale, SalesController.createSale);

module.exports = router;