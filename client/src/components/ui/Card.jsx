import React from 'react';

/**
 * Card — glass-morphism container.
 *
 * loading: shows an animated skeleton instead of children
 * rows:    number of skeleton rows when loading=true (default 3)
 */
const Card = ({
  children,
  className = '',
  padding = 'normal',
  glass = false,
  goldBorder = false,
  loading = false,
  rows = 3,
  ...props
}) => {
  const baseClasses = 'rounded-xl transition-all duration-300';

  const paddingClasses = {
    none:   '',
    small:  'p-4',
    normal: 'p-6',
    large:  'p-8',
  };

  const variantClasses = glass
    ? 'glass-card shadow-soft hover:shadow-gold-glow'
    : 'bg-charcoal shadow-soft hover:shadow-lg';

  const borderClasses = goldBorder ? 'gold-border' : '';

  const classes = `${baseClasses} ${variantClasses} ${paddingClasses[padding] ?? paddingClasses.normal} ${borderClasses} ${className}`;

  if (loading) {
    return (
      <div className={classes} {...props}>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className={`loading-skeleton rounded-md h-4 ${i === 0 ? 'w-2/3' : i === rows - 1 ? 'w-1/2' : 'w-full'}`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
};

export default Card;
