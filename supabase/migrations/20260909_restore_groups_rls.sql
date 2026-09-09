-- Migration: Restore Groups & Group Members RLS Policies
-- Purpose: Restore exact RLS policies on groups and group_members that were cascaded when is_group_member was updated,
--          using the recursion-safe is_group_member helper function.

-- ============================================================================
-- 1. GROUPS TABLE RLS POLICIES
-- ============================================================================

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view groups they belong to" ON groups;
DROP POLICY IF EXISTS "Users can view their groups" ON groups;
DROP POLICY IF EXISTS "groups_select_policy" ON groups;
CREATE POLICY "groups_select_policy"
ON groups
FOR SELECT
USING (
  created_by = auth.uid()
  OR is_group_member(id, auth.uid())
);

DROP POLICY IF EXISTS "Users can create groups" ON groups;
DROP POLICY IF EXISTS "groups_insert_policy" ON groups;
CREATE POLICY "groups_insert_policy"
ON groups
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
);

DROP POLICY IF EXISTS "Users can update their groups" ON groups;
DROP POLICY IF EXISTS "groups_update_policy" ON groups;
CREATE POLICY "groups_update_policy"
ON groups
FOR UPDATE
USING (
  created_by = auth.uid()
  OR is_group_member(id, auth.uid())
);

DROP POLICY IF EXISTS "Users can delete their own groups" ON groups;
DROP POLICY IF EXISTS "groups_delete_policy" ON groups;
CREATE POLICY "groups_delete_policy"
ON groups
FOR DELETE
USING (
  created_by = auth.uid()
);


-- ============================================================================
-- 2. GROUP_MEMBERS TABLE RLS POLICIES
-- ============================================================================

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view group members" ON group_members;
DROP POLICY IF EXISTS "group_members_select_policy" ON group_members;
CREATE POLICY "group_members_select_policy"
ON group_members
FOR SELECT
USING (
  user_id = auth.uid()
  OR is_group_member(group_id, auth.uid())
);

DROP POLICY IF EXISTS "Users can add group members" ON group_members;
DROP POLICY IF EXISTS "group_members_insert_policy" ON group_members;
CREATE POLICY "group_members_insert_policy"
ON group_members
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR is_group_member(group_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_members.group_id
      AND groups.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can remove group members" ON group_members;
DROP POLICY IF EXISTS "group_members_delete_policy" ON group_members;
CREATE POLICY "group_members_delete_policy"
ON group_members
FOR DELETE
USING (
  user_id = auth.uid()
  OR is_group_member(group_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM groups
    WHERE groups.id = group_members.group_id
      AND groups.created_by = auth.uid()
  )
);
