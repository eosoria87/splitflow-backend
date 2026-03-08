const express = require('express');
const ExpenseController = require('../controllers/expense.controller');
const AuthMiddleware = require('../middleware/auth.middleware');

const router = express.Router({ mergeParams: true });

/**
 * Expense Routes
 * All routes require authentication
 * Routes are nested under /api/groups/:groupId/expenses
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles routing
 * - Open/Closed: Easy to add new routes
 */

// Apply authentication to all expense routes
router.use(AuthMiddleware.verifyToken);

// ========================================
// EXPENSE ROUTES
// ========================================

/**
 * Add expense to group
 * POST /api/groups/:groupId/expenses
 * Body: { description, amount, category?, date? }
 */
router.post('/', ExpenseController.addExpense);

/**
 * Get all expenses for a group
 * GET /api/groups/:groupId/expenses
 */
router.get('/', ExpenseController.getGroupExpenses);

/**
 * Get specific expense details
 * GET /api/groups/:groupId/expenses/:expenseId
 */
router.get('/:expenseId', ExpenseController.getExpense);

/**
 * Update expense
 * PUT /api/groups/:groupId/expenses/:expenseId
 * Body: { description?, amount?, category?, date? }
 * Only the person who paid can update
 */
router.put('/:expenseId', ExpenseController.updateExpense);

/**
 * Delete expense
 * DELETE /api/groups/:groupId/expenses/:expenseId
 * Only the person who paid can delete
 */
router.delete('/:expenseId', ExpenseController.deleteExpense);

module.exports = router;