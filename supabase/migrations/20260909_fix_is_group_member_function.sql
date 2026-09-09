-- Corrective Migration: Safely recreate is_group_member with SECURITY DEFINER
-- Purpose: Resolve PostgreSQL 42P13 error caused by input parameter name change

-- 1. Drop the existing function signature
DROP FUNCTION IF EXISTS is_group_member(UUID, UUID) CASCADE;

-- 2. Recreate is_group_member with explicit SECURITY DEFINER & search_path
CREATE OR REPLACE FUNCTION is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
  );
$$;

-- 3. Grant execution permissions
GRANT EXECUTE ON FUNCTION is_group_member(UUID, UUID) TO authenticated;
