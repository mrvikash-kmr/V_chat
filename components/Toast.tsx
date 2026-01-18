import React, { useEffect } from 'react';

interface ToastProps {
    message: string;
    type: 'success' | 'error' | 'info';
    onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColors = {
        success: 'bg-green-500/90 border-green-400/50',
        error: 'bg-red-500/90 border-red-400/50',
        info: 'bg-blue-500/90 border-blue-400/50'
    };

    const icons = {
        success: 'check_circle',
        error: 'error',
        info: 'info'
    };

    return (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl backdrop-blur-md shadow-2xl border ${bgColors[type]} text-white min-w-[300px] animate-fade-in`}>
            <span className="material-symbols-rounded text-xl">{icons[type]}</span>
            <span className="font-medium text-sm">{message}</span>
        </div>
    );
};