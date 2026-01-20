import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantClasses = {
  primary: 'bg-blue-600 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900/30 hover:bg-blue-700 active:transform active:scale-[0.98]',
  secondary: 'bg-white dark:bg-ink-800 text-ink-700 dark:text-ink-200 border border-ink-200 dark:border-ink-600 hover:bg-ink-50 dark:hover:bg-ink-700 active:transform active:scale-[0.98]',
  outline: 'bg-transparent text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 active:transform active:scale-[0.98]',
  ghost: 'bg-transparent text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 active:transform active:scale-[0.98]',
  danger: 'bg-red-500 text-white shadow-sm shadow-red-100 dark:shadow-red-900/30 hover:bg-red-600 active:transform active:scale-[0.98]',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs h-8',
  md: 'px-4 py-2 text-sm h-10',
  lg: 'px-6 py-3 text-base h-12',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      ) : icon ? (
        <span className="flex items-center">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
};