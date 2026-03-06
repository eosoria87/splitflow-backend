const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');

/**
 * Group Controller
 * Handles all group-related business logic
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles group operations
 * - Dependency Inversion: Uses Supabase abstraction
 */
class GroupController {
  
  /**
 * Create a new group
 * POST /api/groups
 */
static async createGroup(req, res, next) {
  try {
    const { name, description, category } = req.body;
    const userId = req.user.id;

    // Validation
    if (!name || name.trim().length === 0) {
      throw ApiError.badRequest('Group name is required');
    }

    if (name.length > 100) {
      throw ApiError.badRequest('Group name must be less than 100 characters');
    }

    // Optional: Validate category
    const validCategories = ['travel', 'home', 'couple', 'friends', 'other'];
    if (category && !validCategories.includes(category)) {
      throw ApiError.badRequest(`Category must be one of: ${validCategories.join(', ')}`);
    }

    // Use service role client for admin operations
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Create group using admin client
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        category: category || null,
        created_by: userId
      })
      .select()
      .single();

    if (groupError) {
      console.error('Group creation error:', groupError);
      throw ApiError.internal('Failed to create group');
    }

    // Add creator as owner using admin client
    const { error: memberError } = await supabaseAdmin
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: userId,
        role: 'owner'
      });

    if (memberError) {
      console.error('Failed to add creator as member:', memberError);
      // Rollback: delete the group
      await supabaseAdmin.from('groups').delete().eq('id', group.id);
      throw ApiError.internal('Failed to create group');
    }

    res.status(201).json({
      message: 'Group created successfully',
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        category: group.category,
        created_by: group.created_by,
        created_at: group.created_at,
        role: 'owner'
      }
    });
  } catch (error) {
    next(error);
  }
}


  /**
   * Get all groups for the current user
   * GET /api/groups
   */
  static async getUserGroups(req, res, next) {
    try {
      const userId = req.user.id;

      // Use service role to bypass RLS
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

      // Get all groups where user is a member
      const { data: memberships, error } = await supabaseAdmin
        .from('group_members')
        .select(`
          role,
          joined_at,
          groups (
            id,
            name,
            description,
            created_by,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId)
        .order('joined_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch groups:', error);
        throw ApiError.internal('Failed to fetch groups');
      }

      // Transform the data
      const groups = memberships.map(membership => ({
        id: membership.groups.id,
        name: membership.groups.name,
        description: membership.groups.description,
        created_by: membership.groups.created_by,
        created_at: membership.groups.created_at,
        updated_at: membership.groups.updated_at,
        role: membership.role,
        joined_at: membership.joined_at
      }));

      res.status(200).json({
        groups,
        total: groups.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
 * Get a specific group by ID
 * GET /api/groups/:groupId
 */
static async getGroup(req, res, next) {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // Use service role to bypass RLS
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get group details
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      throw ApiError.notFound('Group not found');
    }

    // Get user's role in the group
    const { data: membership, error: memberError } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      throw ApiError.forbidden('You are not a member of this group');
    }

    // Get all members
    const { data: members, error: membersError } = await supabaseAdmin
      .from('group_members')
      .select(`
        user_id,
        role,
        joined_at,
        profiles (
          name,
          email
        )
      `)
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });

    if (membersError) {
      console.error('Failed to fetch members:', membersError);
    }

    res.status(200).json({
      group: {
        ...group,
        userRole: membership.role,
        members: members?.map(m => ({
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          name: m.profiles?.name,
          email: m.profiles?.email
        })) || []
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update group details
 * PUT /api/groups/:groupId
 * Only owner can update
 */
static async updateGroup(req, res, next) {
  try {
    const { groupId } = req.params;
    const { name, description, category } = req.body;
    const userId = req.user.id;

    // Validation
    if (!name || name.trim().length === 0) {
      throw ApiError.badRequest('Group name is required');
    }

    if (name.length > 100) {
      throw ApiError.badRequest('Group name must be less than 100 characters');
    }

    // Optional: Validate category
    const validCategories = ['travel', 'home', 'couple', 'friends', 'other'];
    if (category && !validCategories.includes(category)) {
      throw ApiError.badRequest(`Category must be one of: ${validCategories.join(', ')}`);
    }

    // Use service role to bypass RLS
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if user is owner
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (!membership || membership.role !== 'owner') {
      throw ApiError.forbidden('Only group owner can update group details');
    }

    // Update group
    const { data: updatedGroup, error } = await supabaseAdmin
      .from('groups')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        category: category || null
      })
      .eq('id', groupId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update group:', error);
      throw ApiError.internal('Failed to update group');
    }

    res.status(200).json({
      message: 'Group updated successfully',
      group: updatedGroup
    });
  } catch (error) {
    next(error);
  }
}

  /**
 * Delete a group
 * DELETE /api/groups/:groupId
 * Only owner can delete
 */
static async deleteGroup(req, res, next) {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    // Use service role to bypass RLS
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if user is owner
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (!membership || membership.role !== 'owner') {
      throw ApiError.forbidden('Only group owner can delete the group');
    }

    // Delete group (cascade will delete group_members)
    const { error } = await supabaseAdmin
      .from('groups')
      .delete()
      .eq('id', groupId);

    if (error) {
      console.error('Failed to delete group:', error);
      throw ApiError.internal('Failed to delete group');
    }

    res.status(200).json({
      message: 'Group deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add member to group
 * POST /api/groups/:groupId/members
 * Only owner can add members
 */
static async addMember(req, res, next) {
  try {
    const { groupId } = req.params;
    const { userId: newUserId, email } = req.body;
    const currentUserId = req.user.id;

    // Must provide either userId or email
    if (!newUserId && !email) {
      throw ApiError.badRequest('User ID or email is required');
    }

    // Use service role to bypass RLS
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if current user is owner
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', currentUserId)
      .single();

    if (!membership || membership.role !== 'owner') {
      throw ApiError.forbidden('Only group owner can add members');
    }

    // If email provided, find user by email
    let targetUserId = newUserId;
    if (email && !newUserId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (!profile) {
        throw ApiError.notFound('User with that email not found');
      }

      targetUserId = profile.id;
    }

    // Check if user is already a member
    const { data: existingMember } = await supabaseAdmin
      .from('group_members')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', targetUserId)
      .single();

    if (existingMember) {
      throw ApiError.badRequest('User is already a member of this group');
    }

    // Add member using admin client
    const { data: newMember, error } = await supabaseAdmin
      .from('group_members')
      .insert({
        group_id: groupId,
        user_id: targetUserId,
        role: 'member'
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to add member:', error);
      throw ApiError.internal('Failed to add member');
    }

    res.status(201).json({
      message: 'Member added successfully',
      member: newMember
    });
  } catch (error) {
    next(error);
  }
}

  /**
 * Remove member from group
 * DELETE /api/groups/:groupId/members/:userId
 * Only owner can remove members
 */
static async removeMember(req, res, next) {
  try {
    const { groupId, userId: targetUserId } = req.params;
    const currentUserId = req.user.id;

    // Use service role to bypass RLS
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if current user is owner
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', currentUserId)
      .single();

    if (!membership || membership.role !== 'owner') {
      throw ApiError.forbidden('Only group owner can remove members');
    }

    // Cannot remove yourself (owner)
    if (targetUserId === currentUserId) {
      throw ApiError.badRequest('Cannot remove yourself from the group');
    }

    // Remove member
    const { error } = await supabaseAdmin
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', targetUserId);

    if (error) {
      console.error('Failed to remove member:', error);
      throw ApiError.internal('Failed to remove member');
    }

    res.status(200).json({
      message: 'Member removed successfully'
    });
  } catch (error) {
    next(error);
  }
}
}

module.exports = GroupController;