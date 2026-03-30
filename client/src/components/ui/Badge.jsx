import React from 'react';

/**
 * Badge — pill label for roles, statuses, and alerts.
 *
 * variant: 'gold' | 'green' | 'red' | 'gray' | 'blue'
 * size:    'sm' | 'md'
 */
const variantClasses = {
  gold:  'bg-gold/20 text-gold border border-gold/30',
  green: 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/30',
  red:   'bg-red-500/15 text-red-300 border border-red-500/30',
  gray:  'bg-white/5 text-gray-400 border border-white/10',
  blue:  'bg-blue-400/15 text-blue-300 border border-blue-400/30',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[10px] tracking-wider',
  md: 'px-2.5 py-1 text-xs',
};

const Badge = ({ children, variant = 'gold', size = 'md', className = '' }) => (
  <span
    className={`inline-flex items-center rounded-full font-medium uppercase ${variantClasses[variant] ?? variantClasses.gold} ${sizeClasses[size] ?? sizeClasses.md} ${className}`}
  >
    {children}
  </span>
);

export default Badge;
