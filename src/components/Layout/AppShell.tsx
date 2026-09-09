import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNavigation } from './BottomNavigation';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ProtectedRoute } from '../Auth/ProtectedRoute';
import { PublicRoute } from '../Auth/PublicRoute';
import { Login } from '../Auth/Login';
import { Signup } from '../Auth/Signup';
import { BalanceSummary } from '../Dashboard/BalanceSummary';
import { RecentExpenses } from '../Dashboard/RecentExpenses';
import { AddExpenseButton } from '../Dashboard/AddExpenseButton';
import { AddExpenseModal } from '../Expenses/AddExpenseModal';
import { ExpenseDetail } from '../Expenses/ExpenseDetail';
import { GroupList } from '../Groups/GroupList';
import { GroupDetails } from '../Groups/GroupDetails';
import { FriendsList } from '../Friends/FriendsList';
import { ActivityTimeline } from '../Activity/ActivityTimeline';
import { ProfileSettings } from '../Profile/ProfileSettings';

const ProtectedLayout: React.FC = () => {
  const { selectedExpenseId, setSelectedExpenseId } = useApp();
  const { user, profile } = useAuth();
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [addExpenseType, setAddExpenseType] = useState<'group' | 'friend'>('group');
  const [addExpenseGroupId, setAddExpenseGroupId] = useState<string | null>(null);
  const [addExpenseFriendId, setAddExpenseFriendId] = useState<string | null>(null);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  const handleOpenAddExpense = (options?: { type?: 'group' | 'friend'; groupId?: string; friendId?: string }) => {
    setAddExpenseType(options?.type || 'group');
    setAddExpenseGroupId(options?.groupId || null);
    setAddExpenseFriendId(options?.friendId || null);
    setIsAddExpenseOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-primary-text flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Panel */}
      <main className="flex-1 md:ml-[240px] px-6 py-8 md:px-12 md:py-12 pb-28 md:pb-12 max-w-[1200px] w-full mx-auto">
        <Routes>
          <Route
            path="/"
            element={
              <div className="space-y-12 animate-in fade-in duration-200">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div>
                    <span className="text-xs font-mono font-bold text-secondary-text uppercase">
                      {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()}
                    </span>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-primary-text mt-1">
                      Good afternoon, {displayName}
                    </h1>
                    <p className="text-sm text-secondary-text mt-2 font-medium">Your finances at a glance.</p>
                  </div>
                  <AddExpenseButton onClick={() => handleOpenAddExpense({ type: 'group' })} />
                </div>

                {/* Financial Summary */}
                <BalanceSummary />

                {/* Recent list */}
                <div className="max-w-3xl pt-4">
                  <RecentExpenses onExpenseClick={(id) => setSelectedExpenseId(id)} />
                </div>
              </div>
            }
          />
          <Route
            path="/groups"
            element={
              <div className="animate-in fade-in duration-200">
                <GroupList />
              </div>
            }
          />
          <Route
            path="/groups/:groupId"
            element={
              <div className="animate-in fade-in duration-200">
                <GroupDetails onAddExpenseClick={() => handleOpenAddExpense({ type: 'group' })} />
              </div>
            }
          />
          <Route
            path="/friends"
            element={
              <div className="animate-in fade-in duration-200">
                <FriendsList onAddExpenseClick={(friendId) => handleOpenAddExpense({ type: 'friend', friendId })} />
              </div>
            }
          />
          <Route
            path="/activity"
            element={
              <div className="animate-in fade-in duration-200">
                <ActivityTimeline />
              </div>
            }
          />
          <Route
            path="/profile"
            element={
              <div className="animate-in fade-in duration-200">
                <ProfileSettings />
              </div>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNavigation onAddExpenseClick={() => handleOpenAddExpense({ type: 'group' })} />

      {/* Add Expense Form Modal */}
      <AddExpenseModal
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        initialType={addExpenseType}
        defaultGroupId={addExpenseGroupId}
        defaultFriendId={addExpenseFriendId}
      />

      {/* Expense Detail Overlay Modal */}
      <ExpenseDetail
        isOpen={selectedExpenseId !== null}
        onClose={() => setSelectedExpenseId(null)}
        expenseId={selectedExpenseId}
      />
    </div>
  );
};

export const AppShell: React.FC = () => {
  return (
    <Routes>
      {/* Public Guest Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <ProtectedLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default AppShell;
