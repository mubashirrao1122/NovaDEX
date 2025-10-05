import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variantClasses = {
    default: 'border-transparent bg-primary text-black hover:bg-primary/80',
    secondary: 'border-transparent bg-gray-700 text-gray-100 hover:bg-gray-600',
    destructive: 'border-transparent bg-red-600 text-white hover:bg-red-700',
    outline: 'text-foreground border-gray-600',
  };

  return (
    <div 
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variantClasses[variant],
        className
      )} 
      {...props} 
    />
  );
}

export { Badge };
