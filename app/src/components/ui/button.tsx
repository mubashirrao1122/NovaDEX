import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'primary' | 'secondary' | 'success' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', isLoading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-95',
          {
            // Jupiter-inspired primary button with gradient
            'bg-gradient-to-r from-primary to-primary-dark text-black hover:scale-105 hover:shadow-lg hover:shadow-primary/25': variant === 'primary',
            // Secondary button with clean blue
            'bg-secondary text-white hover:bg-secondary-dark hover:scale-105 hover:shadow-lg': variant === 'secondary',
            // Success with bright green
            'bg-success text-black hover:bg-success-dark hover:scale-105 hover:shadow-lg': variant === 'success',
            // Destructive with clean red
            'bg-destructive text-white hover:bg-destructive-dark hover:scale-105 hover:shadow-lg': variant === 'destructive',
            // Outline with modern border
            'border border-border bg-transparent hover:bg-accent hover:text-accent-foreground hover:scale-105': variant === 'outline',
            // Ghost with subtle hover
            'hover:bg-accent/50 hover:text-accent-foreground hover:scale-105': variant === 'ghost',
            // Link variant
            'underline-offset-4 hover:underline text-primary hover:text-primary-dark': variant === 'link',
            // Default card style
            'bg-card border border-border text-card-foreground hover:bg-accent hover:scale-105': variant === 'default',
            // Size variants with modern spacing
            'h-12 px-6 py-3 text-sm': size === 'default',
            'h-10 px-4 py-2 text-sm': size === 'sm',
            'h-14 px-8 py-4 text-base': size === 'lg',
            'h-12 w-12 p-0': size === 'icon',
          },
          className
        )}
        ref={ref}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading ? (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
