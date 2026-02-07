'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-void disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';

    const variants = {
      primary: 'bg-ember text-chalk hover:bg-ember/85 focus:ring-ember/50 shadow-lg shadow-ember/10',
      secondary: 'bg-void-lighter text-chalk/80 border border-chalk-muted hover:bg-chalk-ghost hover:text-chalk focus:ring-chalk-muted',
      danger: 'bg-ember/20 text-ember border border-ember/20 hover:bg-ember/30 focus:ring-ember/30',
      ghost: 'bg-transparent text-chalk/50 hover:text-chalk hover:bg-chalk-ghost focus:ring-chalk-muted',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
