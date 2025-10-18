const express = require('express');
const InventoryController = require('../controllers/inventoryController');
const { authenticateToken } = require('../middleware/auth');
const { validateInventoryItem } = require('../middleware/validation');

const router = express.Router();

// All inventory routes require authentication
router.use(authenticateToken);

// Get all items
router.get('/', InventoryController.getItems);

// Get categories
router.get('/categories', InventoryController.getCategories);

// Get owners
router.get('/owners', InventoryController.getOwners);

// Get low stock items
router.get('/low-stock', InventoryController.getLowStockItems);

// Get single item
router.get('/:id', InventoryController.getItem);

// Create new item
router.post('/', validateInventoryItem, InventoryController.createItem);

// Update item
router.put('/:id', validateInventoryItem, InventoryController.updateItem);

// Delete item (soft delete)
router.delete('/:id', InventoryController.deleteItem);

module.exports = router;