const express = require('express');
const GroupController = require('../controllers/group.controller');
const AuthMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

/**
 * Group Routes
 * All routes require authentication
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles routing
 * - Open/Closed: Easy to add new routes
 */

// Apply authentication to all group routes
router.use(AuthMiddleware.verifyToken);

// ========================================
// PUBLIC GROUP ROUTES (all authenticated users)
// ========================================

/**
 * Create a new group
 * POST /api/groups
 * Body: { name, description, category }
 */
router.post('/', GroupController.createGroup);

/**
 * Get all groups for current user
 * GET /api/groups
 */
router.get('/', GroupController.getUserGroups);

/**
 * Get specific group details
 * GET /api/groups/:groupId
 */
router.get('/:groupId', GroupController.getGroup);

/**
 * Update group details
 * PUT /api/groups/:groupId
 * Body: { name, description, category }
 * Only owner can update
 */
router.put('/:groupId', GroupController.updateGroup);

/**
 * Delete a group
 * DELETE /api/groups/:groupId
 * Only owner can delete
 */
router.delete('/:groupId', GroupController.deleteGroup);

// ========================================
// GROUP MEMBER ROUTES
// ========================================

/**
 * Add member to group
 * POST /api/groups/:groupId/members
 * Body: { userId } or { email }
 * Only owner can add members
 */
router.post('/:groupId/members', GroupController.addMember);

/**
 * Remove member from group
 * DELETE /api/groups/:groupId/members/:userId
 * Only owner can remove members
 */
router.delete('/:groupId/members/:userId', GroupController.removeMember);

module.exports = router;