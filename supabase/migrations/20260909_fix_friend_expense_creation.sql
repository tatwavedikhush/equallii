-- Migration: Fix RLS Infinite Recursion & Secure Friend Expense Creation
-- Problem: Circular RLS evaluation between expenses and expense_splits (error 42P17)
-- Solution: Narrowly scoped SECURITY DEFINER helper functions that break RLS circular dependency.

-- ============================================================================
-- 1. SECURITY DEFINER HELPER FUNCTIONS (RECURSION BREAKERS)
-- ============================================================================

-- Drop existing functions first if signatures/parameter names changed
DROP FUNCTION IF EXISTS is_expense_participant(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS is_group_member(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS is_expense_payer_or_group_member(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_expense_with_splits(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, DATE, JSONB) CASCADE;

-- Helper: Check if user is a participant in splits for an expense without triggering RLS on expense_splits
CREATE OR REPLACE FUNCTION is_expense_participant(p_expense_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM expense_splits
    WHERE expense_id = p_expense_id
      AND user_id = p_user_id
  );
$$;

-- Helper: Check if user is a member of a group without triggering RLS
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

-- Helper: Check if user is the payer or a group member for an expense without triggering RLS on expenses
CREATE OR REPLACE FUNCTION is_expense_payer_or_group_member(p_expense_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM expenses e
    WHERE e.id = p_expense_id
      AND (
        e.paid_by = p_user_id
        OR (
          e.group_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.group_id = e.group_id
              AND gm.user_id = p_user_id
          )
        )
      )
  );
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION is_expense_participant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_group_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_expense_payer_or_group_member(UUID, UUID) TO authenticated;


-- ============================================================================
-- 2. ATOMIC RPC FUNCTION FOR CREATING EXPENSES WITH SPLITS
-- ============================================================================

CREATE OR REPLACE FUNCTION create_expense_with_splits(
  p_group_id UUID,
  p_paid_by UUID,
  p_description TEXT,
  p_amount NUMERIC,
  p_currency TEXT,
  p_category TEXT,
  p_split_type TEXT,
  p_expense_date DATE,
  p_splits JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_expense_id UUID;
  v_split_record JSONB;
  v_is_participant BOOLEAN := FALSE;
  v_split_user_id UUID;
  v_split_amount NUMERIC;
  v_expense_row expenses%ROWTYPE;
  v_splits_result JSONB := '[]'::JSONB;
BEGIN
  -- 1. Must be authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create an expense.';
  END IF;

  -- 2. Validate Group vs Friend authorization
  IF p_group_id IS NOT NULL THEN
    -- Group expense: Current user must be a member of the group
    IF NOT is_group_member(p_group_id, v_user_id) THEN
      RAISE EXCEPTION 'You are not a member of this group.';
    END IF;
  ELSE
    -- Friend expense (group_id IS NULL):
    -- Current user must be the payer OR listed in splits
    IF p_paid_by = v_user_id THEN
      v_is_participant := TRUE;
    ELSE
      FOR v_split_record IN SELECT * FROM jsonb_array_elements(p_splits)
      LOOP
        IF (v_split_record->>'user_id')::UUID = v_user_id THEN
          v_is_participant := TRUE;
          EXIT;
        END IF;
      END LOOP;
    END IF;

    IF NOT v_is_participant THEN
      RAISE EXCEPTION 'You cannot create an expense that you are not part of.';
    END IF;
  END IF;

  -- 3. Insert into expenses table
  INSERT INTO expenses (
    group_id,
    paid_by,
    description,
    amount,
    currency,
    category,
    split_type,
    expense_date
  ) VALUES (
    p_group_id,
    p_paid_by,
    p_description,
    p_amount,
    COALESCE(p_currency, 'INR'),
    COALESCE(p_category, 'general'),
    COALESCE(p_split_type, 'equal'),
    COALESCE(p_expense_date, CURRENT_DATE)
  )
  RETURNING * INTO v_expense_row;

  v_expense_id := v_expense_row.id;

  -- 4. Insert splits
  FOR v_split_record IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    v_split_user_id := (v_split_record->>'user_id')::UUID;
    v_split_amount := (v_split_record->>'amount_owed')::NUMERIC;

    INSERT INTO expense_splits (
      expense_id,
      user_id,
      amount_owed,
      is_settled
    ) VALUES (
      v_expense_id,
      v_split_user_id,
      v_split_amount,
      FALSE
    );
  END LOOP;

  -- 5. Collect inserted splits
  SELECT jsonb_agg(to_jsonb(s)) INTO v_splits_result
  FROM expense_splits s
  WHERE s.expense_id = v_expense_id;

  -- 6. Log activity
  BEGIN
    INSERT INTO activity_log (
      group_id,
      user_id,
      action_type,
      description,
      metadata
    ) VALUES (
      p_group_id,
      v_user_id,
      'expense_added',
      'Added "' || p_description || '" (₹' || p_amount || ')',
      jsonb_build_object(
        'expense_id', v_expense_id,
        'amount', p_amount,
        'currency', COALESCE(p_currency, 'INR')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Non-blocking activity log
  END;

  -- 7. Return composite json result
  RETURN jsonb_build_object(
    'expense', to_jsonb(v_expense_row),
    'splits', COALESCE(v_splits_result, '[]'::JSONB)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_expense_with_splits TO authenticated;


-- ============================================================================
-- 3. EXPENSES TABLE RLS POLICIES (CLEAN & RECURSION-FREE)
-- ============================================================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Drop all older/conflicting policies
DROP POLICY IF EXISTS "Users can view their group and friend expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view expenses in their groups" ON expenses;
DROP POLICY IF EXISTS "Users can view expenses" ON expenses;
DROP POLICY IF EXISTS "Users can create expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update their expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete their own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete their expenses" ON expenses;

-- SELECT: Group members or payer, and non-group participant or payer
CREATE POLICY "expenses_select_policy"
ON expenses
FOR SELECT
USING (
  paid_by = auth.uid()
  OR (group_id IS NOT NULL AND is_group_member(group_id, auth.uid()))
  OR (group_id IS NULL AND is_expense_participant(id, auth.uid()))
);

-- INSERT: Payer or group member
CREATE POLICY "expenses_insert_policy"
ON expenses
FOR INSERT
WITH CHECK (
  paid_by = auth.uid()
  OR (group_id IS NOT NULL AND is_group_member(group_id, auth.uid()))
);

-- UPDATE: Payer, group member, or friend participant
CREATE POLICY "expenses_update_policy"
ON expenses
FOR UPDATE
USING (
  paid_by = auth.uid()
  OR (group_id IS NOT NULL AND is_group_member(group_id, auth.uid()))
  OR (group_id IS NULL AND is_expense_participant(id, auth.uid()))
);

-- DELETE: Payer, group member, or friend participant
CREATE POLICY "expenses_delete_policy"
ON expenses
FOR DELETE
USING (
  paid_by = auth.uid()
  OR (group_id IS NOT NULL AND is_group_member(group_id, auth.uid()))
  OR (group_id IS NULL AND is_expense_participant(id, auth.uid()))
);


-- ============================================================================
-- 4. EXPENSE_SPLITS TABLE RLS POLICIES (CLEAN & RECURSION-FREE)
-- ============================================================================

ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view expense splits" ON expense_splits;
DROP POLICY IF EXISTS "Users can insert expense splits" ON expense_splits;
DROP POLICY IF EXISTS "Users can update their own split status" ON expense_splits;
DROP POLICY IF EXISTS "Users can update their splits" ON expense_splits;
DROP POLICY IF EXISTS "Users can delete expense splits" ON expense_splits;

-- SELECT: Own split, or any split for an expense you paid, share in a group, or participate in
CREATE POLICY "expense_splits_select_policy"
ON expense_splits
FOR SELECT
USING (
  user_id = auth.uid()
  OR is_expense_payer_or_group_member(expense_id, auth.uid())
  OR is_expense_participant(expense_id, auth.uid())
);

-- INSERT: Allowed if user is the split owner or authorized for the expense
CREATE POLICY "expense_splits_insert_policy"
ON expense_splits
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR is_expense_payer_or_group_member(expense_id, auth.uid())
  OR is_expense_participant(expense_id, auth.uid())
);

-- UPDATE: User can update their own split (settlement) or payer/authorized user can update
CREATE POLICY "expense_splits_update_policy"
ON expense_splits
FOR UPDATE
USING (
  user_id = auth.uid()
  OR is_expense_payer_or_group_member(expense_id, auth.uid())
);

-- DELETE: User can delete their own split or payer/authorized user can delete
CREATE POLICY "expense_splits_delete_policy"
ON expense_splits
FOR DELETE
USING (
  user_id = auth.uid()
  OR is_expense_payer_or_group_member(expense_id, auth.uid())
);


-- ============================================================================
-- 5. ACTIVITY_LOG TABLE RLS POLICIES
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'activity_log'
  ) THEN
    EXECUTE 'ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;';
    
    EXECUTE 'DROP POLICY IF EXISTS "Users can view activity logs" ON activity_log;';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert activity logs" ON activity_log;';
    EXECUTE 'DROP POLICY IF EXISTS "activity_log_select_policy" ON activity_log;';
    EXECUTE 'DROP POLICY IF EXISTS "activity_log_insert_policy" ON activity_log;';

    EXECUTE 'CREATE POLICY "activity_log_select_policy"
      ON activity_log
      FOR SELECT
      USING (
        (group_id IS NOT NULL AND is_group_member(group_id, auth.uid()))
        OR
        (group_id IS NULL AND user_id = auth.uid())
      );';

    EXECUTE 'CREATE POLICY "activity_log_insert_policy"
      ON activity_log
      FOR INSERT
      WITH CHECK (user_id = auth.uid());';
  END IF;
END $$;
