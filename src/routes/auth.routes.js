const express = require('express');
const AuthController = require('../controllers/auth.controller');
const AuthMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * Auth Routes
 * All authentication-related endpoints
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles routing, delegates to controller
 * - Open/Closed: Easy to add new routes without modifying existing ones
 */

// Public routes (no authentication required)
router.post('/signup', AuthController.signup);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refreshToken);
router.get('/google', AuthController.googleAuth);
router.get('/callback', AuthController.googleCallback);

// Protected routes (authentication required)
router.get('/me', AuthMiddleware.verifyToken, AuthController.getCurrentUser);
router.post('/logout', AuthMiddleware.verifyToken, AuthController.logout);

module.exports = router;