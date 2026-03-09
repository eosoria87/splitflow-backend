const ApiError = require('../utils/ApiError');
const SupabaseHelper = require('../helpers/supabase.helper');
const BalanceHelper = require('../helpers/balance.helper');

/**
 * Balance Controller
 * Handles balance calculation and settlement operations
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles balance/settlement operations
 * - Dependency Inversion: Uses helper abstractions
 */
class BalanceController {
  
  /**
   * Get group balances
   * GET /api/groups/:groupId/balances
   */
  static async getGroupBalances(req, res, next) {
    try {
      const { groupId } = req.params;
      const userId = req.user.id;

      const supabaseAdmin = SupabaseHelper.getAdminClient();

      // Verify user is a member
      const { isMember } = await SupabaseHelper.verifyGroupMembership(groupId, userId);

      if (!isMember) {
        throw ApiError.forbidden('You are not a member of this group');
      }

      // Get all expenses with participants
      const { data: expenses, error: expensesError } = await supabaseAdmin
        .from('expenses')
        .select('id, amount, paid_by, date')
        .eq('group_id', groupId);

      if (expensesError) {
        console.error('Failed to fetch expenses:', expensesError);
        throw ApiError.internal('Failed to fetch expenses');
      }

      // Get participants for each expense
      const expensesWithParticipants = await Promise.all(
        (expenses || []).map(async (expense) => {
          const { data: participants } = await supabaseAdmin
            .from('expense_participants')
            .select('user_id, share')
            .eq('expense_id', expense.id);

          return {
            ...expense,
            participants: participants || []
          };
        })
      );

      // Get all group members
      const members = await SupabaseHelper.getGroupMembers(groupId, true);

      // Calculate balances
      const balances = BalanceHelper.calculateBalances(expensesWithParticipants, members);

      // Get summary
      const summary = BalanceHelper.getBalanceSummary(balances);

      res.status(200).json({
        balances,
        summary
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get settlement suggestions
   * GET /api/groups/:groupId/settlements/suggestions
   */
  static async getSettlementSuggestions(req, res, next) {
    try {
      const { groupId } = req.params;
      const userId = req.user.id;

      const supabaseAdmin = SupabaseHelper.getAdminClient();

      // Verify user is a member
      const { isMember } = await SupabaseHelper.verifyGroupMembership(groupId, userId);

      if (!isMember) {
        throw ApiError.forbidden('You are not a member of this group');
      }

      // Get all expenses with participants
      const { data: expenses } = await supabaseAdmin
        .from('expenses')
        .select('id, amount, paid_by, date')
        .eq('group_id', groupId);

      // Get participants for each expense
      const expensesWithParticipants = await Promise.all(
        (expenses || []).map(async (expense) => {
          const { data: participants } = await supabaseAdmin
            .from('expense_participants')
            .select('user_id, share')
            .eq('expense_id', expense.id);

          return {
            ...expense,
            participants: participants || []
          };
        })
      );

      // Get all group members
      const members = await SupabaseHelper.getGroupMembers(groupId, true);

      // Calculate balances
      const balances = BalanceHelper.calculateBalances(expensesWithParticipants, members);

      // Optimize settlements
      const settlements = BalanceHelper.optimizeSettlements(balances);

      res.status(200).json({
        settlements,
        total: settlements.length,
        message: settlements.length === 0 
          ? 'All settled up! 🎉' 
          : `${settlements.length} settlement${settlements.length > 1 ? 's' : ''} needed`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Record a settlement (mark debt as paid)
   * POST /api/groups/:groupId/settlements
   */
  static async recordSettlement(req, res, next) {
    try {
      const { groupId } = req.params;
      const { from_user, to_user, amount, method, notes } = req.body;
      const userId = req.user.id;

      // Validation
      if (!from_user || !to_user) {
        throw ApiError.badRequest('From user and to user are required');
      }

      if (!amount || amount <= 0) {
        throw ApiError.badRequest('Amount must be greater than 0');
      }

      // User must be either the payer or receiver
      if (userId !== from_user && userId !== to_user) {
        throw ApiError.forbidden('You can only record settlements you are involved in');
      }

      const supabaseAdmin = SupabaseHelper.getAdminClient();

      // Verify both users are members
      const { isMember: fromIsMember } = await SupabaseHelper.verifyGroupMembership(groupId, from_user);
      const { isMember: toIsMember } = await SupabaseHelper.verifyGroupMembership(groupId, to_user);

      if (!fromIsMember || !toIsMember) {
        throw ApiError.badRequest('Both users must be members of this group');
      }

      // Create settlement record
      const { data: settlement, error } = await supabaseAdmin
        .from('settlements')
        .insert({
          group_id: groupId,
          from_user,
          to_user,
          amount: parseFloat(amount),
          method: method || null,
          notes: notes || null
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to record settlement:', error);
        throw ApiError.internal('Failed to record settlement');
      }

      res.status(201).json({
        message: 'Settlement recorded successfully',
        settlement
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get settlement history
   * GET /api/groups/:groupId/settlements
   */
  static async getSettlements(req, res, next) {
    try {
      const { groupId } = req.params;
      const userId = req.user.id;

      const supabaseAdmin = SupabaseHelper.getAdminClient();

      // Verify user is a member
      const { isMember } = await SupabaseHelper.verifyGroupMembership(groupId, userId);

      if (!isMember) {
        throw ApiError.forbidden('You are not a member of this group');
      }

      // Get all settlements
      const { data: settlements, error } = await supabaseAdmin
        .from('settlements')
        .select('*')
        .eq('group_id', groupId)
        .order('settled_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch settlements:', error);
        throw ApiError.internal('Failed to fetch settlements');
      }

      // Get user details for each settlement
      const settlementsWithDetails = await Promise.all(
        (settlements || []).map(async (settlement) => {
          const { data: fromProfile } = await supabaseAdmin
            .from('profiles')
            .select('name, email')
            .eq('id', settlement.from_user)
            .single();

          const { data: toProfile } = await supabaseAdmin
            .from('profiles')
            .select('name, email')
            .eq('id', settlement.to_user)
            .single();

          return {
            id: settlement.id,
            from_user: settlement.from_user,
            from_name: fromProfile?.name || 'Unknown',
            from_email: fromProfile?.email || '',
            to_user: settlement.to_user,
            to_name: toProfile?.name || 'Unknown',
            to_email: toProfile?.email || '',
            amount: parseFloat(settlement.amount),
            method: settlement.method,
            notes: settlement.notes,
            settled_at: settlement.settled_at,
            created_at: settlement.created_at
          };
        })
      );

      res.status(200).json({
        settlements: settlementsWithDetails,
        total: settlementsWithDetails.length
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = BalanceController;