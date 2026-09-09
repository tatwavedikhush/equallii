import { supabase } from '../database/supabaseClient';

export interface CreateExpenseInput {
  groupId?: string | null;
  paidBy: string; // UUID of payer
  description: string;
  amount: number;
  currency?: string;
  category?: string;
  splitType?: 'equal' | 'exact' | 'percentage' | 'shares';
  expenseDate?: string;
  splits: {
    userId: string; // UUID
    amountOwed: number;
  }[];
}

export interface ExpenseDbModel {
  id: string;
  group_id: string | null;
  paid_by: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  split_type: string;
  expense_date: string;
  created_at: string;
}

export interface ExpenseSplitDbModel {
  id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
  is_settled: boolean;
  created_at: string;
}

export const expensesService = {
  /**
   * Create an expense and its corresponding splits in Supabase.
   * If split insertion fails, the expense is cleaned up (rollback) to avoid orphaned records.
   */
  async createExpense(input: CreateExpenseInput): Promise<{
    expense: ExpenseDbModel | null;
    splits: ExpenseSplitDbModel[] | null;
    error: string | null;
  }> {
    try {
      // 1. Validate required fields
      if (!input.paidBy) {
        return { expense: null, splits: null, error: 'Payer ID is required.' };
      }
      if (!input.description || !input.description.trim()) {
        return { expense: null, splits: null, error: 'Description is required.' };
      }
      if (!input.amount || input.amount <= 0) {
        return { expense: null, splits: null, error: 'Amount must be greater than 0.' };
      }
      if (!input.splits || input.splits.length === 0) {
        return { expense: null, splits: null, error: 'At least one split is required.' };
      }

      // 2. Try secure atomic RPC first (handles Case A and Case B friend expenses without RLS race conditions)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('create_expense_with_splits', {
          p_group_id: input.groupId || null,
          p_paid_by: input.paidBy,
          p_description: input.description.trim(),
          p_amount: input.amount,
          p_currency: input.currency || 'INR',
          p_category: input.category || 'general',
          p_split_type: input.splitType || 'equal',
          p_expense_date: input.expenseDate || new Date().toISOString().split('T')[0],
          p_splits: input.splits.map(s => ({
            user_id: s.userId,
            amount_owed: s.amountOwed
          }))
        });

        if (!rpcError && rpcData?.expense) {
          return {
            expense: rpcData.expense as ExpenseDbModel,
            splits: (rpcData.splits || []) as ExpenseSplitDbModel[],
            error: null
          };
        }
      } catch (rpcErr) {
        console.warn('RPC create_expense_with_splits fallback to direct insert:', rpcErr);
      }

      // 3. Fallback: Direct insert into expenses table
      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          group_id: input.groupId || null,
          paid_by: input.paidBy,
          description: input.description.trim(),
          amount: input.amount,
          currency: input.currency || 'INR',
          category: input.category || 'general',
          split_type: input.splitType || 'equal',
          expense_date: input.expenseDate || new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (expenseError || !expense) {
        console.error('Error inserting expense:', expenseError?.message);
        return {
          expense: null,
          splits: null,
          error: expenseError?.message || 'Failed to create expense.'
        };
      }

      // 3. Prepare and insert expense splits
      const splitRows = input.splits.map(split => ({
        expense_id: expense.id,
        user_id: split.userId,
        amount_owed: split.amountOwed,
        is_settled: false
      }));

      const { data: splits, error: splitError } = await supabase
        .from('expense_splits')
        .insert(splitRows)
        .select();

      if (splitError) {
        console.error('Error inserting expense splits, rolling back expense:', splitError.message);
        // Rollback: remove created expense to maintain integrity
        await supabase
          .from('expenses')
          .delete()
          .eq('id', expense.id);

        return {
          expense: null,
          splits: null,
          error: `Failed to save expense splits: ${splitError.message}`
        };
      }

      // 4. Log activity
      try {
        await supabase.from('activity_log').insert({
          group_id: input.groupId || null,
          user_id: input.paidBy,
          action_type: 'expense_added',
          description: `Added "${input.description.trim()}" (₹${input.amount})`,
          metadata: {
            expense_id: expense.id,
            amount: input.amount,
            currency: input.currency || 'INR'
          }
        });
      } catch (actErr) {
        console.warn('Non-blocking activity log insert error:', actErr);
      }

      return {
        expense: expense as ExpenseDbModel,
        splits: splits as ExpenseSplitDbModel[],
        error: null
      };
    } catch (err: any) {
      console.error('Unexpected error in createExpense:', err);
      return {
        expense: null,
        splits: null,
        error: err.message || 'An unexpected error occurred while adding the expense.'
      };
    }
  },

  /**
   * Fetch all expenses and splits for a specific user across their groups and direct friend expenses from Supabase.
   */
  async fetchExpensesForUser(userId: string) {
    try {
      // 1. Get all group IDs for this user
      const { data: memberRows, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId);

      if (memberError) {
        console.error('Error fetching user groups for expenses:', memberError);
        return { data: [], error: memberError.message };
      }

      const groupIds = (memberRows || []).map(m => m.group_id);

      // 2. Fetch expenses with paid_by profile, group name, and splits
      let query = supabase
        .from('expenses')
        .select(`
          id,
          group_id,
          paid_by,
          description,
          amount,
          currency,
          category,
          split_type,
          expense_date,
          created_at,
          profiles:paid_by (
            id,
            full_name,
            email
          ),
          groups:group_id (
            id,
            name
          ),
          expense_splits (
            id,
            user_id,
            amount_owed,
            is_settled,
            profiles:user_id (
              id,
              full_name,
              email
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (groupIds.length > 0) {
        query = query.or(`group_id.in.(${groupIds.join(',')}),group_id.is.null`);
      } else {
        query = query.is('group_id', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching expenses from Supabase:', error);
        return { data: [], error: error.message };
      }

      return { data: data || [], error: null };
    } catch (err: any) {
      console.error('Unexpected error in fetchExpensesForUser:', err);
      return { data: [], error: err.message || 'Failed to fetch expenses.' };
    }
  },

  /**
   * Fetch all expenses for a specific group from Supabase.
   */
  async fetchGroupExpenses(groupId: string) {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          id,
          group_id,
          paid_by,
          description,
          amount,
          currency,
          category,
          split_type,
          expense_date,
          created_at,
          profiles:paid_by (
            id,
            full_name,
            email
          ),
          groups:group_id (
            id,
            name
          ),
          expense_splits (
            id,
            user_id,
            amount_owed,
            is_settled,
            profiles:user_id (
              id,
              full_name,
              email
            )
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching group expenses:', error);
        return { data: [], error: error.message };
      }

      return { data: data || [], error: null };
    } catch (err: any) {
      console.error('Unexpected error in fetchGroupExpenses:', err);
      return { data: [], error: err.message || 'Failed to fetch group expenses.' };
    }
  },

  /**
   * Settle outstanding debt between friends for non-group expenses (group_id IS NULL).
   * Marks the current debtor's (userId) unsettled splits as settled on non-group expenses
   * where friendId was the payer.
   */
  async settleFriendDebt(
    friendId: string,
    userId: string
  ): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      if (friendId === userId) {
        return {
          success: false,
          error: 'You cannot settle debt with yourself.',
        };
      }

      // 1. Fetch non-group expenses where friendId is the payer
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('id')
        .is('group_id', null)
        .eq('paid_by', friendId);

      if (expensesError) {
        console.error('Error fetching friend expenses for settlement:', expensesError);
        return {
          success: false,
          error: expensesError.message,
        };
      }

      if (!expenses || expenses.length === 0) {
        return {
          success: true,
          error: null,
        };
      }

      const expenseIds = expenses.map(expense => expense.id);

      // 2. Settle only this debtor's (userId) unsettled splits on those expenses
      const { error: settleError } = await supabase
        .from('expense_splits')
        .update({
          is_settled: true,
        })
        .in('expense_id', expenseIds)
        .eq('user_id', userId)
        .eq('is_settled', false);

      if (settleError) {
        console.error('Error settling friend debt:', settleError);
        return {
          success: false,
          error: settleError.message,
        };
      }

      return {
        success: true,
        error: null,
      };
    } catch (err: any) {
      console.error('Unexpected error settling friend debt:', err);
      return {
        success: false,
        error: err.message || 'Failed to settle debt with friend.',
      };
    }
  },

  /**
   * Mark the debtor's unsettled splits as settled, but only on expenses
   * that the creditor paid in this group. Does not touch the payer's own share
   * or anyone else's debts.
   */
  async settleDebtToPerson(
    groupId: string,
    debtorId: string,
    creditorId: string
  ): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      if (debtorId === creditorId) {
        return {
          success: false,
          error: 'You cannot settle your own share of an expense.',
        };
      }

      // Expenses in this group that the creditor paid (the person who should receive)
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('id')
        .eq('group_id', groupId)
        .eq('paid_by', creditorId);

      if (expensesError) {
        console.error(
          'Error fetching creditor expenses:',
          expensesError
        );

        return {
          success: false,
          error: expensesError.message,
        };
      }

      if (!expenses || expenses.length === 0) {
        return {
          success: true,
          error: null,
        };
      }

      const expenseIds = expenses.map(expense => expense.id);

      // Settle only this debtor's open splits on those expenses
      const { error: settleError } = await supabase
        .from('expense_splits')
        .update({
          is_settled: true,
        })
        .in('expense_id', expenseIds)
        .eq('user_id', debtorId)
        .eq('is_settled', false);

      if (settleError) {
        console.error(
          'Error settling debt:',
          settleError
        );

        return {
          success: false,
          error: settleError.message,
        };
      }

      return {
        success: true,
        error: null,
      };
    } catch (err: any) {
      console.error(
        'Unexpected error settling debt:',
        err
      );

      return {
        success: false,
        error:
          err.message ||
          'Failed to settle this debt.',
      };
    }
  },

  /**
   * Settle all outstanding expenses for a user in a group.
   * Marks all the user's unsettled splits as settled across all group expenses.
   */
  async settleMyGroupExpenses(groupId: string, userId: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      // Fetch all unsettled expenses in the group where the user is involved
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          id,
          paid_by,
          expense_splits (
            id,
            user_id,
            amount_owed,
            is_settled
          )
        `)
        .eq('group_id', groupId);

      if (expensesError) {
        console.error('Error fetching group expenses:', expensesError);
        return {
          success: false,
          error: expensesError.message,
        };
      }

      if (!expenses || expenses.length === 0) {
        return {
          success: true,
          error: null,
        };
      }

      // Collect all expense IDs and find the user's unsettled splits
      const settlePromises = expenses.map(async expense => {
        // Find the user's unsettled splits on this expense
        const { error: splitsError } = await supabase
          .from('expense_splits')
          .update({
            is_settled: true,
          })
          .eq('expense_id', expense.id)
          .eq('user_id', userId)
          .eq('is_settled', false);

        if (splitsError) {
          console.error('Error settling split:', splitsError);
          return false;
        }
        return true;
      });

      const results = await Promise.all(settlePromises);
      const allSettled = results.every(r => r === true);

      return {
        success: allSettled,
        error: allSettled ? null : 'Failed to settle some splits.',
      };
    } catch (err: any) {
      console.error(
        'Unexpected error settling my group expenses:',
        err
      );

      return {
        success: false,
        error:
          err.message ||
          'Failed to settle group expenses.',
      };
    }
  },

  /**
   * Delete an expense by its ID.
   * Also removes associated expense_splits records to maintain referential integrity.
   */
  async deleteExpense(expenseId: string): Promise<{
    success: boolean;
    error: string | null;
  }> {
    try {
      // 1. Remove expense_splits associated with this expense first (Supabase may cascade, but explicit is safer)
      const { error: splitsError } = await supabase
        .from('expense_splits')
        .delete()
        .eq('expense_id', expenseId);

      if (splitsError) {
        console.error('Error deleting expense splits:', splitsError);
        return {
          success: false,
          error: splitsError.message,
        };
      }

      // 2. Delete the expense itself
      const { error: expenseError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (expenseError) {
        console.error('Error deleting expense:', expenseError);
        return {
          success: false,
          error: expenseError.message,
        };
      }

      return {
        success: true,
        error: null,
      };
    } catch (err: any) {
      console.error('Unexpected error deleting expense:', err);

      return {
        success: false,
        error:
          err.message ||
          'Failed to delete expense.',
      };
    }
  },

  /**
   * Update an existing expense by replacing it safely through database cascade.
   * Reads the current expense and split structure, deletes the parent expense
   * (which cascades to all child expense_splits automatically without RLS row filtering issues),
   * and creates the replacement expense with newly recalculated splits.
   */
  async updateExpense(
    expenseId: string,
    updates: {
      description?: string;
      amount?: number;
      paidBy?: string;
      currency?: string;
      category?: string;
      splitType?: 'equal' | 'exact' | 'percentage' | 'shares';
      expenseDate?: string;
      splits?: {
        userId: string;
        amountOwed: number;
      }[];
    }
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      // 1. Fetch existing expense data and its splits before deletion
      const { data: existingExpense, error: fetchError } = await supabase
        .from('expenses')
        .select(`
          id,
          group_id,
          paid_by,
          description,
          amount,
          currency,
          category,
          split_type,
          expense_date,
          expense_splits (
            user_id,
            amount_owed,
            created_at
          )
        `)
        .eq('id', expenseId)
        .single();

      if (fetchError || !existingExpense) {
        console.error('Error fetching existing expense for update:', fetchError);
        return {
          success: false,
          error: fetchError?.message || 'Expense not found.',
        };
      }

      // 2. Prepare new expense attributes
      const newDescription = updates.description !== undefined ? updates.description.trim() : existingExpense.description;
      const newAmount = updates.amount !== undefined ? updates.amount : Number(existingExpense.amount);
      const newCurrency = updates.currency || existingExpense.currency || 'INR';
      const newCategory = updates.category || existingExpense.category || 'general';
      const newSplitType = (updates.splitType || existingExpense.split_type || 'equal') as 'equal' | 'exact' | 'percentage' | 'shares';
      const newExpenseDate = updates.expenseDate || existingExpense.expense_date || new Date().toISOString().split('T')[0];

      // 3. Prepare replacement splits
      let replacementSplits: { userId: string; amountOwed: number }[] = [];

      if (updates.splits && updates.splits.length > 0) {
        replacementSplits = updates.splits;
      } else {
        const rawSplits = Array.isArray(existingExpense.expense_splits) ? existingExpense.expense_splits : [];
        const participantUserIds = rawSplits.map((s: any) => s.user_id);

        if (participantUserIds.length === 0) {
          participantUserIds.push(existingExpense.paid_by);
        }

        const totalPaise = Math.round(newAmount * 100);
        const baseAmount = Math.floor(totalPaise / participantUserIds.length);
        const remainder = totalPaise % participantUserIds.length;

        replacementSplits = participantUserIds.map((userId: string, index: number) => ({
          userId,
          amountOwed: (baseAmount + (index < remainder ? 1 : 0)) / 100,
        }));
      }

      // 4. Delete the existing parent expense (ON DELETE CASCADE purges all existing expense_splits)
      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId);

      if (deleteError) {
        console.error('Error deleting previous expense for replacement:', deleteError);
        return {
          success: false,
          error: deleteError.message || 'Failed to update expense.',
        };
      }

      // 5. Create replacement expense and fresh splits
      const createResult = await expensesService.createExpense({
        groupId: existingExpense.group_id,
        paidBy: updates.paidBy || existingExpense.paid_by,
        description: newDescription,
        amount: newAmount,
        currency: newCurrency,
        category: newCategory,
        splitType: newSplitType,
        expenseDate: newExpenseDate,
        splits: replacementSplits,
      });

      if (createResult.error || !createResult.expense) {
        console.error('Error creating replacement expense:', createResult.error);
        return {
          success: false,
          error: createResult.error || 'Failed to create updated expense.',
        };
      }

      return {
        success: true,
        error: null,
      };
    } catch (err: any) {
      console.error('Unexpected error updating expense:', err);

      return {
        success: false,
        error:
          err.message ||
          'Failed to update expense.',
      };
    }
  }
};

