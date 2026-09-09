import React, { useState } from 'react';
import { X, UserPlus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { groupsService, type GroupMemberModel } from '../../services/groupsService';
import { useAuth } from '../../context/AuthContext';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  onMemberAdded: (member: GroupMemberModel) => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  groupId,
  onMemberAdded
}) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await groupsService.addGroupMember(groupId, cleanEmail, user?.id);

    setIsSubmitting(false);

    if (res.error) {
      setErrorMessage(res.error);
      return;
    }

    if (res.member) {
      setSuccessMessage(`Added ${res.member.profile?.full_name || cleanEmail} to the group!`);
      onMemberAdded(res.member);
      setTimeout(() => {
        setEmail('');
        setSuccessMessage(null);
        onClose();
      }, 1200);
    }
  };

  const handleClose = () => {
    setEmail('');
    setErrorMessage(null);
    setSuccessMessage(null);
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
      <div className="relative w-full max-w-md bg-surface border border-border rounded-none p-6 md:p-8 flex flex-col space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-accent">MEMBERS</span>
            <h2 className="text-xl font-bold tracking-tight text-primary-text mt-0.5">ADD NEW MEMBER</h2>
          </div>
          <button 
            onClick={handleClose} 
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

        {/* Success */}
        {successMessage && (
          <div className="flex items-start space-x-2.5 p-3 bg-accent/10 border border-accent/30 text-accent text-xs">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="member-email" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
              USER EMAIL ADDRESS <span className="text-accent">*</span>
            </label>
            <input
              id="member-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-background border border-border px-4 py-3 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors font-mono placeholder:text-secondary-text/50"
            />
            <p className="text-[11px] text-secondary-text/80 mt-1">
              Member must be a registered Equallii user. They will be added with the <strong className="text-primary-text">member</strong> role.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-accent text-background font-bold tracking-wider text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer text-center flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>ADDING MEMBER...</span>
                </>
              ) : (
                <>
                  <UserPlus size={14} strokeWidth={2.5} />
                  <span>ADD TO GROUP</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
