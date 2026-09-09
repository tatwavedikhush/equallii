import React, { useState } from 'react';
import { X, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ isOpen, onClose }) => {
  const { createGroup } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [memberEmails, setMemberEmails] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddMemberField = () => {
    setMemberEmails([...memberEmails, '']);
  };

  const handleRemoveMemberField = (index: number) => {
    const updated = memberEmails.filter((_, idx) => idx !== index);
    setMemberEmails(updated);
  };

  const handleMemberChange = (index: number, value: string) => {
    const updated = [...memberEmails];
    updated[index] = value;
    setMemberEmails(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setWarningMessage(null);

    // Filter out blank member inputs and lowercase them
    const validEmails = memberEmails
      .map(m => m.trim().toLowerCase())
      .filter(Boolean);

    const res = await createGroup({
      name: name.trim(),
      description: description.trim() || undefined,
      currency: currency || 'INR',
      memberEmails: validEmails
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to create group');
      return;
    }

    if (res.warning) {
      setWarningMessage(res.warning);
      // Wait a moment before closing or let user see warning
      setTimeout(() => {
        resetForm();
        onClose();
      }, 2500);
      return;
    }

    resetForm();
    onClose();
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setCurrency('INR');
    setMemberEmails(['']);
    setErrorMessage(null);
    setWarningMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />
      
      {/* Container */}
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-none p-6 md:p-8 flex flex-col space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-accent">NEW EXPENSE GROUP</span>
            <h2 className="text-xl font-bold tracking-tight text-primary-text mt-0.5">CREATE GROUP</h2>
          </div>
          <button 
            onClick={handleClose} 
            className="text-secondary-text hover:text-primary-text transition-colors cursor-pointer p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="flex items-start space-x-2.5 p-3 bg-negative/10 border border-negative/30 text-negative text-xs">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {warningMessage && (
          <div className="flex items-start space-x-2.5 p-3 bg-accent/10 border border-accent/30 text-accent text-xs">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{warningMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group Name */}
          <div className="space-y-1.5">
            <label htmlFor="group-name" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
              GROUP NAME <span className="text-accent">*</span>
            </label>
            <input
              id="group-name"
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Goa Trip, Flatmates, Weekend Trek"
              className="w-full bg-background border border-border px-4 py-3 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors placeholder:text-secondary-text/50"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="group-desc" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
              DESCRIPTION <span className="text-secondary-text/60 font-normal lowercase">(optional)</span>
            </label>
            <input
              id="group-desc"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Shared expenses for apartment #402"
              className="w-full bg-background border border-border px-4 py-2.5 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors placeholder:text-secondary-text/50"
            />
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <label htmlFor="group-currency" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
              DEFAULT CURRENCY
            </label>
            <select
              id="group-currency"
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

          {/* Members list */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold tracking-wider uppercase text-secondary-text">
                INVITE MEMBERS BY EMAIL
              </label>
              <button
                type="button"
                onClick={handleAddMemberField}
                className="flex items-center space-x-1 text-xs text-accent hover:opacity-80 transition-opacity cursor-pointer font-bold uppercase tracking-wider"
              >
                <Plus size={12} strokeWidth={2.5} />
                <span>Add Email</span>
              </button>
            </div>
            
            <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1">
              {memberEmails.map((val, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <input
                    type="email"
                    value={val}
                    onChange={e => handleMemberChange(idx, e.target.value)}
                    placeholder={`member${idx + 1}@example.com`}
                    className="flex-1 bg-background border border-border px-4 py-2 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors placeholder:text-secondary-text/50 font-mono"
                  />
                  {memberEmails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMemberField(idx)}
                      className="p-2 text-negative hover:bg-negative/5 border border-transparent hover:border-negative/20 transition-all cursor-pointer"
                      title="Remove row"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-secondary-text/80">
              You will automatically be added as the Group Owner.
            </p>
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
                  <span>CREATING GROUP...</span>
                </>
              ) : (
                <span>CREATE GROUP</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

