import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { useApp, type Group } from '../../context/AppContext';

interface EditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group;
}

export const EditGroupModal: React.FC<EditGroupModalProps> = ({ isOpen, onClose, group }) => {
  const { updateGroup } = useApp();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [currency, setCurrency] = useState(group.currency || 'INR');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(group.name);
      setDescription(group.description || '');
      setCurrency(group.currency || 'INR');
      setErrorMessage(null);
    }
  }, [isOpen, group]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await updateGroup(group.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      currency: currency
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to update group');
      return;
    }

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
      <div className="relative w-full max-w-md bg-surface border border-border rounded-none p-6 md:p-8 flex flex-col space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-accent">MANAGE GROUP</span>
            <h2 className="text-xl font-bold tracking-tight text-primary-text mt-0.5">EDIT GROUP DETAILS</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-secondary-text hover:text-primary-text transition-colors cursor-pointer p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error */}
        {errorMessage && (
          <div className="flex items-start space-x-2.5 p-3 bg-negative/10 border border-negative/30 text-negative text-xs">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label htmlFor="edit-group-name" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
              GROUP NAME <span className="text-accent">*</span>
            </label>
            <input
              id="edit-group-name"
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-background border border-border px-4 py-3 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="edit-group-desc" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
              DESCRIPTION
            </label>
            <input
              id="edit-group-desc"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Vacation with friends"
              className="w-full bg-background border border-border px-4 py-2.5 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors placeholder:text-secondary-text/50"
            />
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <label htmlFor="edit-group-currency" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
              CURRENCY
            </label>
            <select
              id="edit-group-currency"
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full bg-background border border-border px-4 py-2.5 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors cursor-pointer"
            >
              <option value="INR">INR (₹) — Indian Rupee</option>
              <option value="USD">USD ($) — US Dollar</option>
              <option value="EUR">EUR (€) — Euro</option>
              <option value="GBP">GBP (£) — British Pound</option>
              <option value="AED">AED (د.إ) — UAE Dirham</option>
              <option value="CAD">CAD ($) — Canadian Dollar</option>
              <option value="AUD">AUD ($) — Australian Dollar</option>
              <option value="SGD">SGD ($) — Singapore Dollar</option>
            </select>
          </div>

          {/* Action */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-accent text-background font-bold tracking-wider text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer text-center flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>SAVING CHANGES...</span>
                </>
              ) : (
                <span>SAVE CHANGES</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
