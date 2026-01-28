import React from 'react';

const Card = ({ 
  children, 
  className = '', 
  padding = 'normal', 
  glass = false,
  goldBorder = false,
  ...props 
}) => {
  const baseClasses = 'rounded-xl transition-all duration-300';
  
  const paddingClasses = {
    none: '',
    small: 'p-4',
    normal: 'p-6',
    large: 'p-8'
  };

  const variantClasses = glass 
    ? 'glass-card shadow-soft hover:shadow-gold-glow' 
    : 'bg-charcoal shadow-soft hover:shadow-lg';

  const borderClasses = goldBorder ? 'gold-border' : '';

  const classes = `${baseClasses} ${variantClasses} ${paddingClasses[padding]} ${borderClasses} ${className}`;

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

export default Card;