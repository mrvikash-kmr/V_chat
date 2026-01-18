import React from 'react';
import { TabName } from '../types';

interface BottomNavProps {
  activeTab: TabName;
  onTabChange: (tab: TabName) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const tabs: { id: TabName; icon: string; label: string }[] = [
    { id: 'CHATS', icon: 'chat_bubble', label: 'Chats' },
    { id: 'CONTACTS', icon: 'group', label: 'Contacts' },
    { id: 'SETTINGS', icon: 'settings', label: 'Settings' },
    { id: 'PROFILE', icon: 'account_circle', label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-6 left-6 right-6 h-[72px] bg-[#141414]/90 backdrop-blur-xl border border-white/10 rounded-[32px] flex items-center justify-around px-2 z-40 shadow-2xl">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 group`}
          >
            <span 
              className={`material-symbols-rounded text-[26px] mb-1 transition-colors duration-300 ${isActive ? 'text-primary' : 'text-zinc-500 group-hover:text-zinc-300'}`}
              style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
            >
              {tab.icon}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wide transition-colors duration-300 ${isActive ? 'text-white' : 'text-zinc-500'}`}>
              {tab.label}
            </span>
            {isActive && (
              <div className="w-1 h-1 bg-primary rounded-full mt-1 animate-fade-in" />
            )}
          </button>
        );
      })}
    </nav>
  );
};