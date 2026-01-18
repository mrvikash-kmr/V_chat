import React from 'react';
import { TabName } from '../types';

interface SideNavProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

export const SideNav: React.FC<SideNavProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: TabName; icon: string; label: string }[] = [
    { id: 'CHATS', icon: 'chat_bubble', label: 'Chats' },
    { id: 'CONTACTS', icon: 'group', label: 'People' },
    { id: 'SETTINGS', icon: 'settings', label: 'Settings' },
    { id: 'PROFILE', icon: 'account_circle', label: 'Profile' },
  ];

  return (
    <nav className="h-full w-20 bg-surface-dark border-r border-white/5 flex flex-col items-center py-8 gap-8 z-20">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-orange-500/20 mb-4">
            <span className="font-display font-bold text-xl italic">v</span>
      </div>
      
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`group relative flex flex-col items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 ${isActive ? 'bg-white/10 text-primary' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}`}
          >
            <span 
              className={`material-symbols-rounded text-2xl transition-colors duration-300`}
              style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
            >
              {tab.icon}
            </span>
            {isActive && (
               <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
            )}
            
            {/* Tooltip */}
            <div className="absolute left-14 bg-zinc-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {tab.label}
            </div>
          </button>
        );
      })}
    </nav>
  );
};