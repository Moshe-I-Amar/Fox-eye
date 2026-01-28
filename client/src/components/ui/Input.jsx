import React from 'react';

const Input = ({ 
  label, 
  error, 
  className = '', 
  containerClassName = '',
  ...props 
}) => {
  return (
    <div className={`space-y-2 ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-gold">
          {label}
        </label>
      )}
      <input
        className={`dark-input w-full ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-red-400 text-sm animate-slide-up">
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;