'use client'
import React from 'react';
import { motion, Variants } from 'framer-motion';
import { Home, Settings, Bell, User, Mail, BarChart3, HelpCircle, LogOut, LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// --- HoverGradientNavBar Component ---

interface HoverGradientMenuItem {
  icon: LucideIcon;
  label: string;
  href: string;
  gradient: string;
  iconColor: string;
}

interface HoverGradientNavBarProps {
  items?: HoverGradientMenuItem[];
  onItemClick?: (item: HoverGradientMenuItem) => void;
}

const defaultMenuItems: HoverGradientMenuItem[] = [
  { icon: Home, label: "Home", href: "#", gradient: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.06) 50%, rgba(29,78,216,0) 100%)", iconColor: "group-hover:text-blue-500 dark:group-hover:text-blue-400" },
  { icon: Bell, label: "Notifications", href: "#", gradient: "radial-gradient(circle, rgba(249,115,22,0.15) 0%, rgba(234,88,12,0.06) 50%, rgba(194,65,12,0) 100%)", iconColor: "group-hover:text-orange-500 dark:group-hover:text-orange-400" },
  { icon: Mail, label: "Messages", href: "#", gradient: "radial-gradient(circle, rgba(147,51,234,0.15) 0%, rgba(126,34,206,0.06) 50%, rgba(88,28,135,0) 100%)", iconColor: "group-hover:text-purple-500 dark:group-hover:text-purple-400" },
  { icon: BarChart3, label: "Analytics", href: "#", gradient: "radial-gradient(circle, rgba(34,197,94,0.15) 0%, rgba(22,163,74,0.06) 50%, rgba(21,128,61,0) 100%)", iconColor: "group-hover:text-green-500 dark:group-hover:text-green-400" },
  { icon: Settings, label: "Settings", href: "#", gradient: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.06) 50%, rgba(29,78,216,0) 100%)", iconColor: "group-hover:text-blue-500 dark:group-hover:text-blue-400" },
  { icon: User, label: "Profile", href: "#", gradient: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.06) 50%, rgba(185,28,28,0) 100%)", iconColor: "group-hover:text-red-500 dark:group-hover:text-red-400" },
  { icon: HelpCircle, label: "Help", href: "#", gradient: "radial-gradient(circle, rgba(20,184,166,0.15) 0%, rgba(13,148,136,0.06) 50%, rgba(15,118,110,0) 100%)", iconColor: "group-hover:text-teal-500 dark:group-hover:text-teal-400" },
  { icon: LogOut, label: "Logout", href: "#", gradient: "radial-gradient(circle, rgba(161,98,7,0.15) 0%, rgba(133,77,14,0.06) 50%, rgba(100,62,8,0) 100%)", iconColor: "group-hover:text-amber-600 dark:group-hover:text-amber-400" },
];

// Animation variants
const itemVariants: Variants = {
  initial: { rotateX: 0, opacity: 1 },
  hover: { rotateX: -90, opacity: 0 },
};

const backVariants: Variants = {
  initial: { rotateX: 90, opacity: 0 },
  hover: { rotateX: 0, opacity: 1 },
};

const glowVariants: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  hover: {
    opacity: 1,
    scale: 2,
    transition: {
      opacity: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
      scale: { duration: 0.5, type: "spring", stiffness: 300, damping: 25 },
    },
  },
};

const sharedTransition = {
  type: "spring" as const,
  stiffness: 100,
  damping: 20,
  duration: 0.5,
};

function HoverGradientNavBar({ items = defaultMenuItems, onItemClick }: HoverGradientNavBarProps): React.JSX.Element {
  return (
    <div className="w-full flex justify-center items-center py-2 sm:py-4">
      <nav className="p-1.5 sm:p-2 rounded-xl sm:rounded-2xl bg-gradient-to-b from-background/80 to-background/40 backdrop-blur-lg border border-border/40 shadow-lg max-w-full overflow-x-auto">
        <ul className="flex items-center gap-0.5 sm:gap-1 md:gap-2">
          {items.map((item: HoverGradientMenuItem) => (
            <li key={item.label}>
              {/* Mobile: Icon only with tooltip */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <motion.a
                    href={item.href}
                    onClick={(e) => {
                      if (onItemClick) {
                        e.preventDefault();
                        onItemClick(item);
                      }
                    }}
                    className="group relative flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-3 md:px-4 sm:py-2 rounded-lg sm:rounded-xl cursor-pointer transition-colors"
                    style={{ perspective: "600px" }}
                    initial="initial"
                    whileHover="hover"
                    whileTap={{ scale: 0.95 }}
                    animate="initial"
                  >
                    {/* Per-item glow */}
                    <motion.div
                      className="absolute inset-0 rounded-lg sm:rounded-xl pointer-events-none z-0"
                      style={{ background: item.gradient }}
                      variants={glowVariants}
                    />
                    
                    {/* Front-facing */}
                    <motion.span
                      className="relative z-10 flex items-center gap-1.5 sm:gap-2"
                      variants={itemVariants}
                      transition={sharedTransition}
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <span className={`transition-colors duration-300 text-muted-foreground ${item.iconColor}`}>
                        <item.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                      {/* Hide label on mobile, show on tablet+ */}
                      <span className="hidden md:inline text-xs sm:text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors whitespace-nowrap">
                        {item.label}
                      </span>
                    </motion.span>
                    
                    {/* Back-facing */}
                    <motion.span
                      className="absolute inset-0 z-10 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 py-2 sm:px-3 md:px-4"
                      variants={backVariants}
                      transition={sharedTransition}
                      style={{ transformStyle: "preserve-3d", backfaceVisibility: "hidden" }}
                    >
                      <span className={`transition-colors duration-300 ${item.iconColor.replace('group-hover:', '')}`}>
                        <item.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </span>
                      <span className="hidden md:inline text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">
                        {item.label}
                      </span>
                    </motion.span>
                  </motion.a>
                </TooltipTrigger>
                {/* Only show tooltip on mobile/tablet where labels are hidden */}
                <TooltipContent side="bottom" className="md:hidden">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export { HoverGradientNavBar, type HoverGradientMenuItem };
export default HoverGradientNavBar;
