import React from 'react';
import { ChevronRight, Users, Shield } from 'lucide-react';
import type { Group } from '../../context/AppContext';

interface GroupRowProps {
  group: Group;
  onClick: () => void;
}

export const getCurrencySymbol = (currency?: string): string => {
  switch (currency?.toUpperCase()) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'AED': return 'AED ';
    case 'JPY': return '¥';
    case 'CAD': return 'CA$';
    case 'AUD': return 'AU$';
    case 'INR':
    default:
      return '₹';
  }
};

export const GroupRow: React.FC<GroupRowProps> = ({ group, onClick }) => {
  const isPositive = group.balance >= 0;
  const currSym = getCurrencySymbol(group.currency);

  return (
    <div 
      onClick={onClick}
      className="flex justify-between items-center py-5 border-b border-border hover:bg-surface/40 px-3 cursor-pointer transition-all duration-200 group"
    >
      {/* Index and details */}
      <div className="flex items-start space-x-5 min-w-0">
        <span className="text-xs font-mono font-bold text-secondary-text mt-1 select-none w-6">
          {group.number}
        </span>
        <div className="min-w-0 space-y-1">
          <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
            <h3 className="text-lg md:text-xl font-bold tracking-tight text-primary-text group-hover:text-accent transition-colors">
              {group.name}
            </h3>
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
          
          {group.description && (
            <p className="text-xs text-secondary-text line-clamp-1">
              {group.description}
            </p>
          )}

          <div className="flex items-center space-x-3 text-xs text-secondary-text/80 pt-0.5">
            <span className="flex items-center space-x-1">
              <Users size={12} className="text-secondary-text/70" />
              <span>{group.membersCount} {group.membersCount === 1 ? 'member' : 'members'}</span>
            </span>
            <span>•</span>
            <span className="font-mono text-[11px] uppercase tracking-wider text-secondary-text/70">
              {group.currency || 'INR'}
            </span>
          </div>
        </div>
      </div>

      {/* Balance and Arrow */}
      <div className="flex items-center space-x-6 shrink-0 pl-4">
        <div className="text-right">
          <p className={`text-base font-bold font-mono ${
            group.balance === 0 ? 'text-secondary-text' : isPositive ? 'text-accent' : 'text-negative'
          }`}>
            {group.balance === 0 ? `${currSym}0` : isPositive ? `+${currSym}${group.balance}` : `-${currSym}${Math.abs(group.balance)}`}
          </p>
          <span className="text-[10px] font-bold text-secondary-text tracking-wider mt-0.5 block uppercase">
            {group.balance === 0 ? 'SETTLED' : isPositive ? "YOU'RE OWED" : 'YOU OWE'}
          </span>
        </div>
        <ChevronRight size={18} className="text-secondary-text group-hover:text-accent group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  );
};

