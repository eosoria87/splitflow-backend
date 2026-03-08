const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const SupabaseHelper = require('../helpers/supabase.helper');

/**
 * Expense Controller
 * Handles all expense-related business logic
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles expense operations
 * - Dependency Inversion: Uses Supabase abstraction
 */
class ExpenseController {

  /**
   * Add expense to group
   * POST /api/groups/:groupId/expenses
   */
  static async addExpense(req, res, next) {
    try {
      const { groupId } = req.params;
      const { description, amount, category, date, splitType = 'equal' } = req.body;
      const userId = req.user.id;

      // Validation
      if (!description || description.trim().length === 0) {
        throw ApiError.badRequest('Description is required');
      }

      if (!amount || amount <= 0) {
        throw ApiError.badRequest('Amount must be greater than 0');
      }

      if (amount > 999999.99) {
        throw ApiError.badRequest('Amount is too large');
      }

      // Validate category (optional)
      const validCategories = ['food', 'transport', 'accommodation', 'entertainment', 'utilities', 'other'];
      if (category && !validCategories.includes(category)) {
        throw ApiError.badRequest(`Category must be one of: ${validCategories.join(', ')}`);
      }

      const supabaseAdmin = SupabaseHelper.getAdminClient();

      // Verify user is a member of the group
      const { isMember } = await SupabaseHelper.verifyGroupMembership(groupId, userId);

      if (!isMember) {
        throw ApiError.forbidden('You are not a member of this group');
      }

      // Get all group members for split calculation
      const members = await SupabaseHelper.getGroupMembers(groupId);

      if (!members || members.length === 0) {
        throw ApiError.internal('Failed to get group members');
      }

      // Create expense
      const { data: expense, error: expenseError } = await supabaseAdmin
        .from('expenses')
        .insert({
          group_id: groupId,
          description: description.trim(),
          amount: parseFloat(amount),
          paid_by: userId,
          category: category || null,
          date: date || new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (expenseError) {
        console.error('Expense creation error:', expenseError);
        throw ApiError.internal('Failed to create expense');
      }

      // Calculate equal split
      const sharePerPerson = parseFloat((amount / members.length).toFixed(2));
      
      // Create expense participants (equal split)
      const participants = members.map(member => ({
        expense_id: expense.id,
        user_id: member.user_id,
        share: sharePerPerson
      }));

      const { error: participantsError } = await supabaseAdmin
        .from('expense_participants')
        .insert(participants);

      if (participantsError) {
        console.error('Failed to add participants:', participantsError);
        // Rollback: delete expense
        await supabaseAdmin.from('expenses').delete().eq('id', expense.id);
        throw ApiError.internal('Failed to add expense participants');
      }

      res.status(201).json({
        message: 'Expense added successfully',
        expense: {
          id: expense.id,
          group_id: expense.group_id,
          description: expense.description,
          amount: expense.amount,
          paid_by: expense.paid_by,
          category: expense.category,
          date: expense.date,
          created_at: expense.created_at,
          split_type: splitType,
          participants_count: members.length,
          share_per_person: sharePerPerson
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all expenses for a group
   * GET /api/groups/:groupId/expenses
   */
  static async getGroupExpenses(req, res, next) {
    try {
      const { groupId } = req.params;
      const userId = req.user.id;

      const supabaseAdmin = SupabaseHelper.getAdminClient();

      // Verify user is a member
      const { isMember } = await SupabaseHelper.verifyGroupMembership(groupId, userId);

      if (!isMember) {
        throw ApiError.forbidden('You are not a member of this group');
      }

      // Get all expenses with payer info
      const { data: expenses, error } = await supabaseAdmin
        .from('expenses')
        .select(`
          id,
          description,
          amount,
          paid_by,
          category,
          date,
          created_at,
          profiles!expenses_paid_by_fkey (
            name,
            email
          )
        `)
        .eq('group_id', groupId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch expenses:', error);
        throw ApiError.internal('Failed to fetch expenses');
      }

      // Get participants for each expense
      const expensesWithParticipants = await Promise.all(
        expenses.map(async (expense) => {
          const { data: participants } = await supabaseAdmin
            .from('expense_participants')
            .select('user_id, share')
            .eq('expense_id', expense.id);

          return {
            id: expense.id,
            description: expense.description,
            amount: parseFloat(expense.amount),
            paid_by: expense.paid_by,
            payer_name: expense.profiles?.name,
            payer_email: expense.profiles?.email,
            category: expense.category,
            date: expense.date,
            created_at: expense.created_at,
            participants: participants || [],
            participants_count: participants?.length || 0
          };
        })
      );

      res.status(200).json({
        expenses: expensesWithParticipants,
        total: expensesWithParticipants.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific expense details
   * GET /api/groups/:groupId/expenses/:expenseId
   */
  static async getExpense(req, res, next) {
    try {
      const { groupId, expenseId } = req.params;
      const userId = req.user.id;

      const supabaseAdmin = SupabaseHelper.getAdminClient();

      // Verify user is a member
      const { isMember } = await SupabaseHelper.verifyGroupMembership(groupId, userId);

      if (!isMember) {
        throw ApiError.forbidden('You are not a member of this group');
      }

      // Get expense
      const { data: expense, error: expenseError } = await supabaseAdmin
        .from('expenses')
        .select(`
          *,
          profiles!expenses_paid_by_fkey (
            name,
            email
          )
        `)
        .eq('id', expenseId)
        .eq('group_id', groupId)
        .single();

      if (expenseError || !expense) {
        throw ApiError.notFound('Expense not found');
      }

      // Get participants with user details
      const { data: participants } = await supabaseAdmin
        .from('expense_participants')
        .select(`
          user_id,
          share,
          profiles (
            name,
            email
          )
        `)
        .eq('expense_id', expenseId);

      res.status(200).json({
        expense: {
          id: expense.id,
          group_id: expense.group_id,
          description: expense.description,
          amount: parseFloat(expense.amount),
          paid_by: expense.paid_by,
          payer_name: expense.profiles?.name,
          payer_email: expense.profiles?.email,
          category: expense.category,
          date: expense.date,
          created_at: expense.created_at,
          updated_at: expense.updated_at,
          participants: participants?.map(p => ({
            user_id: p.user_id,
            share: parseFloat(p.share),
            name: p.profiles?.name,
            email: p.profiles?.email
          })) || []
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update expense
   * PUT /api/groups/:groupId/expenses/:expenseId
   * Only the person who paid can update
   */
  static async updateExpense(req, res, next) {
    try {
      const { groupId, expenseId } = req.params;
      const { description, amount, category, date } = req.body;
      const userId = req.user.id;

      // Validation
      if (description && description.trim().length === 0) {
        throw ApiError.badRequest('Description cannot be empty');
      }

      if (amount !== undefined && amount <= 0) {
        throw ApiError.badRequest('Amount must be greater than 0');
      }

      const supabaseAdmin = SupabaseHelper.getAdminClient();

      // Get expense and verify ownership
      const { data: expense } = await supabaseAdmin
        .from('expenses')
        .select('paid_by, group_id')
        .eq('id', expenseId)
        .single();

      if (!expense) {
        throw ApiError.notFound('Expense not found');
      }

      if (expense.group_id !== groupId) {
        throw ApiError.badRequest('Expense does not belong to this group');
      }

      if (expense.paid_by !== userId) {
        throw ApiError.forbidden('Only the person who paid can update this expense');
      }

      // Update expense
      const updateData = {};
      if (description) updateData.description = description.trim();
      if (amount) updateData.amount = parseFloat(amount);
      if (category !== undefined) updateData.category = category || null;
      if (date) updateData.date = date;

      const { data: updatedExpense, error } = await supabaseAdmin
        .from('expenses')
        .update(updateData)
        .eq('id', expenseId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update expense:', error);
        throw ApiError.internal('Failed to update expense');
      }

      // If amount changed, update participants' shares
      if (amount) {
        const { data: participants } = await supabaseAdmin
          .from('expense_participants')
          .select('user_id')
          .eq('expense_id', expenseId);

        const newSharePerPerson = parseFloat((amount / participants.length).toFixed(2));

        await supabaseAdmin
          .from('expense_participants')
          .update({ share: newSharePerPerson })
          .eq('expense_id', expenseId);
      }

      res.status(200).json({
        message: 'Expense updated successfully',
        expense: updatedExpense
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete expense
   * DELETE /api/groups/:groupId/expenses/:expenseId
   * Only the person who paid can delete
   */
  static async deleteExpense(req, res, next) {
    try {
      const { groupId, expenseId } = req.params;
      const userId = req.user.id;

      const supabaseAdmin = SupabaseHelper.getAdminClient();

      // Get expense and verify ownership
      const { data: expense } = await supabaseAdmin
        .from('expenses')
        .select('paid_by, group_id')
        .eq('id', expenseId)
        .single();

      if (!expense) {
        throw ApiError.notFound('Expense not found');
      }

      if (expense.group_id !== groupId) {
        throw ApiError.badRequest('Expense does not belong to this group');
      }

      if (expense.paid_by !== userId) {
        throw ApiError.forbidden('Only the person who paid can delete this expense');
      }

      // Delete expense (cascade will delete participants)
      const { error } = await supabaseAdmin
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (error) {
        console.error('Failed to delete expense:', error);
        throw ApiError.internal('Failed to delete expense');
      }

      res.status(200).json({
        message: 'Expense deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ExpenseController;