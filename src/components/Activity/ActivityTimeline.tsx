import React from 'react';
import { useApp } from '../../context/AppContext';

export const ActivityTimeline: React.FC = () => {
  const { activities } = useApp();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <span className="text-[10px] font-bold tracking-widest text-accent uppercase">TIMELINE</span>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-primary-text mt-1">ACTIVITY</h1>
        <p className="text-sm text-secondary-text mt-2 font-medium">Updates from your groups and friends</p>
      </div>

      {/* Timeline List */}
      <div className="relative border-l border-border ml-2 pl-6 space-y-8 py-2">
        {activities.map((activity) => (
          <div key={activity.id} className="relative group">
            {/* Timeline dot */}
            <span className={`absolute -left-[29px] top-1.5 w-2 h-2 rounded-full transition-transform group-hover:scale-125 ${
              activity.isImportant ? 'bg-accent' : 'bg-border'
            }`} />
            
            {/* Log item details */}
            <div className="space-y-1">
              <p className="text-sm text-primary-text font-medium leading-relaxed">
                {activity.text}
              </p>
              <p className="text-xs text-secondary-text">
                {activity.timeAgo}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
