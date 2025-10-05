import { cn } from '@/lib/utils';
import { Bell, X } from 'lucide-react';
import { useState } from 'react';

export interface NotificationProps {
  title: string;
  message?: string;
  onClose?: () => void;
  variant?: 'default' | 'success' | 'warning' | 'error';
  className?: string;
}

export function Notification({
  title,
  message,
  onClose,
  variant = 'default',
  className,
}: NotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  return (
    <div
      className={cn(
        "relative rounded-lg border border-border p-4 shadow-md",
        {
          'bg-card': variant === 'default',
          'bg-success/15 border-success/30': variant === 'success',
          'bg-warning/15 border-warning/30': variant === 'warning',
          'bg-destructive/15 border-destructive/30': variant === 'error',
        },
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "rounded-full p-2",
          {
            'bg-primary/10 text-primary': variant === 'default',
            'bg-success/10 text-success': variant === 'success',
            'bg-warning/10 text-warning': variant === 'warning',
            'bg-destructive/10 text-destructive': variant === 'error',
          }
        )}>
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium">{title}</h4>
          {message && <p className="mt-1 text-xs text-muted-foreground">{message}</p>}
        </div>
        {onClose && (
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        )}
      </div>
    </div>
  );
}
