import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, AlertCircle, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { DuplicateExpenseModal } from './DuplicateExpenseModal';
import type { Expense, Split } from '../../context/AppContext';
import { supabase } from '../../database/supabaseClient';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultGroupId?: string | null;
  defaultFriendId?: string | null;
  initialType?: 'group' | 'friend';
}

interface MemberOption {
  id: string;
  full_name: string;
  email?: string;
}

interface FriendProfile {
  id: string;
  name: string;
  email: string;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  defaultGroupId = null,
  defaultFriendId = null,
  initialType = 'group'
}) => {
  const { groups, addExpense, checkDuplicate } = useApp();
  const { user, profile } = useAuth();

  const [expenseType, setExpenseType] = useState<'group' | 'friend'>(initialType);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(''); // UUID
  const [selectedGroupId, setSelectedGroupId] = useState('');

  // Friend Email Lookup States
  const [friendEmail, setFriendEmail] = useState('');
  const [isSearchingFriend, setIsSearchingFriend] = useState(false);
  const [friendLookupError, setFriendLookupError] = useState<string | null>(null);
  const [foundFriend, setFoundFriend] = useState<FriendProfile | null>(null);

  const [groupMembers, setGroupMembers] = useState<MemberOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [duplicateCheckResult, setDuplicateCheckResult] = useState<Expense | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const lookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const type = defaultFriendId ? 'friend' : (defaultGroupId ? 'group' : (initialType || 'group'));
      setExpenseType(type);
      setTitle('');
      setAmount('');
      setSelectedGroupId(defaultGroupId || (groups.length > 0 ? groups[0].id : ''));
      setFriendEmail('');
      setFoundFriend(null);
      setFriendLookupError(null);
      setPaidBy(user?.id || '');
      setErrorMessage(null);
      setIsSubmitting(false);
      setDuplicateCheckResult(null);
      setShowDuplicateModal(false);

      // If defaultFriendId is provided, pre-populate friend
      if (defaultFriendId) {
        (async () => {
          setIsSearchingFriend(true);
          try {
            const { data: prof } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', defaultFriendId)
              .maybeSingle();

            if (prof) {
              setFriendEmail(prof.email || '');
              setFoundFriend({
                id: prof.id,
                name: prof.full_name || prof.email?.split('@')[0] || 'Friend',
                email: prof.email || ''
              });
            }
          } catch (err) {
            console.warn('Error fetching default friend profile:', err);
          } finally {
            setIsSearchingFriend(false);
          }
        })();
      }
    }
  }, [isOpen, defaultGroupId, defaultFriendId, initialType, user?.id, groups]);

  // Lookup friend by email with debounce
  const lookupUserByEmail = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setFoundFriend(null);
      setFriendLookupError(null);
      setIsSearchingFriend(false);
      return;
    }

    const currentEmail = user?.email?.trim().toLowerCase();
    if (currentEmail && cleanEmail === currentEmail) {
      setFoundFriend(null);
      setFriendLookupError('You cannot enter your own email.');
      setIsSearchingFriend(false);
      return;
    }

    setIsSearchingFriend(true);
    setFriendLookupError(null);

    try {
      const { data: matchedProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (profileError) {
        console.error('Profile lookup error:', profileError);
        setFoundFriend(null);
        setFriendLookupError('Error looking up user.');
      } else if (!matchedProfile) {
        setFoundFriend(null);
        setFriendLookupError('No Equallii user found with this email.');
      } else {
        const friendData: FriendProfile = {
          id: matchedProfile.id,
          name: matchedProfile.full_name || matchedProfile.email?.split('@')[0] || 'Friend',
          email: matchedProfile.email || cleanEmail
        };
        setFoundFriend(friendData);
        setFriendLookupError(null);
      }
    } catch (err: any) {
      console.error('Profile lookup failed:', err);
      setFoundFriend(null);
      setFriendLookupError('Failed to lookup user.');
    } finally {
      setIsSearchingFriend(false);
    }
  };

  const handleEmailChange = (newEmail: string) => {
    setFriendEmail(newEmail);
    setFoundFriend(null);
    setFriendLookupError(null);

    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
    }

    if (!newEmail.trim()) {
      setIsSearchingFriend(false);
      return;
    }

    lookupTimeoutRef.current = setTimeout(() => {
      lookupUserByEmail(newEmail);
    }, 400);
  };

  // Fetch group members when group changes
  useEffect(() => {
    if (expenseType !== 'group' || !selectedGroupId) {
      setGroupMembers([]);
      return;
    }

    const fetchGroupMembers = async () => {
      setLoadingMembers(true);

      try {
        const { data, error } = await supabase
          .from('group_members')
          .select(`
            user_id,
            profiles:user_id (
              id,
              full_name,
              email
            )
          `)
          .eq('group_id', selectedGroupId);

        if (error) {
          console.warn('Error fetching group members with join, trying fallback:', error.message);
          const { data: rawMembers } = await supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', selectedGroupId);

          if (rawMembers && rawMembers.length > 0) {
            const userIds = rawMembers.map(m => m.user_id);
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', userIds);

            const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name || p.email]));
            const fallbackMembers: MemberOption[] = userIds.map(uid => ({
              id: uid,
              full_name: profileMap.get(uid) || (uid === user?.id ? 'You' : 'Member')
            }));
            setGroupMembers(fallbackMembers);
          } else {
            setGroupMembers([]);
          }
        } else if (data) {
          const members: MemberOption[] = data.map((item: any) => {
            const prof = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
            return {
              id: item.user_id,
              full_name: prof?.full_name || prof?.email || (item.user_id === user?.id ? 'You' : 'Member')
            };
          }).filter(Boolean);

          setGroupMembers(members);

          // If current paidBy is not in the fetched group, default to current user or first member
          if (user?.id && members.some(m => m.id === user.id)) {
            setPaidBy(user.id);
          } else if (members.length > 0) {
            setPaidBy(members[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load group members:', err);
        setGroupMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchGroupMembers();
  }, [selectedGroupId, user?.id, expenseType]);

  if (!isOpen) return null;

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  const calculateEqualSplit = (
    totalAmount: number,
    members: MemberOption[]
  ): Split[] => {
    if (members.length === 0) return [];

    const totalPaise = Math.round(totalAmount * 100);
    const baseAmount = Math.floor(totalPaise / members.length);
    const remainder = totalPaise % members.length;

    return members.map((member, index) => {
      const amountInPaise = baseAmount + (index < remainder ? 1 : 0);
      return {
        memberId: member.id,
        memberName: member.full_name,
        amount: amountInPaise / 100
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const numericAmount = Number(amount);
    if (!title.trim()) {
      setErrorMessage('Please enter a description for the expense.');
      return;
    }
    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0.');
      return;
    }

    if (expenseType === 'group') {
      if (!selectedGroupId) {
        setErrorMessage('Please select a group for this expense.');
        return;
      }
    } else {
      // Friend Expense validations
      const cleanEmail = friendEmail.trim().toLowerCase();
      if (!cleanEmail) {
        setErrorMessage("Please enter friend's email.");
        return;
      }

      if (user?.email && cleanEmail === user.email.toLowerCase()) {
        setErrorMessage('You cannot enter your own email.');
        return;
      }

      if (!foundFriend) {
        setErrorMessage(friendLookupError || 'No Equallii user found with this email.');
        return;
      }
    }

    if (!paidBy) {
      setErrorMessage('Please select who paid for this expense.');
      return;
    }

    // Check for duplicate expense
    const duplicate = checkDuplicate(
      title,
      numericAmount,
      expenseType === 'group' ? (selectedGroupId || undefined) : undefined
    );
    if (duplicate) {
      setDuplicateCheckResult(duplicate);
      setShowDuplicateModal(true);
      return;
    }

    executeAdd();
  };

  const executeAdd = async () => {
    const numericAmount = Number(amount);

    if (expenseType === 'group') {
      if (!selectedGroupId) {
        setErrorMessage('Please select a group.');
        return;
      }
      if (!paidBy) {
        setErrorMessage('Please select who paid for the expense.');
        return;
      }
      if (groupMembers.length === 0) {
        setErrorMessage('No members found in this group to split the expense with.');
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      const groupName = selectedGroup?.name || undefined;
      const splits = calculateEqualSplit(numericAmount, groupMembers);
      const payerMember = groupMembers.find(m => m.id === paidBy);
      const payerName = payerMember?.full_name || (paidBy === user?.id ? 'You' : 'A member');

      const result = await addExpense({
        title: title.trim(),
        amount: numericAmount,
        paidBy: paidBy,
        paidByName: payerName,
        groupId: selectedGroupId,
        groupName,
        splits,
        dateString: new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      });

      setIsSubmitting(false);

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to create expense. Please try again.');
        return;
      }

      onClose();
    } else {
      // Friend 1-on-1 Expense
      if (!user) return;
      if (!foundFriend) {
        setErrorMessage('Please enter a valid friend email.');
        return;
      }
      if (!paidBy) {
        setErrorMessage('Please select who paid for the expense.');
        return;
      }

      setIsSubmitting(true);
      setErrorMessage(null);

      const friendName = foundFriend.name;
      const userName = profile?.full_name || user?.user_metadata?.full_name || 'You';

      const friendMembers: MemberOption[] = [
        { id: user.id, full_name: userName },
        { id: foundFriend.id, full_name: friendName }
      ];

      const splits = calculateEqualSplit(numericAmount, friendMembers);
      const payerName = paidBy === user.id ? 'You' : friendName;

      const result = await addExpense({
        title: title.trim(),
        amount: numericAmount,
        paidBy: paidBy,
        paidByName: payerName,
        groupId: undefined, // Non-group expense (group_id = NULL)
        splits,
        dateString: new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      });

      setIsSubmitting(false);

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to create friend expense. Please try again.');
        return;
      }

      onClose();
    }
  };

  const handleConfirmSame = () => {
    setShowDuplicateModal(false);
    onClose();
  };

  const handleAddAnyway = () => {
    setShowDuplicateModal(false);
    executeAdd();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Form Container */}
        <div className="relative w-full max-w-md max-h-[90vh] sm:max-h-[85vh] overflow-y-auto bg-surface border border-border rounded-none p-5 sm:p-6 md:p-8 flex flex-col space-y-4 sm:space-y-6 shadow-2xl animate-in fade-in zoom-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between shrink-0">
            <span className="text-xs font-bold tracking-wider uppercase text-secondary-text">ADD EXPENSE</span>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-secondary-text hover:text-primary-text transition-colors cursor-pointer disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          {/* Group vs Friend Segmented Toggle */}
          <div className="flex border border-border p-0.5 bg-background shrink-0">
            <button
              type="button"
              onClick={() => {
                setExpenseType('group');
                setPaidBy(user?.id || '');
              }}
              className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer ${
                expenseType === 'group'
                  ? 'bg-accent text-background font-extrabold'
                  : 'text-secondary-text hover:text-primary-text'
              }`}
            >
              GROUP EXPENSE
            </button>
            <button
              type="button"
              onClick={() => {
                setExpenseType('friend');
                setPaidBy(user?.id || '');
              }}
              className={`flex-1 py-2 text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer ${
                expenseType === 'friend'
                  ? 'bg-accent text-background font-extrabold'
                  : 'text-secondary-text hover:text-primary-text'
              }`}
            >
              FRIEND (1-ON-1)
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start space-x-2.5 p-3 bg-negative/10 border border-negative/30 text-negative text-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title */}
            <div className="space-y-1.5">
              <label htmlFor="expense-title" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
                DESCRIPTION <span className="text-accent">*</span>
              </label>
              <input
                id="expense-title"
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Dinner, Movie, Groceries"
                className="w-full bg-background border border-border px-4 py-3 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors placeholder:text-secondary-text/50"
              />
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label htmlFor="expense-amount" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
                AMOUNT (₹) <span className="text-accent">*</span>
              </label>
              <input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-background border border-border px-4 py-3 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors placeholder:text-secondary-text/50 font-mono"
              />
            </div>

            {/* Group or Friend Selection */}
            {expenseType === 'group' ? (
              <div className="space-y-1.5">
                <label htmlFor="expense-group" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
                  GROUP <span className="text-accent">*</span>
                </label>
                <select
                  id="expense-group"
                  required
                  value={selectedGroupId}
                  onChange={e => setSelectedGroupId(e.target.value)}
                  className="w-full bg-background border border-border px-4 py-3 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors cursor-pointer"
                >
                  <option value="">Select a Group</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              /* Friend's Email Input */
              <div className="space-y-1.5">
                <label htmlFor="expense-friend-email" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
                  FRIEND'S EMAIL <span className="text-accent">*</span>
                </label>
                <div className="relative">
                  <input
                    id="expense-friend-email"
                    type="email"
                    required
                    value={friendEmail}
                    onChange={e => handleEmailChange(e.target.value)}
                    onBlur={() => {
                      if (friendEmail.trim() && !foundFriend && !isSearchingFriend) {
                        lookupUserByEmail(friendEmail);
                      }
                    }}
                    placeholder="friend@example.com"
                    className="w-full bg-background border border-border px-4 py-3 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors placeholder:text-secondary-text/50 font-mono"
                  />
                  {isSearchingFriend && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 size={16} className="animate-spin text-accent" />
                    </div>
                  )}
                </div>

                {/* Feedback message */}
                {foundFriend && (
                  <p className="text-xs text-accent font-semibold flex items-center space-x-1 pt-0.5">
                    <Check size={13} strokeWidth={2.5} />
                    <span>✓ {foundFriend.name} found</span>
                  </p>
                )}
                {friendLookupError && (
                  <p className="text-xs text-negative font-medium pt-0.5">
                    {friendLookupError}
                  </p>
                )}
              </div>
            )}

            {/* Split Preview */}
            {expenseType === 'group' && selectedGroupId && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold tracking-wider uppercase text-secondary-text">
                  SPLIT BETWEEN ({groupMembers.length} {groupMembers.length === 1 ? 'MEMBER' : 'MEMBERS'})
                </label>
                {loadingMembers ? (
                  <div className="py-2.5 px-3 bg-background border border-border text-xs text-secondary-text flex items-center space-x-2">
                    <Loader2 size={13} className="animate-spin text-accent" />
                    <span>Loading members...</span>
                  </div>
                ) : groupMembers.length > 0 ? (
                  <div className="border border-border bg-background max-h-[120px] overflow-y-auto divide-y divide-border">
                    {groupMembers.map(member => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between px-3 py-2 text-xs"
                      >
                        <span className="text-primary-text font-medium truncate">
                          {member.full_name} {member.id === user?.id ? '(You)' : ''}
                        </span>
                        <span className="font-mono text-secondary-text font-semibold">
                          ₹{groupMembers.length > 0 ? (Number(amount || 0) / groupMembers.length).toFixed(2) : '0.00'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-2.5 px-3 bg-background border border-border text-xs text-secondary-text">
                    No members found in this group
                  </div>
                )}
              </div>
            )}

            {expenseType === 'friend' && foundFriend && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold tracking-wider uppercase text-secondary-text">
                  EQUAL SPLIT (50 / 50)
                </label>
                <div className="border border-border bg-background divide-y divide-border">
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-primary-text font-medium">You</span>
                    <span className="font-mono text-secondary-text font-semibold">
                      ₹{(Number(amount || 0) / 2).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 text-xs">
                    <span className="text-primary-text font-medium truncate">
                      {foundFriend.name}
                    </span>
                    <span className="font-mono text-secondary-text font-semibold">
                      ₹{(Number(amount || 0) / 2).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Paid By Select */}
            <div className="space-y-1.5">
              <label htmlFor="expense-paid-by" className="text-xs font-bold tracking-wider uppercase text-secondary-text">
                PAID BY <span className="text-accent">*</span>
              </label>
              <select
                id="expense-paid-by"
                required
                value={paidBy}
                onChange={e => setPaidBy(e.target.value)}
                className="w-full bg-background border border-border px-4 py-3 text-sm text-primary-text rounded-none focus:outline-none focus:border-accent transition-colors cursor-pointer"
              >
                {expenseType === 'group' ? (
                  groupMembers.length === 0 ? (
                    <option value={user?.id || ''}>You</option>
                  ) : (
                    groupMembers.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.full_name} {member.id === user?.id ? '(You)' : ''}
                      </option>
                    ))
                  )
                ) : (
                  <>
                    <option value={user?.id || ''}>You</option>
                    {foundFriend && (
                      <option value={foundFriend.id}>
                        {foundFriend.name}
                      </option>
                    )}
                  </>
                )}
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || loadingMembers || isSearchingFriend}
                className="w-full py-3.5 bg-accent text-background font-bold tracking-wider text-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer text-center flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>ADDING...</span>
                  </>
                ) : (
                  <span>ADD EXPENSE</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <DuplicateExpenseModal
        isOpen={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        onConfirmSame={handleConfirmSame}
        onAddAnyway={handleAddAnyway}
        duplicateExpense={duplicateCheckResult}
      />
    </>
  );
};
