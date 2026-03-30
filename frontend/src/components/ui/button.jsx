import * as React from 'react';
import { cn } from '../../lib/utils';

const Button = React.forwardRef(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm',
      secondary: 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 shadow-sm',
      ghost: 'hover:bg-slate-100 hover:text-slate-900 text-slate-600',
      destructive: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
      outline: 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-900'
    };

    const sizes = {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 px-3 text-xs',
      lg: 'h-10 px-6',
      icon: 'h-9 w-9'
    };

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };