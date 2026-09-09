import React, { useState, useMemo } from 'react';
import { UserCheck, ArrowLeft, ArrowUpRight, ArrowDownLeft, CheckCircle2, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

interface FriendsListProps {
  onAddExpenseClick?: (friendId?: string) => void;
}

export const FriendsList: React.FC<FriendsListProps> = ({ onAddExpenseClick }) => {
  const { expenses, getFriendBalance, settleFriendDebt, setSelectedExpenseId } = useApp();
  const { user } = useAuth();
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  // Extract unique friends who appear together with the current user in non-group expenses
  const friends = useMemo(() => {
    if (!user) return [];

    const friendMap = new Map<string, { id: string; name: string }>();

    expenses.forEach(e => {
      // Non-group expenses only
      if (e.groupId) return;

      const isUserPayer = e.paidBy === user.id;
      const isUserInSplits = e.splits.some(s => s.memberId === user.id);

      if (!isUserPayer && !isUserInSplits) return;

      // Payer is friend
      if (!isUserPayer && e.paidBy) {
        const name = e.paidByName || (e.paidBy.length > 20 ? 'Friend' : e.paidBy);
        if (!friendMap.has(e.paidBy)) {
          friendMap.set(e.paidBy, { id: e.paidBy, name });
        }
      }

      // Split members are friends
      e.splits.forEach(s => {
        if (s.memberId !== user.id) {
          const name = s.memberName || 'Friend';
          if (!friendMap.has(s.memberId)) {
            friendMap.set(s.memberId, { id: s.memberId, name });
          }
        }
      });
    });

    return Array.from(friendMap.values()).map(friend => ({
      ...friend,
      balance: getFriendBalance(friend.id, expenses),
    }));
  }, [expenses, user, getFriendBalance]);

  const selectedFriend = useMemo(() => {
    if (!selectedFriendId) return null;
    return friends.find(f => f.id === selectedFriendId) || null;
  }, [friends, selectedFriendId]);

  // Expenses involving the selected friend and current user where group_id IS NULL
  const friendExpenses = useMemo(() => {
    if (!selectedFriendId || !user) return [];

    return expenses.filter(e => {
      if (e.groupId) return false;

      const involvesUser = e.paidBy === user.id || e.splits.some(s => s.memberId === user.id);
      const involvesFriend = e.paidBy === selectedFriendId || e.splits.some(s => s.memberId === selectedFriendId);

      return involvesUser && involvesFriend;
    });
  }, [expenses, selectedFriendId, user]);

  const handleSettleUp = async () => {
    if (!selectedFriendId) return;
    setIsSettling(true);
    setSettleError(null);
    try {
      const result = await settleFriendDebt(selectedFriendId);
      if (!result.success) {
        setSettleError(result.error || 'Failed to settle debt.');
      }
    } catch (err: any) {
      setSettleError(err.message || 'Failed to settle debt.');
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold tracking-widest text-accent uppercase">DIRECT EXPENSES</span>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-primary-text mt-1">FRIENDS</h1>
          <p className="text-sm text-secondary-text mt-2 font-medium">1-on-1 balances and expense history</p>
        </div>

        {onAddExpenseClick && (
          <button
            onClick={() => onAddExpenseClick(selectedFriendId || undefined)}
            className="flex items-center justify-center space-x-2 px-5 py-3 bg-accent text-background font-bold tracking-wider text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer self-start md:self-auto"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>ADD EXPENSE</span>
          </button>
        )}
      </div>

      {selectedFriend ? (
        /* Friend Detail & History View */
        <div className="space-y-6">
          {/* Back Button & Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-surface border border-border">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSelectedFriendId(null)}
                className="p-2 text-secondary-text hover:text-primary-text transition-colors cursor-pointer border border-border"
                title="Back to friends list"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="w-12 h-12 rounded-full bg-elevated border border-border flex items-center justify-center font-bold text-accent text-lg">
                {selectedFriend.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-primary-text">{selectedFriend.name}</h2>
                <p className="text-xs text-secondary-text">
                  {selectedFriend.balance === 0
                    ? 'All settled up'
                    : selectedFriend.balance > 0
                    ? `Owes you ₹${selectedFriend.balance}`
                    : `You owe ₹${Math.abs(selectedFriend.balance)}`}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {onAddExpenseClick && (
                <button
                  onClick={() => onAddExpenseClick(selectedFriend.id)}
                  className="px-4 py-3 border border-border hover:border-accent text-primary-text font-bold tracking-wider text-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <Plus size={14} />
                  <span>ADD EXPENSE</span>
                </button>
              )}
              {selectedFriend.balance < 0 && (
                <button
                  onClick={handleSettleUp}
                  disabled={isSettling}
                  className="px-6 py-3 bg-accent text-background font-bold tracking-wider text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSettling ? 'SETTLING...' : 'SETTLE UP'}
                </button>
              )}
            </div>
          </div>

          {settleError && (
            <div className="p-3 bg-negative/10 border border-negative/30 text-negative text-xs">
              {settleError}
            </div>
          )}

          {/* Friend Expense History */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold tracking-wider uppercase text-secondary-text">EXPENSE HISTORY</h3>
            {friendExpenses.length === 0 ? (
              <div className="p-12 text-center border border-border bg-surface/30 space-y-2">
                <p className="text-sm text-secondary-text">No direct expenses found with {selectedFriend.name}.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {friendExpenses.map(expense => {
                  const isUserPayer = user && expense.paidBy === user.id;
                  const yourShare = expense.splits.find(s => user && s.memberId === user.id)?.amount || 0;

                  return (
                    <div
                      key={expense.id}
                      onClick={() => setSelectedExpenseId(expense.id)}
                      className="p-4 bg-surface border border-border hover:border-accent/40 transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-background border border-border text-secondary-text">
                          {isUserPayer ? (
                            <ArrowUpRight size={16} className="text-accent" />
                          ) : (
                            <ArrowDownLeft size={16} className="text-negative" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-primary-text">{expense.title}</p>
                          <p className="text-xs text-secondary-text">
                            {expense.dateString} • Paid by {isUserPayer ? 'You' : expense.paidByName || selectedFriend.name}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-bold font-mono text-primary-text">₹{expense.amount}</p>
                        <p
                          className={`text-xs font-semibold ${
                            expense.isSettled
                              ? 'text-secondary-text line-through'
                              : isUserPayer
                              ? 'text-accent'
                              : 'text-negative'
                          }`}
                        >
                          {expense.isSettled
                            ? 'Settled'
                            : isUserPayer
                            ? `+₹${expense.amount - yourShare}`
                            : `-₹${yourShare}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Friends List View */
        <div className="space-y-4">
          {friends.length === 0 ? (
            <div className="py-20 text-center space-y-4 border border-border bg-surface/30 p-8">
              <div className="w-12 h-12 bg-surface border border-border rounded-full flex items-center justify-center mx-auto text-secondary-text">
                <UserCheck size={24} />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-primary-text">No direct friend expenses yet</p>
                <p className="text-xs text-secondary-text max-w-sm mx-auto">
                  Expenses you split directly with friends outside of groups will appear here automatically.
                </p>
                {onAddExpenseClick && (
                  <div className="pt-2">
                    <button
                      onClick={() => onAddExpenseClick()}
                      className="px-5 py-2.5 bg-accent text-background font-bold tracking-wider text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer inline-flex items-center space-x-1.5"
                    >
                      <Plus size={14} />
                      <span>SPLIT WITH A FRIEND</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {friends.map(friend => {
                const isSettled = friend.balance === 0;
                const isOwed = friend.balance > 0;

                return (
                  <div
                    key={friend.id}
                    onClick={() => setSelectedFriendId(friend.id)}
                    className="p-5 bg-surface border border-border hover:border-accent/50 transition-all cursor-pointer flex items-center justify-between group shadow-sm"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="w-10 h-10 rounded-full bg-elevated border border-border flex items-center justify-center font-bold text-accent text-sm shrink-0">
                        {friend.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-primary-text group-hover:text-accent transition-colors">
                          {friend.name}
                        </h3>
                        <p className="text-xs text-secondary-text">
                          {isSettled ? (
                            <span className="inline-flex items-center space-x-1 text-secondary-text">
                              <CheckCircle2 size={12} className="text-secondary-text inline" />
                              <span>Settled up</span>
                            </span>
                          ) : isOwed ? (
                            <span className="text-accent font-medium">owes you</span>
                          ) : (
                            <span className="text-negative font-medium">you owe</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span
                        className={`text-base font-bold ${
                          isSettled
                            ? 'text-secondary-text'
                            : isOwed
                            ? 'text-accent'
                            : 'text-negative'
                        }`}
                      >
                        {isSettled ? '₹0' : `₹${Math.abs(friend.balance)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
