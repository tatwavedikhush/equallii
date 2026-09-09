import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { groupsService, type CreateGroupInput, type UpdateGroupInput } from '../services/groupsService';
import { expensesService } from '../services/expensesService';

export type Screen = 'dashboard' | 'groups' | 'friends' | 'activity' | 'profile' | 'group-detail' | 'expense-detail';

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Group {
  id: string;
  number: string;
  name: string;
  description?: string | null;
  currency: string;
  created_by?: string;
  created_at?: string;
  membersCount: number;
  balance: number; // positive = user is owed, negative = user owes
  members: string[]; // member names
  userRole?: 'owner' | 'member';
}

export interface Split {
  memberId: string;
  memberName: string;
  amount: number;
  isSettled?: boolean;
}

export interface Expense {
  id: string;
  groupId?: string;
  groupName?: string;
  title: string;
  amount: number;
  paidBy: string; // UUID of payer
  paidByName?: string; // Display name
  timeAgo: string;
  splits: Split[];
  dateString: string;
  isSettled?: boolean;
}

export interface Activity {
  id: string;
  text: string;
  timeAgo: string;
  isImportant?: boolean;
}

interface AppContextProps {
  currentScreen: Screen;
  setCurrentScreen: (screen: Screen) => void;
  selectedGroupId: string | null;
  setSelectedGroupId: (id: string | null) => void;
  selectedExpenseId: string | null;
  setSelectedExpenseId: (id: string | null) => void;
  groups: Group[];
  groupsLoading: boolean;
  groupsError: string | null;
  expenses: Expense[];
  activities: Activity[];
  currentUser: Profile;
  refreshGroups: () => Promise<void>;
  refreshExpenses: () => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'timeAgo'>) => Promise<{ success: boolean; error: string | null }>;
  checkDuplicate: (title: string, amount: number, groupId?: string) => Expense | null;
  settleDebt: (groupId: string, creditorId: string) => Promise<{ success: boolean; error: string | null }>;
  settleUpGroup: (groupId: string) => Promise<{ success: boolean; error: string | null }>;
  settleFriendDebt: (friendId: string) => Promise<{ success: boolean; error: string | null }>;
  getFriendBalance: (friendId: string, expenseList?: Expense[]) => number;
  createGroup: (input: CreateGroupInput) => Promise<{ success: boolean; error: string | null; warning?: string }>;
  updateGroup: (groupId: string, input: UpdateGroupInput) => Promise<{ success: boolean; error: string | null }>;
  deleteGroup: (id: string) => Promise<{ success: boolean; error: string | null }>;
  deleteExpense: (expenseId: string) => Promise<{ success: boolean; error: string | null }>;
  updateExpense: (expenseId: string, updates: {
    description?: string;
    amount?: number;
    paidBy?: string;
    currency?: string;
    category?: string;
    splitType?: 'equal' | 'exact' | 'percentage' | 'shares';
    expenseDate?: string;
    splits?: { userId: string; amountOwed: number }[];
  }) => Promise<{ success: boolean; error: string | null }>;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

const initialGroups: Group[] = [];

const initialExpenses: Expense[] = [];

const initialActivities: Activity[] = [];

export function computeFriendBalance(friendId: string, expenseList: Expense[], userId: string): number {
  let totalBalance = 0;

  expenseList.forEach(e => {
    // Non-group expenses only
    if (e.groupId) return;

    const isUserPayer = e.paidBy === userId;
    const isFriendPayer = e.paidBy === friendId;

    if (isUserPayer) {
      const friendSplit = e.splits.find(s => s.memberId === friendId);
      if (friendSplit && !friendSplit.isSettled) {
        totalBalance += friendSplit.amount;
      }
    } else if (isFriendPayer) {
      const userSplit = e.splits.find(s => s.memberId === userId);
      if (userSplit && !userSplit.isSettled) {
        totalBalance -= userSplit.amount;
      }
    }
  });

  return Math.round(totalBalance * 100) / 100;
}

