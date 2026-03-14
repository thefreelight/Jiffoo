'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePwaInstall } from '@/hooks/use-pwa-install';

interface PwaInstallBannerProps {
  /** Custom install message */
  installMessage?: string;
  /** Display position */
  position?: 'top' | 'bottom';
  /** Custom class name */
  className?: string;
}

/**
 * PWA Install Banner Component
 *
 * Displays a banner prompting users to install the PWA when the beforeinstallprompt event fires.
 * Automatically initializes PWA install detection and handles user install flow.
 */
export function PwaInstallBanner({
  installMessage = 'Install our app for a better shopping experience',
  position = 'bottom',
  className,
}: PwaInstallBannerProps) {
  const {
    isInstallable,
    isInstalled,
    isPrompting,
    error,
    initialize,
    promptInstall,
    clearError,
  } = usePwaInstall();

  const [mounted, setMounted] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  // Initialize on mount
  React.useEffect(() => {
    setMounted(true);
    initialize();
  }, [initialize]);

  // Clear error after 5 seconds
  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Handle install button click
  const handleInstall = React.useCallback(async () => {
    const success = await promptInstall();

    if (success) {
      setDismissed(true);
    }
  }, [promptInstall]);

  // Handle dismiss
  const handleDismiss = React.useCallback(() => {
    setDismissed(true);
  }, []);

  // Don't render on server
  if (!mounted) {
    return null;
  }

  const positionClass = position === 'top'
    ? 'top-0'
    : 'bottom-0';

  // Should show banner
  const shouldShow = !isInstalled && isInstallable && !dismissed;

  // Mobile-optimized animation variants (GPU-accelerated: transform & opacity only)
  const bannerVariants = {
    hidden: {
      opacity: 0,
      y: position === 'bottom' ? 100 : -100,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30,
        mass: 0.8,
      },
    },
    exit: {
      opacity: 0,
      y: position === 'bottom' ? 100 : -100,
      transition: {
        duration: 0.2,
        ease: 'easeIn',
      },
    },
  };

  // Button micro-interaction animations
  const buttonVariants = {
    tap: { scale: 0.95 },
    hover: { scale: 1.02 },
  };

  const iconVariants = {
    initial: { scale: 1, rotate: 0 },
    hover: { scale: 1.1, rotate: 5 },
  };

  return (
    <AnimatePresence mode="wait">
      {shouldShow && (
        <motion.div
          key="pwa-banner"
          variants={bannerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn(
            'fixed left-4 right-4 z-[100] px-4 py-3 rounded-xl mb-4',
            'bg-[#1c1c1c]/90 backdrop-blur-md border border-[#2a2a2a] text-[#eaeaea] shadow-2xl',
            'flex items-center justify-between gap-3',
            positionClass,
            className
          )}
          role="banner"
          aria-live="polite"
          style={{
            // Enable GPU acceleration for better mobile performance
            willChange: 'transform, opacity',
          }}
        >
          <motion.div
            className="flex items-center gap-3 flex-1 min-w-0"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
          >
            <motion.div variants={iconVariants} initial="initial" whileHover="hover">
              <Download className="h-5 w-5 flex-shrink-0" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{installMessage}</p>
              <AnimatePresence mode="wait">
                {error && (
                  <motion.p
                    key="error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-xs text-blue-100 mt-1"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <motion.div
            className="flex items-center gap-2 flex-shrink-0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <motion.button
              onClick={handleInstall}
              disabled={isPrompting}
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              className={cn(
                'px-4 py-1.5 text-sm font-medium',
                'bg-white text-blue-600',
                'rounded hover:bg-blue-50',
                'transition-colors duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label="Install app"
            >
              {isPrompting ? 'Installing...' : 'Install'}
            </motion.button>

            <motion.button
              onClick={handleDismiss}
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              className="p-1 hover:bg-blue-700 rounded transition-colors"
              aria-label="Dismiss banner"
            >
              <motion.div
                whileHover={{ rotate: 90 }}
                transition={{ duration: 0.2 }}
              >
                <X className="h-5 w-5" />
              </motion.div>
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PwaInstallBanner;
