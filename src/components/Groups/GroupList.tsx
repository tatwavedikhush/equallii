import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RotateCw, FolderPlus, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GroupRow } from './GroupRow';
import { CreateGroupModal } from './CreateGroupModal';

export const GroupList: React.FC = () => {
  const { groups, groupsLoading, groupsError, refreshGroups, setSelectedGroupId } = useApp();
  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleGroupClick = (id: string) => {
    setSelectedGroupId(id);
    navigate(`/groups/${id}`);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshGroups();
    setIsRefreshing(false);
  };

  const isRecursionError = groupsError?.toLowerCase().includes('infinite recursion');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-[10px] font-bold tracking-widest text-accent uppercase">WORKSPACE</span>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-primary-text mt-1">GROUPS</h1>
          <p className="text-sm text-secondary-text mt-2 font-medium">Your shared expense spaces</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || groupsLoading}
            className="p-3.5 border border-border text-secondary-text hover:text-primary-text hover:border-primary-text transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh Groups"
          >
            <RotateCw size={16} className={`${isRefreshing || groupsLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center space-x-2 px-6 py-3.5 bg-accent text-background font-bold tracking-wider text-xs hover:opacity-90 active:scale-98 transition-all duration-200 cursor-pointer shadow-sm"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>NEW GROUP</span>
          </button>
        </div>
      </div>

      {/* RLS Policy Warning Banner */}
      {groupsError && (
        <div className="p-4 bg-negative/10 border border-negative/30 space-y-2">
          <div className="flex items-start space-x-2.5">
            <AlertTriangle size={18} className="text-negative shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-negative uppercase tracking-wide">
                Database Policy Notice
              </p>
              <p className="text-xs text-primary-text/90">
                {isRecursionError 
                  ? 'Supabase RLS infinite recursion detected in policy for "group_members". Please run the SQL fix script in your Supabase SQL Editor to update policies.' 
                  : groupsError}
              </p>
              {isRecursionError && (
                <p className="text-[11px] font-mono text-secondary-text">
                  File: src/database/fix_rls_recursion.sql
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* List / Loading / Empty */}
      {groupsLoading && groups.length === 0 ? (
        <div className="py-20 text-center border-t border-border flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono tracking-widest text-secondary-text uppercase">Loading Groups...</p>
        </div>
      ) : groups.length > 0 ? (
        <div className="border-t border-border mt-8">
          {groups.map((group) => (
            <GroupRow 
              key={group.id} 
              group={group} 
              onClick={() => handleGroupClick(group.id)} 
            />
          ))}
        </div>
      ) : (
        <div className="py-16 px-6 text-center border border-dashed border-border flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 bg-surface flex items-center justify-center text-secondary-text border border-border">
            <FolderPlus size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-primary-text">No groups yet</h3>
            <p className="text-xs text-secondary-text max-w-sm mx-auto">
              Create a group to start splitting bills, trips, or shared rent with your roommates and friends.
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="mt-2 px-5 py-2.5 bg-accent text-background font-bold tracking-wider text-xs hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center space-x-2"
          >
            <Plus size={14} />
            <span>CREATE FIRST GROUP</span>
          </button>
        </div>
      )}

      {/* Create Group Modal Overlay */}
      <CreateGroupModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
};

