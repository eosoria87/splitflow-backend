const { createClient } = require('@supabase/supabase-js');

/**
 * Supabase Helper
 * Provides utility functions for Supabase operations
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles Supabase client creation
 * - Dependency Inversion: Centralized client management
 */
class SupabaseHelper {
  
  /**
   * Get admin Supabase client (bypasses RLS)
   * Used for operations that require elevated permissions
   */
  static getAdminClient() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      throw new Error('Missing Supabase credentials in environment variables');
    }

    return createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  /**
   * Verify user is a member of a group
   * @param {string} groupId - Group UUID
   * @param {string} userId - User UUID
   * @returns {Promise<{isMember: boolean, role: string|null}>}
   */
  static async verifyGroupMembership(groupId, userId) {
    const supabaseAdmin = SupabaseHelper.getAdminClient();

    const { data: membership, error } = await supabaseAdmin
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (error || !membership) {
      return { isMember: false, role: null };
    }

    return { isMember: true, role: membership.role };
  }

  /**
 * Get all members of a group
 * @param {string} groupId - Group UUID
 * @param {boolean} includeProfiles - Whether to include profile details (default: true)
 * @returns {Promise<Array>}
 */
static async getGroupMembers(groupId, includeProfiles = true) {
  const supabaseAdmin = SupabaseHelper.getAdminClient();

  // Get group members
  const { data: members, error } = await supabaseAdmin
    .from('group_members')
    .select('user_id, role, joined_at')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });

  if (error) {
    throw error;
  }

  if (!includeProfiles || !members || members.length === 0) {
    return members || [];
  }

  // Manually fetch profiles for each member
  const membersWithProfiles = await Promise.all(
    members.map(async (member) => {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('name, email')
        .eq('id', member.user_id)
        .single();

      return {
        ...member,
        profiles: profile || null
      };
    })
  );

  return membersWithProfiles;
}
}

module.exports = SupabaseHelper;