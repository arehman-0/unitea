'use client';

import { forwardRef, InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-chalk/60 mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-3 py-2 bg-void-lighter border rounded-lg focus:outline-none focus:ring-2 focus:ring-ember/40 focus:border-ember/50 text-chalk placeholder:text-chalk/20 ${
            error ? 'border-ember/50' : 'border-chalk-muted'
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-ember">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
