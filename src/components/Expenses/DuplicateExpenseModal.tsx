import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { Expense } from '../../context/AppContext';

interface DuplicateExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSame: () => void; // Discards additions because it's already there
  onAddAnyway: () => void; // Add as a separate record
  duplicateExpense: Expense | null;
}

export const DuplicateExpenseModal: React.FC<DuplicateExpenseModalProps> = ({
  isOpen,
  onClose,
  onConfirmSame,
  onAddAnyway,
  duplicateExpense
}) => {
  if (!isOpen || !duplicateExpense) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-none p-5 sm:p-6 md:p-8 flex flex-col space-y-5 sm:space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2 text-negative">
            <AlertTriangle size={20} />
            <span className="text-xs font-bold tracking-wider uppercase">POSSIBLE DUPLICATE</span>
          </div>
          <button 
            onClick={onClose} 
            className="text-secondary-text hover:text-primary-text transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div>
            <h3 className="text-2xl font-bold text-primary-text">{duplicateExpense.title}</h3>
            <p className="text-3xl font-bold text-accent mt-1">₹{duplicateExpense.amount}</p>
          </div>

          <div className="border-t border-border pt-4 text-sm text-secondary-text">
            <p>
              <span className="font-semibold text-primary-text">{duplicateExpense.paidBy}</span> added a similar expense
            </p>
            <p className="text-xs mt-1">{duplicateExpense.timeAgo}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border w-full" />

        {/* Actions */}
        <div className="flex flex-col md:flex-row-reverse gap-3 w-full">
          <button
            onClick={onConfirmSame}
            className="w-full py-3 bg-accent text-background font-bold tracking-wide text-sm hover:opacity-90 transition-opacity cursor-pointer text-center"
          >
            SAME EXPENSE
          </button>
          <button
            onClick={onAddAnyway}
            className="w-full py-3 border border-border text-secondary-text hover:text-primary-text hover:border-secondary-text font-bold tracking-wide text-sm transition-colors cursor-pointer text-center"
          >
            ADD ANYWAY
          </button>
        </div>
      </div>
    </div>
  );
};
