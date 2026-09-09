import React from 'react';
import { useApp } from '../../context/AppContext';
import { ExpenseRow } from '../Expenses/ExpenseRow';

interface RecentExpensesProps {
  onExpenseClick: (id: string) => void;
}

export const RecentExpenses: React.FC<RecentExpensesProps> = ({ onExpenseClick }) => {
  const { expenses } = useApp();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold tracking-widest text-secondary-text uppercase">RECENT EXPENSES</h3>
      </div>
      
      {expenses.length > 0 ? (
        <div className="border-t border-border">
          {expenses.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              onClick={() => onExpenseClick(expense.id)}
            />
          ))}
        </div>
      ) : (
        <div className="py-8 text-center border border-dashed border-border text-secondary-text text-sm">
          No expenses added yet.
        </div>
      )}
    </div>
  );
};
