-- Migration: Make group_id nullable on expenses and activity_log
-- Purpose: Enable direct non-group / friend expenses while keeping existing group foreign key constraints intact.

-- 1. Allow expenses to exist without a group (direct friend expenses)
ALTER TABLE expenses 
  ALTER COLUMN group_id DROP NOT NULL;

-- 2. Allow activity_log entries to record events without a group
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'activity_log' 
      AND column_name = 'group_id'
  ) THEN
    ALTER TABLE activity_log ALTER COLUMN group_id DROP NOT NULL;
  END IF;
END $$;
