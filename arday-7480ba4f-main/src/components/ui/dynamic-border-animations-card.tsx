import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type RoleVariant = 'super-admin' | 'school-admin' | 'teacher' | 'student' | 'parent' | 'default';

interface AnimatedCardProps {
  variant?: RoleVariant;
  title?: string;
  highlight?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<RoleVariant, { border: string; accent: string; glow: string }> = {
  'super-admin': {
    border: 'via-super-admin',
    accent: 'bg-super-admin/10 text-super-admin',
    glow: 'bg-super-admin/5',
  },
  'school-admin': {
    border: 'via-school-admin',
    accent: 'bg-school-admin/10 text-school-admin',
    glow: 'bg-school-admin/5',
  },
  teacher: {
    border: 'via-teacher',
    accent: 'bg-teacher/10 text-teacher',
    glow: 'bg-teacher/5',
  },
  student: {
    border: 'via-student',
    accent: 'bg-student/10 text-student',
    glow: 'bg-student/5',
  },
  parent: {
    border: 'via-parent',
    accent: 'bg-parent/10 text-parent',
    glow: 'bg-parent/5',
  },
  default: {
    border: 'via-primary',
    accent: 'bg-primary/10 text-primary',
    glow: 'bg-primary/5',
  },
};

const highlightTextColor: Record<RoleVariant, string> = {
  'super-admin': 'text-super-admin',
  'school-admin': 'text-school-admin',
  teacher: 'text-teacher',
  student: 'text-student',
  parent: 'text-parent',
  default: 'text-primary',
};

const buttonStyles: Record<RoleVariant, string> = {
  'super-admin': 'bg-super-admin text-super-admin-foreground',
  'school-admin': 'bg-school-admin text-school-admin-foreground',
  teacher: 'bg-teacher text-teacher-foreground',
  student: 'bg-student text-student-foreground',
  parent: 'bg-parent text-parent-foreground',
  default: 'bg-primary text-primary-foreground',
};

const AnimatedCard = ({
  variant = 'default',
  title = 'Dynamic Border',
  highlight = 'Animations',
  description = 'This card features animated border elements that continuously move around the perimeter, creating a dynamic visual effect using React and Tailwind CSS.',
  children,
  className,
}: AnimatedCardProps) => {
  const topRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);

  const styles = variantStyles[variant];

  useEffect(() => {
    const animateBorder = () => {
      const now = Date.now() / 1000;
      const speed = 0.5;

      const topX = Math.sin(now * speed) * 100;
      const rightY = Math.cos(now * speed) * 100;
      const bottomX = Math.sin(now * speed + Math.PI) * 100;
      const leftY = Math.cos(now * speed + Math.PI) * 100;

      if (topRef.current) topRef.current.style.transform = `translateX(${topX}%)`;
      if (rightRef.current) rightRef.current.style.transform = `translateY(${rightY}%)`;
      if (bottomRef.current) bottomRef.current.style.transform = `translateX(${bottomX}%)`;
      if (leftRef.current) leftRef.current.style.transform = `translateY(${leftY}%)`;

      requestAnimationFrame(animateBorder);
    };

    const animationId = requestAnimationFrame(animateBorder);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div className={cn('relative w-full max-w-lg mx-auto rounded-2xl bg-card p-[2px] overflow-hidden shadow-lg', className)}>
      {/* Animated border elements */}
      <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden">
        <div ref={topRef} className={cn('h-full w-1/3 bg-gradient-to-r from-transparent to-transparent', styles.border)} />
      </div>

      <div className="absolute top-0 right-0 bottom-0 w-[2px] overflow-hidden">
        <div ref={rightRef} className={cn('w-full h-1/3 bg-gradient-to-b from-transparent to-transparent', styles.border)} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden">
        <div ref={bottomRef} className={cn('h-full w-1/3 bg-gradient-to-r from-transparent to-transparent', styles.border)} />
      </div>

      <div className="absolute top-0 left-0 bottom-0 w-[2px] overflow-hidden">
        <div ref={leftRef} className={cn('w-full h-1/3 bg-gradient-to-b from-transparent to-transparent', styles.border)} />
      </div>

      {/* Content */}
      <div className="relative rounded-2xl bg-card p-8 space-y-6">
        <h2 className="text-2xl font-bold text-foreground">
          {title}{' '}
          <span className={highlightTextColor[variant]}>{highlight}</span>
        </h2>

        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>

        {children ?? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="rounded-lg border border-border p-3 hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn('flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold', styles.accent)}>
                      {item}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Feature {item}</p>
                      <p className="text-xs text-muted-foreground">Description of feature</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button className={cn('w-full py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity', buttonStyles[variant])}>
              Explore More
            </button>
          </>
        )}
      </div>

      {/* Decorative elements */}
      <div className={cn('absolute top-4 right-4 w-20 h-20 rounded-full blur-xl animate-float', styles.glow)} />
      <div className={cn('absolute bottom-4 left-4 w-16 h-16 rounded-full blur-xl animate-float', styles.glow)} style={{ animationDelay: '1s' }} />
    </div>
  );
};

export default AnimatedCard;
