import React from 'react';

/**
 * Input — dark-themed form input.
 *
 * size:  'sm' | 'md' (default) | 'lg'
 * icon:  ReactNode rendered on the leading (left) side
 */
const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-3 text-sm',
  lg: 'px-4 py-3.5 text-base',
};

const Input = ({
  label,
  error,
  size = 'md',
  icon,
  className = '',
  containerClassName = '',
  ...props
}) => {
  const padding = sizeClasses[size] ?? sizeClasses.md;
  const hasIcon = Boolean(icon);

  return (
    <div className={`space-y-2 ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-gold">
          {label}
        </label>
      )}
      <div className="relative">
        {hasIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gold/50">
            {icon}
          </span>
        )}
        <input
          className={`dark-input w-full ${padding} ${hasIcon ? 'pl-9' : ''} ${error ? 'border-red-500' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="text-red-400 text-sm animate-slide-up">
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;