function computeGroupBalance(groupId: string, expenseList: Expense[], userId: string): number {
  let totalBalance = 0;

  expenseList.forEach(e => {
    if (e.groupId !== groupId) return;

    const isPayer = e.paidBy === userId;
    if (isPayer) {
      const unsettledOwedByOthers = e.splits
        .filter(s => s.memberId !== userId && !s.isSettled)
        .reduce((sum, s) => sum + s.amount, 0);
      totalBalance += unsettledOwedByOthers;
    } else {
      const mySplit = e.splits.find(s => s.memberId === userId);
      if (mySplit && !mySplit.isSettled) {
        totalBalance -= mySplit.amount;
      }
    }
  });

  return Math.round(totalBalance * 100) / 100;
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [groupsLoading, setGroupsLoading] = useState<boolean>(true);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const expensesRef = useRef<Expense[]>(initialExpenses);
  expensesRef.current = expenses;

  const refreshGroups = useCallback(async () => {
    if (!user) return;
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const { data, error } = await groupsService.fetchUserGroups(user.id);
      if (error) {
        console.error('Error fetching Supabase groups:', error);
        setGroupsError(error);
      } else if (data && data.length > 0) {
        const mappedGroups: Group[] = data.map((g, idx) => ({
          id: g.id,
          number: String(idx + 1).padStart(2, '0'),
          name: g.name,
          description: g.description,
          currency: g.currency || 'INR',
          created_by: g.created_by,
          created_at: g.created_at,
          membersCount: g.members_count || 1,
          balance: computeGroupBalance(g.id, expensesRef.current, user.id),
          members: [],
          userRole: g.user_role || 'member'
        }));
        setGroups(mappedGroups);
      } else if (data && data.length === 0) {
        setGroups([]);
      }
    } catch (err: any) {
      console.error('Failed to refresh groups:', err);
    } finally {
      setGroupsLoading(false);
    }
  }, [user]);

  const settleDebt = async (
    groupId: string,
    creditorId: string
  ): Promise<{ success: boolean; error: string | null }> => {
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to settle a debt.',
      };
    }

    const result = await expensesService.settleDebtToPerson(
      groupId,
      user.id,
      creditorId
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    const groupName = groups.find(g => g.id === groupId)?.name || 'group';
    setActivities(prev => [
      {
        id: `a-${Date.now()}`,
        text: `You settled a debt in ${groupName}`,
        timeAgo: 'Just now',
        isImportant: true
      },
      ...prev
    ]);

    await refreshExpenses();

    return {
      success: true,
      error: null,
    };
  };

  const refreshExpenses = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await expensesService.fetchExpensesForUser(user.id);
      if (error) {
        console.error('Error fetching Supabase expenses:', error);
      } else if (data) {
        const mappedExpenses: Expense[] = data.map((item: any) => {
          const payerProfile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
          const groupObj = Array.isArray(item.groups) ? item.groups[0] : item.groups;
          const splitsList = Array.isArray(item.expense_splits) ? item.expense_splits : [];

          const splits: Split[] = splitsList.map((s: any) => {
            const memberProf = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
            return {
              memberId: s.user_id,
              memberName: memberProf?.full_name || memberProf?.email || (s.user_id === user.id ? 'You' : 'Member'),
              amount: Number(s.amount_owed),
              isSettled: Boolean(s.is_settled)
            };
          });

          const isUserPayer = item.paid_by === user.id;
          const payerName = payerProfile?.full_name || payerProfile?.email || (isUserPayer ? 'You' : 'A member');

          // Expense is considered settled if all its splits are settled
          const allSplitsSettled = splits.length > 0 && splits.every(s => s.isSettled);

          // Relative time calculation
          const diffMs = Date.now() - new Date(item.created_at || Date.now()).getTime();
          const diffMins = Math.floor(diffMs / 60000);
          let timeAgo = 'Just now';
          if (diffMins >= 1 && diffMins < 60) timeAgo = `${diffMins}m ago`;
          else if (diffMins >= 60 && diffMins < 1440) timeAgo = `${Math.floor(diffMins / 60)}h ago`;
          else if (diffMins >= 1440 && diffMins < 2880) timeAgo = 'Yesterday';
          else if (diffMins >= 2880) timeAgo = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          const dateStr = new Date(item.expense_date || item.created_at).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric'
          });

          return {
            id: item.id,
            groupId: item.group_id,
            groupName: groupObj?.name,
            title: item.description,
            amount: Number(item.amount),
            paidBy: item.paid_by,
            paidByName: payerName,
            timeAgo,
            splits,
            dateString: dateStr,
            isSettled: allSplitsSettled
          };
        });

        setExpenses(mappedExpenses);
        expensesRef.current = mappedExpenses;

        // Update group balances dynamically based on UNSETTLED splits only
        setGroups(prevGroups => prevGroups.map(g => ({
          ...g,
          balance: computeGroupBalance(g.id, mappedExpenses, user.id)
        })));
      }
    } catch (err) {
      console.error('Failed to load expenses:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setGroupsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      await refreshExpenses();
      if (!cancelled) {
        await refreshGroups();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, refreshGroups, refreshExpenses]);

  const checkDuplicate = (title: string, amount: number, groupId?: string) => {
    const normalizedTitle = title.trim().toLowerCase();
    const match = expenses.find(exp =>
      exp.title.trim().toLowerCase() === normalizedTitle &&
      Math.abs(exp.amount - amount) < 0.01 &&
      (!groupId || exp.groupId === groupId)
    );
    return match || null;
  };

  const addExpense = async (
    newExp: Omit<Expense, 'id' | 'timeAgo'>
  ): Promise<{ success: boolean; error: string | null }> => {
    if (!user) {
      return { success: false, error: 'You must be signed in to add an expense.' };
    }

    const { expense, error } = await expensesService.createExpense({
      groupId: newExp.groupId || null,
      paidBy: newExp.paidBy,
      description: newExp.title,
      amount: newExp.amount,
      currency: 'INR',
      category: 'general',
      splitType: 'equal',
      expenseDate: new Date().toISOString().split('T')[0],
      splits: newExp.splits.map(split => ({
        userId: split.memberId,
        amountOwed: split.amount,
      })),
    });

    if (error || !expense) {
      console.error('Failed to create expense in Supabase:', error);
      return { success: false, error: error || 'Failed to create expense.' };
    }

    const expenseRecord: Expense = {
      ...newExp,
      id: expense.id,
      timeAgo: 'Just now',
    };

    setExpenses(prev => [
      expenseRecord,
      ...prev,
    ]);

    if (newExp.groupId) {
      const yourShare = newExp.splits.find(s => s.memberId === user.id)?.amount || 0;
      const isUserPayer = newExp.paidBy === user.id;
      const balanceDiff = isUserPayer ? (newExp.amount - yourShare) : -yourShare;

      setGroups(prevGroups => prevGroups.map(g => {
        if (g.id === newExp.groupId) {
          return {
            ...g,
            balance: g.balance + balanceDiff
          };
        }
        return g;
      }));
    }

    const isUserPayer = newExp.paidBy === user.id;
    const payerDisplayName = newExp.paidByName || (isUserPayer ? 'You' : (newExp.splits.find(s => s.memberId === newExp.paidBy)?.memberName || 'A member'));
    setActivities(prev => [
      {
        id: `a-${Date.now()}`,
        text: `${payerDisplayName} added ${newExp.title}${newExp.groupName ? ` to ${newExp.groupName}` : ''}`,
        timeAgo: 'Just now',
        isImportant: !isUserPayer,
      },
      ...prev,
    ]);

    refreshExpenses();

    return { success: true, error: null };
  };

  const settleUpGroup = async (groupId: string) => {
    const result = await expensesService.settleMyGroupExpenses(groupId, user!.id);
    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }
    const groupName = groups.find(g => g.id === groupId)?.name || 'group';
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, balance: 0 } : g));
    setActivities(prev => [
      { id: `a-${Date.now()}`, text: `You settled up all balances in ${groupName}`, timeAgo: 'Just now', isImportant: true },
      ...prev
    ]);
    return { success: true, error: null };
  };

  const settleFriendDebt = async (friendId: string): Promise<{ success: boolean; error: string | null }> => {
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to settle a debt.',
      };
    }

    const result = await expensesService.settleFriendDebt(friendId, user.id);
    if (!result.success) {
      return result;
    }

    await refreshExpenses();
    return { success: true, error: null };
  };

  const getFriendBalance = useCallback((friendId: string, expenseList?: Expense[]) => {
    if (!user) return 0;
    return computeFriendBalance(friendId, expenseList || expensesRef.current, user.id);
  }, [user]);

  const createGroup = async (input: CreateGroupInput): Promise<{ success: boolean; error: string | null; warning?: string }> => {
    if (user) {
      const { group, error, warning } = await groupsService.createGroup(input, user.id);
      if (error || !group) {
        return { success: false, error: error || 'Failed to create group' };
      }
      await refreshGroups();
      return { success: true, error: null, warning };
    }
    return { success: false, error: 'User not authenticated' };
  };

  const updateGroup = async (groupId: string, input: UpdateGroupInput): Promise<{ success: boolean; error: string | null }> => {
    if (user) {
      const { error } = await groupsService.updateGroup(groupId, input);
      if (error) {
        return { success: false, error };
      }
      await refreshGroups();
      return { success: true, error: null };
    }
    return { success: false, error: 'User not authenticated' };
  };

  const deleteGroup = async (groupId: string): Promise<{ success: boolean; error: string | null }> => {
    if (!user) {
      return { success: false, error: 'You must be signed in to delete a group.' };
    }

    if (!groupId) {
      return { success: false, error: 'Group ID is required.' };
    }

    const result = await groupsService.deleteGroup(groupId);

    if (result.error) {
      console.error('Failed to delete group in Supabase:', result.error);
      return { success: false, error: result.error };
    }

    setGroups(prev => prev.filter(g => g.id !== groupId));

    if (selectedGroupId === groupId) {
      setSelectedGroupId(null);
    }

    return { success: true, error: null };
  };

  const deleteExpense = async (expenseId: string): Promise<{ success: boolean; error: string | null }> => {
    const result = await expensesService.deleteExpense(expenseId);
    if (!result.success) {
      return result;
    }
    await refreshExpenses();
    return { success: true, error: null };
  };

  const updateExpense = async (expenseId: string, updates: {
    description?: string;
    amount?: number;
    paidBy?: string;
    currency?: string;
    category?: string;
    splitType?: 'equal' | 'exact' | 'percentage' | 'shares';
    expenseDate?: string;
    splits?: { userId: string; amountOwed: number }[];
  }): Promise<{ success: boolean; error: string | null }> => {
    if (!user) {
      return { success: false, error: 'You must be signed in to update an expense.' };
    }

    if (!expenseId) {
      return { success: false, error: 'Expense ID is required.' };
    }

    const result = await expensesService.updateExpense(expenseId, updates);

    if (!result.success) {
      return result;
    }

    await refreshExpenses();

    return { success: true, error: null };
  };

  const currentUser: Profile = {
    id: user?.id || profile?.id || '',
    name: profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
    email: profile?.email || user?.email || '',
  };

  return (
    <AppContext.Provider value={{
      currentScreen,
      setCurrentScreen,
      selectedGroupId,
      setSelectedGroupId,
      selectedExpenseId,
      setSelectedExpenseId,
      groups,
      groupsLoading,
      groupsError,
      expenses,
      activities,
      currentUser,
      refreshGroups,
      refreshExpenses,
      addExpense,
      checkDuplicate,
      settleDebt,
      settleUpGroup,
      settleFriendDebt,
      getFriendBalance,
      createGroup,
      updateGroup,
      deleteGroup,
      deleteExpense,
      updateExpense
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
