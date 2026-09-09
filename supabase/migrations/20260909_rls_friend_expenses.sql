-- Migration: Update RLS policies to support friend (non-group) expenses
-- Purpose: Enable secure SELECT, INSERT, UPDATE, and DELETE for expenses where group_id IS NULL
--          while keeping existing group security and permissions completely unchanged.

-- ============================================================================
-- 1. EXPENSES TABLE RLS
-- ============================================================================

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Drop previous policies if they exist to apply clean unified policies
DROP POLICY IF EXISTS "Users can view their group and friend expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view expenses in their groups" ON expenses;
DROP POLICY IF EXISTS "Users can create expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete their own expenses" ON expenses;

-- SELECT: Group members can view group expenses; payer and split participants can view friend expenses
CREATE POLICY "Users can view their group and friend expenses"
ON expenses
FOR SELECT
USING (
  -- 1. Group expense: User is the payer or a member of the group
  (group_id IS NOT NULL AND (
    paid_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = expenses.group_id
        AND group_members.user_id = auth.uid()
    )
  ))
  OR
  -- 2. Friend expense: User is the payer or listed as a participant in expense_splits
  (group_id IS NULL AND (
    paid_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM expense_splits
      WHERE expense_splits.expense_id = expenses.id
        AND expense_splits.user_id = auth.uid()
    )
  ))
);

-- INSERT: User can insert an expense when they are the payer (and in the group if group_id is provided)
CREATE POLICY "Users can create expenses"
ON expenses
FOR INSERT
WITH CHECK (
  paid_by = auth.uid() AND (
    group_id IS NULL OR
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = expenses.group_id
        AND group_members.user_id = auth.uid()
    )
  )
);

-- UPDATE: Only the creator/payer can update their expense
CREATE POLICY "Users can update their own expenses"
ON expenses
FOR UPDATE
USING (paid_by = auth.uid())
WITH CHECK (paid_by = auth.uid());

-- DELETE: Only the creator/payer can delete their expense (cascades to splits)
CREATE POLICY "Users can delete their own expenses"
ON expenses
FOR DELETE
USING (paid_by = auth.uid());


-- ============================================================================
-- 2. EXPENSE_SPLITS TABLE RLS
-- ============================================================================

ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view expense splits" ON expense_splits;
DROP POLICY IF EXISTS "Users can insert expense splits" ON expense_splits;
DROP POLICY IF EXISTS "Users can update their own split status" ON expense_splits;
DROP POLICY IF EXISTS "Users can delete expense splits" ON expense_splits;

-- SELECT: A user can view their own split row, or all splits for expenses they paid or share in a group
CREATE POLICY "Users can view expense splits"
ON expense_splits
FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM expenses
    WHERE expenses.id = expense_splits.expense_id
      AND (
        expenses.paid_by = auth.uid() OR
        (expenses.group_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM group_members
          WHERE group_members.group_id = expenses.group_id
            AND group_members.user_id = auth.uid()
        ))
      )
  )
);

-- INSERT: Allowed when creating splits for an expense where the user is the payer
CREATE POLICY "Users can insert expense splits"
ON expense_splits
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM expenses
    WHERE expenses.id = expense_splits.expense_id
      AND expenses.paid_by = auth.uid()
  )
);

-- UPDATE: Each user can update their own split (e.g. to mark is_settled = true)
CREATE POLICY "Users can update their own split status"
ON expense_splits
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Payer or split debtor can delete
CREATE POLICY "Users can delete expense splits"
ON expense_splits
FOR DELETE
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM expenses
    WHERE expenses.id = expense_splits.expense_id
      AND expenses.paid_by = auth.uid()
  )
);


-- ============================================================================
-- 3. ACTIVITY_LOG TABLE RLS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'activity_log'
  ) THEN
    EXECUTE 'ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;';
    
    -- Drop older policies if present
    EXECUTE 'DROP POLICY IF EXISTS "Users can view activity logs" ON activity_log;';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert activity logs" ON activity_log;';

    -- SELECT: View group activity if group member, or personal non-group activity
    EXECUTE 'CREATE POLICY "Users can view activity logs"
      ON activity_log
      FOR SELECT
      USING (
        (group_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM group_members
          WHERE group_members.group_id = activity_log.group_id
            AND group_members.user_id = auth.uid()
        ))
        OR
        (group_id IS NULL AND user_id = auth.uid())
      );';

    -- INSERT: User can log their own actions
    EXECUTE 'CREATE POLICY "Users can insert activity logs"
      ON activity_log
      FOR INSERT
      WITH CHECK (user_id = auth.uid());';
  END IF;
END $$;
