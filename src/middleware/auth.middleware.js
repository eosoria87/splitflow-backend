const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles authentication
 * - Dependency Inversion: Depends on Supabase abstraction
 */
class AuthMiddleware {
  
  /**
   * Verify JWT token from Authorization header
   */
  static async verifyToken(req, res, next) {
    try {
      // Extract token from header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw ApiError.unauthorized('No token provided');
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        throw ApiError.unauthorized('Invalid or expired token');
      }

      // Attach user to request object
      req.user = user;
      req.token = token;

      next();
    } catch (error) {
      // Pass error to global error handler
      if (error instanceof ApiError) {
        next(error);
      } else {
        next(ApiError.unauthorized('Authentication failed'));
      }
    }
  }

  /**
   * Optional authentication - doesn't fail if no token
   * Useful for public endpoints that behave differently for logged-in users
   */
  static async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          req.user = user;
          req.token = token;
        }
      }
      
      next();
    } catch (error) {
      // Continue without auth
      next();
    }
  }

  /**
   * Check if user has specific role in a group
   * Usage: checkGroupRole('owner')
   */
  static checkGroupRole(...allowedRoles) {
    return async (req, res, next) => {
      try {
        const { groupId } = req.params;
        const userId = req.user.id;

        if (!groupId) {
          throw ApiError.badRequest('Group ID is required');
        }

        // Query user's role in the group
        const { data: membership, error } = await supabase
          .from('group_members')
          .select('role')
          .eq('group_id', groupId)
          .eq('user_id', userId)
          .single();

        if (error || !membership) {
          throw ApiError.forbidden('You are not a member of this group');
        }

        if (!allowedRoles.includes(membership.role)) {
          throw ApiError.forbidden(`This action requires ${allowedRoles.join(' or ')} role`);
        }

        // Attach role to request
        req.userRole = membership.role;
        next();
      } catch (error) {
        if (error instanceof ApiError) {
          next(error);
        } else {
          next(ApiError.internal('Failed to verify group membership'));
        }
      }
    };
  }
}

module.exports = AuthMiddleware;