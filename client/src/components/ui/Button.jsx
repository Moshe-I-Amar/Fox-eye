import React from 'react';

const Button = ({ 
  children, 
  onClick, 
  type = 'button', 
  variant = 'primary', 
  disabled = false, 
  className = '', 
  ...props 
}) => {
  const baseClasses = 'font-medium rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  const variants = {
    primary: 'bg-gradient-to-r from-gold to-gold-light text-jet hover:shadow-gold-glow focus:ring-gold px-6 py-3',
    secondary: 'border border-gold text-gold hover:bg-gold hover:text-jet px-6 py-3',
    outline: 'border border-gold/30 text-gold hover:border-gold px-4 py-2',
    ghost: 'text-gold hover:bg-gold/10 px-4 py-2'
  };

  const classes = `${baseClasses} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classes}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;