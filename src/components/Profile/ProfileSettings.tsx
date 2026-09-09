import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProfileSettings: React.FC = () => {
  const { user, profile, signOut, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const displayEmail = profile?.email || user?.email || '';

  const handleSignOut = async () => {
    setIsSigningOut(true);
    const { error } = await signOut();
    setIsSigningOut(false);
    if (error) {
      alert(`Sign out error: ${error}`);
    } else {
      navigate('/login', { replace: true });
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    setStatusMsg('Sending password reset link...');
    const { error } = await resetPassword(user.email);
    if (error) {
      setStatusMsg(`Error: ${error}`);
    } else {
      setStatusMsg('Password reset link sent to your email.');
    }
  };

  const sections = [
    {
      title: 'ACCOUNT',
      items: ['Personal Information', 'Payment Methods']
    },
    {
      title: 'PREFERENCES',
      items: ['Notifications', 'Appearance']
    },
    {
      title: 'SECURITY',
      items: ['Change Password', 'Sign Out']
    }
  ];

  return (
    <div className="space-y-10 max-w-md pb-12">
      {/* Header Profile Info */}
      <div className="space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-primary-text">PROFILE</h1>

        {statusMsg && (
          <div className="p-3 bg-surface border border-accent/30 text-accent text-xs rounded-lg font-medium">
            {statusMsg}
          </div>
        )}

        <div className="flex items-center space-x-4 pt-4">
          <div className="w-16 h-16 rounded-full bg-elevated border border-border flex items-center justify-center font-bold text-accent text-2xl uppercase">
            {displayName.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary-text">{displayName}</h2>
            <p className="text-sm text-secondary-text mt-0.5">{displayEmail}</p>
            <p className="text-[11px] text-secondary-text/70 mt-1 font-mono">ID: {user?.id}</p>
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-8">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-4">
            <div className="border-t border-border pt-6" />
            <h3 className="text-xs font-bold tracking-widest text-secondary-text uppercase">
              {section.title}
            </h3>
            <div className="flex flex-col space-y-4">
              {section.items.map((item, itemIdx) => {
                const isSignOut = item === 'Sign Out';
                const isChangePassword = item === 'Change Password';

                return (
                  <button
                    key={itemIdx}
                    disabled={isSignOut && isSigningOut}
                    onClick={() => {
                      if (isSignOut) {
                        handleSignOut();
                      } else if (isChangePassword) {
                        handleChangePassword();
                      } else {
                        alert(`${item} settings coming soon.`);
                      }
                    }}
                    className={`text-left text-sm font-medium transition-colors hover:text-accent cursor-pointer flex items-center space-x-2 ${isSignOut ? 'text-negative hover:text-negative/80' : 'text-primary-text'
                      }`}
                  >
                    <span>{item}</span>
                    {isSignOut && isSigningOut && <Loader2 size={14} className="animate-spin" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
