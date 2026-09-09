import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Users, UserCheck, Bell, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = profile?.email || user?.email || '';

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/groups', label: 'Groups', icon: Users },
    { path: '/friends', label: 'Friends', icon: UserCheck },
    { path: '/activity', label: 'Activity', icon: Bell },
    { path: '/profile', label: 'Profile', icon: User }
  ];

  return (
    <aside className="hidden md:flex flex-col w-[240px] bg-background border-r border-border h-screen fixed left-0 top-0 z-30 p-6 select-none justify-between">
      {/* Top Logo */}
      <div className="flex items-center space-x-1.5 cursor-pointer" onClick={() => navigate('/')}>
        <span className="text-xl font-bold tracking-tight text-primary-text">equalli</span>
        <span className="w-2 h-2 rounded-full bg-accent mt-1.5"></span>
      </div>

      {/* Middle Navigation */}
      <nav className="flex flex-col space-y-2 flex-grow mt-10">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 text-sm font-medium transition-all duration-200 cursor-pointer ${isActive
                  ? 'text-accent font-semibold'
                  : 'text-secondary-text hover:text-primary-text hover:bg-surface/50 rounded-lg'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? 'stroke-accent' : 'stroke-secondary-text'} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Profile */}
      <div className="border-t border-border pt-4 flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/profile')}>
        <div className="w-9 h-9 rounded-full bg-elevated border border-border flex items-center justify-center font-bold text-accent text-sm shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-primary-text truncate">{displayName}</span>
          <span className="text-xs text-secondary-text truncate">{displayEmail}</span>
        </div>
      </div>
    </aside>
  );
};
