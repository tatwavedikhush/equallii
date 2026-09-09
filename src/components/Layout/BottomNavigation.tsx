import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Users, UserCheck, Bell, User, Plus } from 'lucide-react';

interface BottomNavigationProps {
  onAddExpenseClick: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ onAddExpenseClick }) => {
  const navItems = [
    { path: '/', label: 'HOME', icon: Home },
    { path: '/groups', label: 'GROUPS', icon: Users },
    { path: '/friends', label: 'FRIENDS', icon: UserCheck },
    { path: '/activity', label: 'ACTIVITY', icon: Bell },
    { path: '/profile', label: 'YOU', icon: User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border pb-safe-bottom">
      {/* Floating Add Expense Button */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
        <button
          onClick={onAddExpenseClick}
          className="w-12 h-12 bg-accent text-background rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform duration-200 cursor-pointer"
          aria-label="Add expense"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex justify-around items-center h-16 pt-2">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className="flex flex-col items-center justify-center w-16 py-1 cursor-pointer"
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} className={isActive ? 'stroke-accent' : 'stroke-secondary-text'} />
                  <span
                    className={`text-[10px] font-bold tracking-wider mt-1 transition-colors ${
                      isActive ? 'text-accent' : 'text-secondary-text'
                    }`}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
};
