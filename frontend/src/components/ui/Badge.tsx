'use client';

import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}: BadgeProps) {
  const variants = {
    default: 'bg-chalk-ghost text-chalk/60 border border-chalk-ghost',
    success: 'bg-flare/10 text-flare border border-flare/20',
    warning: 'bg-flare/10 text-flare border border-flare/15',
    danger: 'bg-ember/10 text-ember border border-ember/20',
    info: 'bg-mystic/10 text-mystic border border-mystic/20',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </span>
  );
}
