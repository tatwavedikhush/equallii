import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

interface ExpenseDetailProps {
  isOpen: boolean;
  onClose: () => void;
  expenseId: string | null;
}

export const ExpenseDetail: React.FC<ExpenseDetailProps> = ({
  isOpen,
  onClose,
  expenseId
}) => {
  const { expenses, deleteExpense, updateExpense } = useApp();
  const { user } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('0');
  const [editPaidBy, setEditPaidBy] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const expense = expenseId ? expenses.find(e => e.id === expenseId) : undefined;

  useEffect(() => {
    if (expense) {
      setEditDescription(expense.title);
      setEditAmount(String(expense.amount));
      setEditPaidBy(expense.paidBy);
    }
  }, [expense]);

  if (!isOpen || !expenseId || !expense) return null;

  const isPaidByMe = (user && expense.paidBy === user.id) || expense.paidBy === 'You' || expense.paidBy === 'khush';
  const payerDisplay = expense.paidByName || (isPaidByMe ? 'You' : (expense.paidBy.length > 20 ? 'A member' : expense.paidBy));

  const yourShare = expense.splits.find(s =>
    (user && s.memberId === user.id) ||
    s.memberId === 'khush' ||
    s.memberName === 'Khush' ||
    s.memberName === 'You'
  )?.amount || (expense.splits.length > 0 ? Math.round((expense.amount / expense.splits.length) * 100) / 100 : expense.amount);

  const handleCloseEdit = () => {
    setIsEditing(false);
    setEditDescription(expense.title);
    setEditAmount(String(expense.amount));
    setEditPaidBy(expense.paidBy);
  };

  const handleSaveEdit = async () => {
    const numericAmount = Number(editAmount);
    if (!editDescription.trim()) {
      alert('Description is required.');
      return;
    }
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert('Amount must be greater than 0.');
      return;
    }

    const result = await updateExpense(expense.id, {
      description: editDescription.trim(),
      amount: numericAmount,
      paidBy: editPaidBy,
    });

    if (!result.success) {
      alert(result.error || 'Failed to update expense.');
      return;
    }

    handleCloseEdit();
    onClose();
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    const result = await deleteExpense(expense.id);
    setIsDeleting(false);

    if (!result.success) {
      alert(result.error || 'Failed to delete expense.');
      return;
    }

    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Container */}
      <div className="relative w-full max-w-md bg-surface border border-border rounded-none p-6 md:p-8 flex flex-col space-y-6 shadow-xl animate-in fade-in zoom-in duration-200">

        {/* Close Button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="text-secondary-text hover:text-primary-text transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Title & Amount */}
        <div className="text-center space-y-2 pb-2">
          <div className="flex items-center justify-center space-x-2">
            <h3 className="text-sm font-bold tracking-wider uppercase text-secondary-text">{expense.title}</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-elevated text-secondary-text border border-border">
              {expense.groupId ? (expense.groupName || 'Group') : 'Direct Expense'}
            </span>
          </div>
          <p className="text-5xl font-bold text-accent font-mono">₹{expense.amount}</p>
          <div className="text-xs text-secondary-text pt-2 space-y-1">
            <p>Added by <span className="text-primary-text font-semibold">{payerDisplay}</span></p>
            <p>{expense.dateString}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Payer details */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold tracking-wider uppercase text-secondary-text">PAID BY</h4>
          <div className="flex justify-between items-center text-sm">
            <span className="text-primary-text">{payerDisplay}</span>
            <span className="font-semibold text-primary-text">₹{expense.amount}</span>
          </div>
        </div>

        {/* Splits details */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold tracking-wider uppercase text-secondary-text">SPLIT</h4>
          <div className="space-y-2">
            {expense.splits.map((split, idx) => (
              <div key={idx} className="flex justify-between items-center text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-secondary-text">{split.memberName}</span>
                  {split.isSettled && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 bg-surface text-secondary-text border border-border">
                      Settled
                    </span>
                  )}
                </div>
                <span className={`font-mono ${split.isSettled ? 'text-secondary-text line-through' : 'text-primary-text'}`}>
                  ₹{split.amount}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* User Share */}
        <div className="flex justify-between items-center py-1">
          <div>
            <span className="text-xs font-bold tracking-wider uppercase text-secondary-text block">YOUR SHARE</span>
            {expense.splits.find(s => (user && s.memberId === user.id) || s.memberId === 'khush')?.isSettled && (
              <span className="text-[10px] text-secondary-text font-semibold uppercase tracking-wider">Settled</span>
            )}
          </div>
          <span className="text-xl font-bold text-accent font-mono">₹{yourShare}</span>
        </div>

        {/* Edit Form (shown when isEditing is true) */}
        {isEditing && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="edit-expense-title" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
                DESCRIPTION <span className="text-accent">*</span>
              </label>
              <input
                id="edit-expense-title"
                type="text"
                required
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                className="w-full bg-background border border-border px-4 py-3 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors placeholder:text-secondary-text/50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-expense-amount" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
                AMOUNT (₹) <span className="text-accent">*</span>
              </label>
              <input
                id="edit-expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={editAmount}
                onChange={e => setEditAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-background border border-border px-4 py-3 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors placeholder:text-secondary-text/50 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-expense-paid-by" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
                PAID BY <span className="text-accent">*</span>
              </label>
              <select
                id="edit-expense-paid-by"
                required
                value={editPaidBy}
                onChange={e => setEditPaidBy(e.target.value)}
                className="w-full bg-background border border-border px-4 py-3 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors cursor-pointer"
              >
                <option value="">Select payer</option>
                {expense.splits.length > 0 ? (
                  expense.splits.map(s => (
                    <option key={s.memberId} value={s.memberId}>
                      {s.memberName} {user && s.memberId === user.id ? '(You)' : ''}
                    </option>
                  ))
                ) : (
                  user && <option value={user.id}>You</option>
                )}
              </select>
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCloseEdit}
                className="py-2 px-4 text-xs font-bold tracking-wider text-secondary-text hover:text-primary-text hover:border-secondary-text transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="py-2 px-4 text-xs font-bold tracking-wider bg-accent text-background hover:opacity-90 active:scale-98 transition-all cursor-pointer text-center"
              >
                Update Expense
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
          <button
            onClick={() => onClose()}
            className="py-3 border border-border text-xs font-bold tracking-wider text-secondary-text hover:text-primary-text hover:border-secondary-text transition-colors cursor-pointer text-center"
          >
            CANCEL
          </button>
          <button
            onClick={() => setIsEditing(true)}
            className="py-3 border border-primary/20 hover:border-primary text-xs font-bold tracking-wider text-primary hover:bg-primary/5 transition-colors cursor-pointer text-center"
          >
            EDIT
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="py-3 border border-negative/30 hover:border-negative text-xs font-bold tracking-wider text-negative hover:bg-negative/5 transition-colors cursor-pointer text-center"
          >
            DELETE
          </button>
        </div>
      </div>

      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-sm bg-surface border border-border rounded-none p-6 md:p-8 flex flex-col space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-start justify-between">
              <h3 className="text-base font-bold text-primary-text tracking-wide">
                Delete expense?
              </h3>
              <button
                onClick={() => !isDeleting && setShowDeleteConfirm(false)}
                className="text-secondary-text hover:text-primary-text transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Description */}
            <p className="text-xs text-secondary-text leading-relaxed">
              Are you sure you want to delete this expense? This action cannot be undone.
            </p>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
                className="py-3 border border-border text-xs font-bold tracking-wider text-secondary-text hover:text-primary-text hover:border-secondary-text transition-colors cursor-pointer text-center disabled:opacity-50"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="py-3 bg-negative text-white text-xs font-bold tracking-wider hover:opacity-90 active:scale-98 transition-all cursor-pointer text-center disabled:opacity-50"
              >
                {isDeleting ? 'DELETING...' : 'DELETE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
