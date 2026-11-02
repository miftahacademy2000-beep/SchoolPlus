import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'primary' | 'success' | 'warning' | 'destructive' | 'info' | 'super-admin' | 'teacher' | 'student';
  className?: string;
  delay?: number;
}

export function StatCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend = 'neutral',
  color = 'primary',
  className,
  delay = 0,
}: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
    info: 'bg-info/10 text-info',
    'super-admin': 'bg-super-admin/10 text-super-admin',
    teacher: 'bg-teacher/10 text-teacher',
    student: 'bg-student/10 text-student',
  };

  const trendColors = {
    up: 'text-success',
    down: 'text-destructive',
    neutral: 'text-muted-foreground',
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn('stat-card', className)}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1">
              <TrendIcon className={cn('h-4 w-4', trendColors[trend])} />
              <span className={cn('text-sm font-medium', trendColors[trend])}>
                {change > 0 ? '+' : ''}{change}%
              </span>
              {changeLabel && (
                <span className="text-sm text-muted-foreground">{changeLabel}</span>
              )}
            </div>
          )}
        </div>
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', colorClasses[color])}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
