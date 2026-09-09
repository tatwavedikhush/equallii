import { supabase } from '../database/supabaseClient';
import type { UserProfile } from '../context/AuthContext';

export interface GroupModel {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  created_by: string;
  created_at: string;
  members_count?: number;
  user_role?: 'owner' | 'member';
  creator_profile?: UserProfile | null;
}

export interface GroupMemberModel {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
  profile?: UserProfile | null;
}

export interface CreateGroupInput {
  name: string;
  description?: string;
  currency?: string;
  memberEmails?: string[];
}

export interface UpdateGroupInput {
  name?: string;
  description?: string;
  currency?: string;
}

export const groupsService = {
  /**
   * Fetch all groups that the current user belongs to
   */
  async fetchUserGroups(userId: string): Promise<{ data: GroupModel[] | null; error: string | null }> {
    try {
      // 1. Get group_ids where user is a member
      const { data: memberRows, error: memberError } = await supabase
        .from('group_members')
        .select('group_id, role')
        .eq('user_id', userId);

      if (memberError) {
        console.error('Error fetching user group memberships:', memberError.message);
        // Fallback: Try fetching directly from groups created_by if group_members query fails
        const { data: createdGroups, error: createdError } = await supabase
          .from('groups')
          .select('*')
          .eq('created_by', userId)
          .order('created_at', { ascending: false });

        if (createdError) {
          return { data: null, error: createdError.message };
        }

        const mapped: GroupModel[] = (createdGroups || []).map(g => ({
          ...g,
          currency: g.currency || 'INR',
          user_role: 'owner',
          members_count: 1
        }));
        return { data: mapped, error: null };
      }

      if (!memberRows || memberRows.length === 0) {
        return { data: [], error: null };
      }

      const groupIds = memberRows.map(m => m.group_id);
      const roleMap = new Map(memberRows.map(m => [m.group_id, m.role as 'owner' | 'member']));

      // 2. Fetch the groups matching those IDs
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds)
        .order('created_at', { ascending: false });

      if (groupsError) {
        return { data: null, error: groupsError.message };
      }

      // 3. Fetch member counts for these groups
      const { data: countData } = await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds);

      const countMap: Record<string, number> = {};
      if (countData) {
        countData.forEach((row: { group_id: string }) => {
          countMap[row.group_id] = (countMap[row.group_id] || 0) + 1;
        });
      }

      const formatted: GroupModel[] = (groupsData || []).map(g => ({
        ...g,
        currency: g.currency || 'INR',
        user_role: roleMap.get(g.id) || 'member',
        members_count: countMap[g.id] || 1
      }));

      return { data: formatted, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Failed to fetch groups.' };
    }
  },

  /**
   * Fetch single group details including its full members list and profiles
   */
  async fetchGroupDetails(groupId: string): Promise<{
    group: GroupModel | null;
    members: GroupMemberModel[];
    error: string | null;
  }> {
    try {
      // 1. Fetch group row
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) {
        return { group: null, members: [], error: groupError.message };
      }

      // 2. Fetch group members with their profiles
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select(`
          id,
          group_id,
          user_id,
          role,
          joined_at,
          profiles:user_id (
            id,
            full_name,
            email,
            created_at
          )
        `)
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true });

      if (membersError) {
        console.warn('Error fetching group members with join:', membersError.message);
        // Fallback without join
        const { data: plainMembers } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', groupId);

        const mappedFallback: GroupMemberModel[] = (plainMembers || []).map((m: any) => ({
          id: m.id,
          group_id: m.group_id,
          user_id: m.user_id,
          role: m.role || 'member',
          joined_at: m.joined_at,
          profile: null
        }));

        return {
          group: { ...groupData, currency: groupData.currency || 'INR', members_count: mappedFallback.length },
          members: mappedFallback,
          error: null
        };
      }

      const formattedMembers: GroupMemberModel[] = (membersData || []).map((m: any) => {
        const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
        return {
          id: m.id,
          group_id: m.group_id,
          user_id: m.user_id,
          role: (m.role as 'owner' | 'member') || 'member',
          joined_at: m.joined_at,
          profile: prof ? (prof as UserProfile) : null
        };
      });

      const fullGroup: GroupModel = {
        ...groupData,
        currency: groupData.currency || 'INR',
        members_count: formattedMembers.length
      };

      return { group: fullGroup, members: formattedMembers, error: null };
    } catch (err: any) {
      return { group: null, members: [], error: err.message || 'Failed to load group details.' };
    }
  },

  /**
   * Create a new group, add creator as 'owner', and add valid member emails as 'member'
   */
  async createGroup(
    input: CreateGroupInput,
    creatorId: string
  ): Promise<{ group: GroupModel | null; error: string | null; warning?: string }> {
    try {
      const currency = input.currency || 'INR';

      // 1. Insert into groups table
      const { data: newGroup, error: createError } = await supabase
        .from('groups')
        .insert([
          {
            name: input.name.trim(),
            description: input.description?.trim() || null,
            currency: currency,
            created_by: creatorId
          }
        ])
        .select()
        .single();

      if (createError) {
        return { group: null, error: createError.message };
      }

      const groupId = newGroup.id;

      // 2. Add creator into group_members as 'owner'
      const { error: ownerMemberError } = await supabase
        .from('group_members')
        .insert([
          {
            group_id: groupId,
            user_id: creatorId,
            role: 'owner'
          }
        ]);

      if (ownerMemberError) {
        console.error('Error adding creator to group_members:', ownerMemberError.message);
      }

      // 3. Process invited member emails
      let warningMessage = '';
      const notFoundEmails: string[] = [];
      const validMemberEmails = (input.memberEmails || [])
        .map(e => e.trim().toLowerCase())
        .filter(Boolean);

      if (validMemberEmails.length > 0) {
        // Find existing profiles with these emails
        const { data: matchedProfiles, error: profileLookupError } = await supabase
          .from('profiles')
          .select('id, email')
          .in('email', validMemberEmails);

        if (!profileLookupError && matchedProfiles) {
          const foundEmailMap = new Map(matchedProfiles.map(p => [p.email.toLowerCase(), p.id]));
          const memberInserts: { group_id: string; user_id: string; role: 'member' }[] = [];

          for (const email of validMemberEmails) {
            const foundUserId = foundEmailMap.get(email);
            if (foundUserId && foundUserId !== creatorId) {
              memberInserts.push({
                group_id: groupId,
                user_id: foundUserId,
                role: 'member'
              });
            } else if (!foundUserId) {
              notFoundEmails.push(email);
            }
          }

          if (memberInserts.length > 0) {
            await supabase.from('group_members').insert(memberInserts);
          }
        }
      }

      if (notFoundEmails.length > 0) {
        warningMessage = `Note: The following emails don't have an Equallii account yet: ${notFoundEmails.join(', ')}. They can be added once registered.`;
      }

      // 4. Log activity
      try {
        await supabase.from('activity_log').insert([
          {
            group_id: groupId,
            user_id: creatorId,
            action_type: 'member_joined',
            description: `Group "${input.name.trim()}" created`,
            metadata: { group_name: input.name.trim() }
          }
        ]);
      } catch (actErr) {
        console.warn('Activity log insert error:', actErr);
      }

      return {
        group: {
          ...newGroup,
          currency: newGroup.currency || 'INR',
          user_role: 'owner',
          members_count: 1 + validMemberEmails.length - notFoundEmails.length
        },
        error: null,
        warning: warningMessage || undefined
      };
    } catch (err: any) {
      return { group: null, error: err.message || 'An unexpected error occurred while creating the group.' };
    }
  },

  /**
   * Update group properties (name, description, currency)
   */
  async updateGroup(
    groupId: string,
    input: UpdateGroupInput,
    userId?: string
  ): Promise<{ error: string | null }> {
    try {
      const updates: Record<string, any> = {};
      if (input.name !== undefined) updates.name = input.name.trim();
      if (input.description !== undefined) updates.description = input.description.trim() || null;
      if (input.currency !== undefined) updates.currency = input.currency.trim();

      const { error } = await supabase
        .from('groups')
        .update(updates)
        .eq('id', groupId);

      if (error) {
        return { error: error.message };
      }

      // Log update activity
      if (userId) {
        try {
          await supabase.from('activity_log').insert([
            {
              group_id: groupId,
              user_id: userId,
              action_type: 'group_updated',
              description: `Group details updated`,
              metadata: updates
            }
          ]);
        } catch (actErr) {
          console.warn('Activity log insert error:', actErr);
        }
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Failed to update group.' };
    }
  },

  /**
   * Delete a group and all cascading records
   */
  async deleteGroup(groupId: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (error) {
        return { error: error.message };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Failed to delete group.' };
    }
  },

  /**
   * Add a single member to a group by email lookup
   */
  async addGroupMember(
    groupId: string,
    email: string,
    performedByUserId?: string
  ): Promise<{ error: string | null; member?: GroupMemberModel }> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        return { error: 'Please provide a valid email address.' };
      }

      // 1. Find user in profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (profileError) {
        return { error: profileError.message };
      }

      if (!profile) {
        return { error: `No registered Equallii user found with email "${cleanEmail}". Ask them to sign up first.` };
      }

      // 2. Check if user is already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existingMember) {
        return { error: 'This user is already a member of this group.' };
      }

      // 3. Insert into group_members as 'member'
      const { data: newMember, error: insertError } = await supabase
        .from('group_members')
        .insert([
          {
            group_id: groupId,
            user_id: profile.id,
            role: 'member'
          }
        ])
        .select()
        .single();

      if (insertError) {
        return { error: insertError.message };
      }

      // 4. Log activity
      if (performedByUserId) {
        try {
          await supabase.from('activity_log').insert([
            {
              group_id: groupId,
              user_id: performedByUserId,
              action_type: 'member_joined',
              description: `${profile.full_name || cleanEmail} was added to the group`,
              metadata: { member_id: profile.id, member_name: profile.full_name, member_email: cleanEmail }
            }
          ]);
        } catch (actErr) {
          console.warn('Activity log error:', actErr);
        }
      }

      return {
        error: null,
        member: {
          id: newMember.id,
          group_id: groupId,
          user_id: profile.id,
          role: 'member',
          joined_at: newMember.joined_at,
          profile: profile as UserProfile
        }
      };
    } catch (err: any) {
      return { error: err.message || 'Failed to add member to group.' };
    }
  },

  /**
   * Remove a member from the group
   */
  async removeGroupMember(
    groupId: string,
    memberRowId: string,
    memberUserId: string,
    performedByUserId?: string,
    memberName?: string
  ): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', memberRowId);

      if (error) {
        return { error: error.message };
      }

      // Log activity
      if (performedByUserId) {
        try {
          await supabase.from('activity_log').insert([
            {
              group_id: groupId,
              user_id: performedByUserId,
              action_type: 'member_removed',
              description: `${memberName || 'A member'} was removed from the group`,
              metadata: { removed_user_id: memberUserId }
            }
          ]);
        } catch (actErr) {
          console.warn('Activity log error:', actErr);
        }
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Failed to remove member.' };
    }
  }
};
