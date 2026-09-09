import React from 'react';
import { Receipt, ChevronRight, CheckCircle2 } from 'lucide-react';
import type { Expense } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

interface ExpenseRowProps {
  expense: Expense;
  onClick: () => void;
}

export const ExpenseRow: React.FC<ExpenseRowProps> = ({ expense, onClick }) => {
  const { user } = useAuth();
  const isPaidByMe = (user && expense.paidBy === user.id) || expense.paidBy === 'You' || expense.paidBy === 'khush';
  
  // Find user's split
  const userSplit = expense.splits.find(s => 
    (user && s.memberId === user.id) || 
    s.memberId === 'khush' || 
    s.memberName === 'Khush' ||
    s.memberName === 'You'
  );

  let isSettled = false;
  let statusText = '';
  let statusColor = '';
  let displayAmount = 0;

  if (isPaidByMe) {
    // Current user paid: calculate unsettled amounts others still owe
    const unsettledOthers = expense.splits.filter(s => 
      s.memberId !== (user?.id || 'khush') && !s.isSettled
    );
    const unsettledTotal = unsettledOthers.reduce((sum, s) => sum + s.amount, 0);

    if (unsettledOthers.length === 0 || expense.isSettled) {
      isSettled = true;
      statusText = 'SETTLED';
      statusColor = 'text-secondary-text';
    } else {
      displayAmount = Math.round(unsettledTotal * 100) / 100;
      statusText = `YOU'RE OWED ₹${displayAmount}`;
      statusColor = 'text-accent';
    }
  } else {
    // Another member paid
    if (userSplit?.isSettled || expense.isSettled) {
      isSettled = true;
      statusText = 'SETTLED';
      statusColor = 'text-secondary-text';
    } else {
      const share = userSplit?.amount || (expense.splits.length > 0 ? expense.amount / expense.splits.length : expense.amount);
      displayAmount = Math.round(share * 100) / 100;
      statusText = `YOU OWE ₹${displayAmount}`;
      statusColor = 'text-negative';
    }
  }

  const payerDisplay = expense.paidByName || (isPaidByMe ? 'You' : (expense.paidBy.length > 20 ? 'A member' : expense.paidBy));

  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between py-4 px-2 hover:bg-surface border-b border-border transition-colors duration-250 cursor-pointer group ${
        isSettled ? 'opacity-75 hover:opacity-100' : ''
      }`}
    >
      <div className="flex items-center space-x-4 min-w-0">
        {/* Icon container */}
        <div className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${
          isSettled ? 'bg-surface border-border text-secondary-text' : 'bg-elevated border-border text-secondary-text group-hover:text-accent'
        }`}>
          {isSettled ? (
            <CheckCircle2 size={18} className="text-secondary-text" />
          ) : (
            <Receipt size={18} className="transition-colors" />
          )}
        </div>
        
        {/* Details */}
        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h4 className={`text-sm font-semibold truncate group-hover:text-accent transition-colors ${
              isSettled ? 'text-secondary-text' : 'text-primary-text'
            }`}>
              {expense.title}
            </h4>
            {isSettled && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 bg-surface text-secondary-text border border-border shrink-0">
                Settled
              </span>
            )}
          </div>
          <p className="text-xs text-secondary-text mt-0.5 truncate">
            {payerDisplay} &middot; {expense.timeAgo} {expense.groupName ? `in ${expense.groupName}` : ''}
          </p>
        </div>
      </div>

      {/* Financials & Action */}
      <div className="flex items-center space-x-3 shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold text-primary-text">
            ₹{expense.amount}
          </p>
          <p className={`text-[10px] font-bold tracking-wider mt-0.5 ${statusColor}`}>
            {statusText}
          </p>
        </div>
        <ChevronRight size={16} className="text-secondary-text group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
};
