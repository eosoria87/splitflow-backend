const express = require('express');
const BalanceController = require('../controllers/balance.controller');
const AuthMiddleware = require('../middleware/auth.middleware');

const router = express.Router({ mergeParams: true });

/**
 * Balance & Settlement Routes
 * All routes require authentication
 * Routes are nested under /api/groups/:groupId
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles routing
 * - Open/Closed: Easy to add new routes
 */

// Apply authentication to all routes
router.use(AuthMiddleware.verifyToken);

// ========================================
// BALANCE ROUTES
// ========================================

/**
 * Get group balances
 * GET /api/groups/:groupId/balances
 */
router.get('/balances', BalanceController.getGroupBalances);

// ========================================
// SETTLEMENT ROUTES
// ========================================

/**
 * Get settlement suggestions (optimized)
 * GET /api/groups/:groupId/settlements/suggestions
 */
router.get('/settlements/suggestions', BalanceController.getSettlementSuggestions);

/**
 * Get settlement history
 * GET /api/groups/:groupId/settlements
 */
router.get('/settlements', BalanceController.getSettlements);

/**
 * Record a settlement (mark as paid)
 * POST /api/groups/:groupId/settlements
 * Body: { from_user, to_user, amount, method?, notes? }
 */
router.post('/settlements', BalanceController.recordSettlement);

module.exports = router;