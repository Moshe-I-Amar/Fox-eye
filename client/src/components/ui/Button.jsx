import React from 'react';

const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size,
  disabled = false,
  className = '',
  ...props
}) => {
  const baseClasses =
    'font-medium rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2 focus:ring-offset-jet';

  const variants = {
    primary:  'bg-gradient-to-r from-gold to-gold-light text-jet hover:shadow-gold-glow px-6 py-3',
    secondary: 'border border-gold text-gold hover:bg-gold hover:text-jet px-6 py-3',
    outline:  'border border-gold/30 text-gold hover:border-gold px-4 py-2',
    ghost:    'text-gold hover:bg-gold/10 px-4 py-2',
  };

  // size overrides padding only when explicitly provided
  const sizes = {
    sm:    'px-3 py-1.5 text-sm',
    md:    'px-4 py-2 text-sm',
    lg:    'px-6 py-3 text-base',
    // legacy aliases used in Navbar
    small: 'px-3 py-1.5 text-sm',
    large: 'px-6 py-3 text-base',
  };

  // Strip inline padding from variant when a size is given
  const variantBase = size
    ? variants[variant].replace(/px-\S+\s*/g, '').replace(/py-\S+\s*/g, '').trim()
    : variants[variant];

  const sizeClass = size ? sizes[size] ?? '' : '';

  const classes = `${baseClasses} ${variantBase} ${sizeClass} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`.trim();

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
