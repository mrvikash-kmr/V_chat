import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  icon,
  className = '',
  ...props 
}) => {
  const baseClasses = "h-14 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2";
  
  const variants = {
    primary: "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-900/20 hover:opacity-90",
    secondary: "bg-white text-zinc-900 hover:bg-zinc-50",
    glass: "bg-white/10 backdrop-blur-md border border-white/10 text-white hover:bg-white/20"
  };

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseClasses} ${variants[variant]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
      {icon && <span className="material-symbols-rounded">{icon}</span>}
    </button>
  );
};