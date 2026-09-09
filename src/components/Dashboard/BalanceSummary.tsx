import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export const BalanceSummary: React.FC = () => {
  const { groups, expenses, getFriendBalance } = useApp();
  const { user } = useAuth();

  // Compute overall balances dynamically across both groups and 1-to-1 friend expenses
  // You're owed = Sum of positive balances in groups + positive balances with friends
  // You owe = Sum of negative balances in groups + negative balances with friends
  const { owedAmount, oweAmount, totalBalance } = useMemo(() => {
    // 1. Group balances
    let groupOwed = 0;
    let groupOwe = 0;

    groups.forEach(g => {
      if (g.balance > 0) {
        groupOwed += g.balance;
      } else if (g.balance < 0) {
        groupOwe += Math.abs(g.balance);
      }
    });

    // 2. 1-to-1 Friend balances (using non-group expenses only)
    let friendOwed = 0;
    let friendOwe = 0;

    if (user) {
      const friendIds = new Set<string>();
      expenses.forEach(e => {
        if (!e.groupId) {
          if (e.paidBy && e.paidBy !== user.id) {
            friendIds.add(e.paidBy);
          }
          e.splits.forEach(s => {
            if (s.memberId !== user.id) {
              friendIds.add(s.memberId);
            }
          });
        }
      });

      friendIds.forEach(friendId => {
        const bal = getFriendBalance(friendId, expenses);
        if (bal > 0) {
          friendOwed += bal;
        } else if (bal < 0) {
          friendOwe += Math.abs(bal);
        }
      });
    }

    const totalOwed = Math.round((groupOwed + friendOwed) * 100) / 100;
    const totalOwe = Math.round((groupOwe + friendOwe) * 100) / 100;
    const total = Math.round((totalOwed - totalOwe) * 100) / 100;

    return {
      owedAmount: totalOwed,
      oweAmount: totalOwe,
      totalBalance: total
    };
  }, [groups, expenses, user, getFriendBalance]);

  return (
    <div className="space-y-12">
      {/* Total Balance */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold tracking-widest text-secondary-text uppercase">TOTAL BALANCE</span>
        <h2 className={`text-5xl md:text-6xl font-bold font-mono tracking-tight ${
          totalBalance >= 0 ? 'text-accent' : 'text-negative'
        }`}>
          ₹{totalBalance.toLocaleString('en-IN')}
        </h2>
      </div>

      {/* Owed vs Owe */}
      <div className="grid grid-cols-2 gap-8 border-t border-border pt-8 max-w-lg">
        <div className="space-y-1">
          <span className="text-[10px] font-bold tracking-widest text-secondary-text uppercase">YOU'RE OWED</span>
          <p className="text-xl md:text-2xl font-bold font-mono text-accent">
            +₹{owedAmount.toLocaleString('en-IN')}
          </p>
        </div>
        
        <div className="space-y-1">
          <span className="text-[10px] font-bold tracking-widest text-secondary-text uppercase">YOU OWE</span>
          <p className="text-xl md:text-2xl font-bold font-mono text-negative">
            -₹{oweAmount.toLocaleString('en-IN')}
          </p>
        </div>
      </div>
    </div>
  );
};
