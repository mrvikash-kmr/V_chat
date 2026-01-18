import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: string;
  rightElement?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, icon, rightElement, className = '', ...props }) => {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="material-symbols-rounded absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-xl">
            {icon}
          </span>
        )}
        <input
          className={`w-full h-16 ${icon ? 'pl-12' : 'pl-5'} pr-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent backdrop-blur-md outline-none text-white placeholder-zinc-500 transition-all ${className}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  );
};