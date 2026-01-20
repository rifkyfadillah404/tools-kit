import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-900/50 animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
      />
      <div
        className={`relative bg-white dark:bg-ink-900 rounded-lg shadow-xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-hidden animate-[slideUp_200ms_ease-out]`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100 dark:border-ink-700">
          <h3 className="text-lg font-semibold text-ink-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-ink-400 hover:text-ink-600 hover:bg-ink-100 dark:text-ink-400 dark:hover:text-ink-200 dark:hover:bg-ink-800 rounded-md transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)] dark:text-ink-200">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-ink-100 dark:border-ink-700 bg-ink-50 dark:bg-ink-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
