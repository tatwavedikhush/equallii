import React from 'react';
import { Plus } from 'lucide-react';

interface AddExpenseButtonProps {
  onClick: () => void;
}

export const AddExpenseButton: React.FC<AddExpenseButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="hidden md:flex items-center space-x-2 px-5 py-3.5 bg-accent text-background font-bold tracking-wider text-xs hover:opacity-90 active:scale-98 transition-all duration-200 cursor-pointer"
    >
      <Plus size={14} strokeWidth={2.5} />
      <span>ADD EXPENSE</span>
    </button>
  );
};
