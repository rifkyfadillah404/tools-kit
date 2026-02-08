import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export const MainLayout: React.FC = () => {
  const { token } = useAuthStore();
  const { sidebarOpen, setSidebarOpen, toasts, removeToast } = useUIStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const getToastIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} />;
      case 'error':
        return <AlertCircle size={18} />;
      default:
        return <Info size={18} />;
    }
  };

  const getToastStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-sage-600 text-white shadow-lg shadow-sage-600/20';
      case 'error':
        return 'bg-coral-600 text-white shadow-lg shadow-coral-600/20';
      default:
        return 'bg-ink-800 text-white shadow-lg shadow-ink-900/20';
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFBFC] dark:bg-[#030712] flex transition-colors duration-300">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <main className="flex-1 min-w-0 relative">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

        <div className="relative p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 space-y-3 pointer-events-none">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl ${getToastStyles(toast.type)} animate-[reveal-up_0.3s_ease-out_both]`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <span className="flex-shrink-0 opacity-90">
              {getToastIcon(toast.type)}
            </span>
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
