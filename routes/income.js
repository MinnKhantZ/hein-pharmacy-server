const express = require('express');
const IncomeController = require('../controllers/incomeController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All income routes require authentication
router.use(authenticateToken);

// Get income summary
router.get('/summary', IncomeController.getIncomeSummary);

// Get daily income
router.get('/daily', IncomeController.getDailyIncome);

// Get monthly income
router.get('/monthly', IncomeController.getMonthlyIncome);

// Get income by category
router.get('/by-category', IncomeController.getIncomeByCategory);

// Get top selling items
router.get('/top-selling', IncomeController.getTopSellingItems);

// Get overall statistics
router.get('/stats', IncomeController.getOverallStats);

module.exports = router;