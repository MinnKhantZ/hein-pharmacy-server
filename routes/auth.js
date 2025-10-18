const express = require('express');
const AuthController = require('../controllers/authController');
const { validateOwnerRegistration, validateOwnerLogin } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', validateOwnerRegistration, AuthController.register);
router.post('/login', validateOwnerLogin, AuthController.login);

// Protected routes
router.post('/validate-token', authenticateToken, AuthController.validateToken);
router.get('/profile', authenticateToken, AuthController.getProfile);
router.put('/profile', authenticateToken, AuthController.updateProfile);
router.put('/change-password', authenticateToken, AuthController.changePassword);
router.get('/owners', authenticateToken, AuthController.getAllOwners);
router.post('/owners', authenticateToken, AuthController.createOwner);
router.put('/owners/:id', authenticateToken, AuthController.updateOwner);
router.put('/owners/:id/reset-password', authenticateToken, AuthController.resetOwnerPassword);
router.delete('/owners/:id', authenticateToken, AuthController.deleteOwner);

module.exports = router;