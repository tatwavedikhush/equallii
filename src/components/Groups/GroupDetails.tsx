import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, CheckCircle, Trash2, Edit3, UserPlus, Shield, UserMinus, LogOut, Loader2, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { groupsService, type GroupMemberModel } from '../../services/groupsService';
import { ExpenseRow } from '../Expenses/ExpenseRow';
import { EditGroupModal } from './EditGroupModal';
import { AddMemberModal } from './AddMemberModal';
import { getCurrencySymbol } from './GroupRow';

interface GroupDetailsProps {
  onAddExpenseClick: () => void;
}

export const GroupDetails: React.FC<GroupDetailsProps> = ({ onAddExpenseClick }) => {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const { 
    setSelectedGroupId, 
    groups,
    groupsLoading,
    expenses, 
    refreshExpenses,
    settleUpGroup,
    deleteGroup,
    setSelectedExpenseId,
    setCurrentScreen
  } = useApp();

  const [dbMembers, setDbMembers] = useState<GroupMemberModel[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const group = groups.find(g => g.id === groupId);

  const loadGroupMembers = useCallback(async (groupId: string) => {
    setLoadingMembers(true);
    const { members, error } = await groupsService.fetchGroupDetails(groupId);
    if (error) {
      console.warn('Error loading group members:', error);
    } else {
      setDbMembers(members);
    }
    setLoadingMembers(false);
  }, []);

  useEffect(() => {
    if (groupId) {
      setSelectedGroupId(groupId);
      loadGroupMembers(groupId);
      refreshExpenses();
    }
  }, [groupId, loadGroupMembers, refreshExpenses, setSelectedGroupId]);

  if (!group) {
    if (groupsLoading) {
      return (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono tracking-widest text-secondary-text uppercase">Loading Group...</p>
        </div>
      );
    }

    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-secondary-text">Group not found.</p>
        <button
          onClick={() => navigate('/groups')}
          className="px-4 py-2 bg-accent text-background text-xs font-bold"
        >
          BACK TO GROUPS
        </button>
      </div>
    );
  }

  const groupExpenses = expenses.filter(e => e.groupId === group.id);
  const totalExpenses = groupExpenses.reduce((sum, e) => sum + e.amount, 0);
  const currSym = getCurrencySymbol(group.currency);

  const getMemberName = (memberId: string, fallback?: string) => {
    if (user && memberId === user.id) return 'You';
    const member = dbMembers.find(m => m.user_id === memberId);
    return member?.profile?.full_name || member?.profile?.email?.split('@')[0] || fallback || 'Member';
  };

  const outstandingDebts: {
    debtorId: string;
    debtorName: string;
    creditorId: string;
    creditorName: string;
    amount: number;
  }[] = [];

  groupExpenses.forEach(expense => {
    expense.splits.forEach(split => {
      if (split.isSettled) return;
      if (split.memberId === expense.paidBy) return;

      const existing = outstandingDebts.find(
        d => d.debtorId === split.memberId && d.creditorId === expense.paidBy
      );

      if (existing) {
        existing.amount = Math.round((existing.amount + split.amount) * 100) / 100;
      } else {
        outstandingDebts.push({
          debtorId: split.memberId,
          debtorName: getMemberName(split.memberId, split.memberName),
          creditorId: expense.paidBy,
          creditorName: getMemberName(expense.paidBy, expense.paidByName),
          amount: Math.round(split.amount * 100) / 100
        });
      }
    });
  });

  const isOwner = group.userRole === 'owner' || (user && group.created_by === user.id) || !user;

  const handleBack = () => {
    setSelectedGroupId(null);
    navigate('/groups');
  };

  const handleSettleUp = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await settleUpGroup(group.id);
      if (res && !res.success) {
        setActionError(res.error || 'Failed to settle expenses.');
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to settle expenses.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (window.confirm(`Are you sure you want to delete "${group.name}"? This action cannot be undone.`)) {
      setActionLoading(true);
      const res = await deleteGroup(group.id);
      setActionLoading(false);
      if (res.success) {
        setSelectedGroupId(null);
        navigate('/groups');
      } else {
        setActionError(res.error || 'Failed to delete group');
      }
    }
  };

  const handleRemoveMember = async (member: GroupMemberModel) => {
    const memberName = member.profile?.full_name || member.profile?.email || 'this member';
    if (window.confirm(`Remove ${memberName} from the group?`)) {
      setActionLoading(true);
      const res = await groupsService.removeGroupMember(
        group.id,
        member.id,
        member.user_id,
        user?.id,
        memberName
      );
      setActionLoading(false);

      if (res.error) {
        setActionError(res.error);
      } else {
        setDbMembers(prev => prev.filter(m => m.id !== member.id));
      }
    }
  };

  const handleLeaveGroup = async () => {
    if (!user) return;
    const myMembership = dbMembers.find(m => m.user_id === user.id);
    if (!myMembership) return;

    if (window.confirm(`Are you sure you want to leave "${group.name}"?`)) {
      setActionLoading(true);
      const res = await groupsService.removeGroupMember(
        group.id,
        myMembership.id,
        user.id,
        user.id,
        user.email
      );
      setActionLoading(false);

      if (res.error) {
        setActionError(res.error);
      } else {
        setSelectedGroupId(null);
        navigate('/groups');
      }
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Back Button */}
      <button 
        onClick={handleBack}
        className="flex items-center space-x-2 text-xs font-bold tracking-widest text-secondary-text hover:text-primary-text transition-colors cursor-pointer"
      >
        <ArrowLeft size={16} />
        <span>BACK TO GROUPS</span>
      </button>

      {actionError && (
        <div className="p-3 bg-negative/10 border border-negative/30 text-negative text-xs">
          {actionError}
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-border">
        <div className="space-y-2">
          <div className="flex items-center space-x-3 flex-wrap gap-y-1">
            <span className="text-xs font-mono font-bold text-accent">{group.number}</span>
            {group.userRole && (
              <span className={`inline-flex items-center space-x-1 text-[10px] font-bold tracking-widest px-2 py-0.5 uppercase ${
                group.userRole === 'owner' 
                  ? 'bg-accent/15 text-accent border border-accent/30' 
                  : 'bg-surface text-secondary-text border border-border'
              }`}>
                {group.userRole === 'owner' && <Shield size={10} />}
                <span>{group.userRole}</span>
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-primary-text uppercase">
            {group.name}
          </h1>

          {group.description && (
            <p className="text-sm text-secondary-text font-normal max-w-xl">
              {group.description}
            </p>
          )}

          <div className="flex items-center space-x-4 text-xs text-secondary-text/80 pt-1">
            <span className="uppercase tracking-wider">
              {dbMembers.length > 0 ? dbMembers.length : group.membersCount} MEMBERS
            </span>
            <span>•</span>
            <span className="font-mono uppercase tracking-wider font-bold text-accent">
              CURRENCY: {group.currency || 'INR'} ({currSym.trim()})
            </span>
          </div>
        </div>

        {/* Expense Balances Overview */}
        <div className="flex items-center gap-8 bg-surface/50 p-4 border border-border">
          <div>
            <p className="text-[10px] font-bold text-secondary-text tracking-widest uppercase">TOTAL EXPENSES</p>
            <p className="text-2xl md:text-3xl font-bold text-primary-text font-mono mt-0.5">
              {currSym}{totalExpenses.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="border-l border-border pl-6">
            <p className="text-[10px] font-bold text-secondary-text tracking-widest uppercase">YOUR STATUS</p>
            <p className={`text-xl font-bold font-mono mt-0.5 ${
              group.balance === 0 ? 'text-secondary-text' : group.balance > 0 ? 'text-accent' : 'text-negative'
            }`}>
              {group.balance === 0 ? 'SETTLED' : group.balance > 0 ? `+${currSym}${group.balance}` : `-${currSym}${Math.abs(group.balance)}`}
            </p>
          </div>
        </div>
      </div>

      {/* Actions Toolbar */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onAddExpenseClick}
          className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-5 py-3 bg-accent text-background font-bold tracking-wider text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>ADD EXPENSE</span>
        </button>

        <button
          onClick={() => setIsEditOpen(true)}
          className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-5 py-3 border border-border text-primary-text font-bold tracking-wider text-xs hover:border-primary-text hover:bg-surface/50 transition-colors cursor-pointer"
        >
          <Edit3 size={14} />
          <span>EDIT GROUP</span>
        </button>

        <button
          onClick={() => setIsAddMemberOpen(true)}
          className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-5 py-3 border border-border text-primary-text font-bold tracking-wider text-xs hover:border-primary-text hover:bg-surface/50 transition-colors cursor-pointer"
        >
          <UserPlus size={14} />
          <span>ADD MEMBER</span>
        </button>

        <button
          onClick={handleSettleUp}
          disabled={actionLoading || group.balance === 0}
          className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-5 py-3 border border-border text-primary-text font-bold tracking-wider text-xs hover:border-primary-text hover:bg-surface/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {actionLoading ? (
            <Loader2 size={14} className="animate-spin text-accent" />
          ) : (
            <CheckCircle size={14} />
          )}
          <span>{actionLoading ? 'SETTLING...' : 'SETTLE UP'}</span>
        </button>

        {isOwner ? (
          <button
            onClick={handleDeleteGroup}
            disabled={actionLoading}
            className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-5 py-3 border border-negative/30 hover:border-negative text-negative font-bold tracking-wider text-xs hover:bg-negative/5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={14} />
            <span>DELETE GROUP</span>
          </button>
        ) : (
          <button
            onClick={handleLeaveGroup}
            disabled={actionLoading}
            className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-5 py-3 border border-negative/30 hover:border-negative text-negative font-bold tracking-wider text-xs hover:bg-negative/5 transition-all cursor-pointer disabled:opacity-50"
          >
            <LogOut size={14} />
            <span>LEAVE GROUP</span>
          </button>
        )}
      </div>

      {/* Members Section */}
      <div className="space-y-4 pt-2">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xs font-bold tracking-widest text-secondary-text uppercase">
              MEMBERS ({dbMembers.length > 0 ? dbMembers.length : group.membersCount})
            </h2>
            <p className="text-[11px] text-secondary-text/70 mt-0.5">
              Only members can view and participate in this group's expenses.
            </p>
          </div>
          <button
            onClick={() => setIsAddMemberOpen(true)}
            className="flex items-center space-x-1 text-xs text-accent font-bold tracking-wider uppercase hover:opacity-80 transition-opacity cursor-pointer"
          >
            <UserPlus size={13} />
            <span>Add Member</span>
          </button>
        </div>

        {loadingMembers ? (
          <div className="py-6 flex items-center justify-center space-x-2 text-xs text-secondary-text">
            <Loader2 size={16} className="animate-spin text-accent" />
            <span>Loading members...</span>
          </div>
        ) : dbMembers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dbMembers.map((member) => {
              const displayName = member.profile?.full_name || member.profile?.email?.split('@')[0] || 'Member';
              const displayEmail = member.profile?.email || '—';
              const isMemberOwner = member.role === 'owner';
              const isCurrentUser = user && member.user_id === user.id;

              return (
                <div 
                  key={member.id} 
                  className="flex justify-between items-center py-3.5 px-4 bg-surface border border-border transition-colors hover:border-border/80"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-primary-text truncate">
                        {displayName} {isCurrentUser && <span className="text-secondary-text font-normal text-xs">(You)</span>}
                      </span>
                      <span className={`inline-flex items-center text-[9px] font-bold tracking-wider px-1.5 py-0.2 uppercase ${
                        isMemberOwner 
                          ? 'bg-accent/15 text-accent border border-accent/30' 
                          : 'bg-background text-secondary-text border border-border'
                      }`}>
                        {member.role}
                      </span>
                    </div>
                    <p className="text-xs text-secondary-text font-mono truncate">{displayEmail}</p>
                  </div>

                  {/* Owner remove button (cannot remove owner) */}
                  {isOwner && !isMemberOwner && (
                    <button
                      onClick={() => handleRemoveMember(member)}
                      className="p-2 text-secondary-text hover:text-negative hover:bg-negative/5 border border-transparent hover:border-negative/20 transition-all cursor-pointer ml-2"
                      title="Remove member"
                    >
                      <UserMinus size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 bg-surface/50 border border-border text-xs text-secondary-text flex items-center space-x-2">
            <Info size={14} className="text-accent shrink-0" />
            <span>Members will sync automatically with your Equallii workspace.</span>
          </div>
        )}
      </div>

      {/* Group Expenses */}
      <div className="space-y-4 pt-4">
        <h2 className="text-xs font-bold tracking-widest text-secondary-text uppercase">RECENT GROUP EXPENSES</h2>
        {groupExpenses.length > 0 ? (
          <div className="border-t border-border">
            {groupExpenses.map(expense => (
              <ExpenseRow 
                key={expense.id} 
                expense={expense} 
                onClick={() => {
                  setSelectedExpenseId(expense.id);
                  setCurrentScreen('expense-detail');
                }} 
              />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center border border-dashed border-border flex flex-col items-center justify-center space-y-3">
            <p className="text-sm text-secondary-text">No expenses logged for this group yet.</p>
            <button
              onClick={onAddExpenseClick}
              className="px-4 py-2 bg-accent text-background text-xs font-bold tracking-wider inline-flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus size={13} />
              <span>LOG FIRST EXPENSE</span>
            </button>
          </div>
        )}
      </div>

      {/* Edit Group Modal */}
      <EditGroupModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        group={group}
      />

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={isAddMemberOpen}
        onClose={() => setIsAddMemberOpen(false)}
        groupId={group.id}
        onMemberAdded={(newMember) => {
          setDbMembers(prev => [...prev, newMember]);
        }}
      />
    </div>
  );
};

