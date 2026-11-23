'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import { resolveRequestLocale } from '@/lib/request-locale';
import type { Locale } from 'shared/src/i18n';

type BannerCopy = { message: string; install: string; installing: string; installAriaLabel: string };

/**
 * The banner lives in the root layout, above the locale segment, so it has
 * no translator: it resolves its copy from the URL and the browser languages.
 */
export const PWA_BANNER_COPY: Record<Locale, BannerCopy> = {
  en: { message: 'Install our app for a better shopping experience', install: 'Install', installing: 'Installing...', installAriaLabel: 'Install app' },
  'zh-Hans': { message: '安装我们的 App，获得更好的购物体验', install: '安装', installing: '安装中…', installAriaLabel: '安装应用' },
  'zh-Hant': { message: '安裝我們的 App，獲得更好的購物體驗', install: '安裝', installing: '安裝中…', installAriaLabel: '安裝應用程式' },
  ja: { message: 'アプリをインストールすると、より快適にショッピングできます', install: 'インストール', installing: 'インストール中…', installAriaLabel: 'アプリをインストール' },
  ko: { message: '앱을 설치하면 더 편리하게 쇼핑할 수 있어요', install: '설치', installing: '설치 중…', installAriaLabel: '앱 설치' },
  fr: { message: 'Installez notre application pour une meilleure expérience d’achat', install: 'Installer', installing: 'Installation…', installAriaLabel: 'Installer l’application' },
  de: { message: 'Installieren Sie unsere App für ein besseres Einkaufserlebnis', install: 'Installieren', installing: 'Wird installiert…', installAriaLabel: 'App installieren' },
};

/** How long the banner stays visible before auto-dismissing. */
const AUTO_DISMISS_MS = 5000;
/** Tick resolution for the auto-dismiss countdown. */
const AUTO_DISMISS_TICK_MS = 100;

interface PwaInstallBannerProps {
  /** Custom install message */
  installMessage?: string;
  /** Display position */
  position?: 'top' | 'bottom';
  /** Custom class name */
  className?: string;
}

export function isPwaInstallBannerSuppressedPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return segments.includes('auth');
}

/**
 * PWA Install Banner Component
 *
 * Displays a banner prompting users to install the PWA when the beforeinstallprompt event fires.
 * Automatically initializes PWA install detection and handles user install flow.
 */
export function PwaInstallBanner({
  installMessage,
  position = 'bottom',
  className,
}: PwaInstallBannerProps) {
  const pathname = usePathname();
  const [browserLanguages, setBrowserLanguages] = React.useState<readonly string[]>([]);
  React.useEffect(() => {
    setBrowserLanguages(typeof navigator === 'undefined' ? [] : navigator.languages);
  }, []);
  const copy = PWA_BANNER_COPY[resolveRequestLocale(pathname, browserLanguages)];
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
  const [autoDismissRemaining, setAutoDismissRemaining] = React.useState(AUTO_DISMISS_MS);
  const [interactionPaused, setInteractionPaused] = React.useState(false);

  // Initialize on mount
  React.useEffect(() => {
    setMounted(true);
    initialize();
  }, [initialize]);

  const suppressedPath = isPwaInstallBannerSuppressedPath(pathname);
  const bannerVisible = mounted && !suppressedPath && !isInstalled && isInstallable && !dismissed;

  // Restart the auto-dismiss countdown whenever the banner (re)appears
  React.useEffect(() => {
    if (bannerVisible) {
      setAutoDismissRemaining(AUTO_DISMISS_MS);
    }
  }, [bannerVisible]);

  // Auto-dismiss: count down while the banner is visible and the user is not
  // reading/interacting with it (hover or keyboard focus pauses the timer).
  React.useEffect(() => {
    if (!bannerVisible || interactionPaused) return;
    const interval = setInterval(() => {
      setAutoDismissRemaining((remaining) => {
        if (remaining <= AUTO_DISMISS_TICK_MS) {
          setDismissed(true);
          return 0;
        }
        return remaining - AUTO_DISMISS_TICK_MS;
      });
    }, AUTO_DISMISS_TICK_MS);
    return () => clearInterval(interval);
  }, [bannerVisible, interactionPaused]);

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
  const shouldShow = bannerVisible;

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
            'flex items-center justify-between gap-3 relative overflow-hidden',
            positionClass,
            className
          )}
          role="banner"
          aria-live="polite"
          onMouseEnter={() => setInteractionPaused(true)}
          onMouseLeave={() => setInteractionPaused(false)}
          onFocusCapture={() => setInteractionPaused(true)}
          onBlurCapture={() => setInteractionPaused(false)}
          style={{
            // Enable GPU acceleration for better mobile performance
            willChange: 'transform, opacity',
          }}
        >
          {/* Auto-dismiss countdown: communicates that the banner is temporary */}
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-0.5 bg-white/40"
            style={{
              width: `${(autoDismissRemaining / AUTO_DISMISS_MS) * 100}%`,
              transition: 'width 100ms linear',
            }}
          />
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
              <p className="text-sm font-medium truncate">{installMessage ?? copy.message}</p>
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
              aria-label={copy.installAriaLabel}
            >
              {isPrompting ? copy.installing : copy.install}
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
