import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// BeforeInstallPromptEvent interface
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PwaInstallState {
  // Whether the beforeinstallprompt event has been captured
  isInstallable: boolean;
  // Whether the app is already installed (detected via display mode)
  isInstalled: boolean;
  // Whether installation is currently in progress
  isPrompting: boolean;
  // Last installation outcome
  installOutcome: 'accepted' | 'dismissed' | null;
  // Error message if any
  error: string | null;
  // Platform information
  platform: string | null;
  // ISO timestamp of when prompt was last dismissed
  lastDismissedAt: string | null;
}

interface PwaInstallActions {
  // Initialize and set up event listeners
  initialize: () => void;
  // Prompt user to install the app
  promptInstall: () => Promise<boolean>;
  // Dismiss the prompt (e.g., when user closes banner)
  dismissPrompt: () => void;
  // Check if we should show the prompt (respects one-week cooldown)
  shouldShowPrompt: () => boolean;
  // Clear error
  clearError: () => void;
  // Reset state
  reset: () => void;
}

const initialState: PwaInstallState = {
  isInstallable: false,
  isInstalled: false,
  isPrompting: false,
  installOutcome: null,
  error: null,
  platform: null,
  lastDismissedAt: null,
};

// Store the deferred prompt event
let deferredPrompt: BeforeInstallPromptEvent | null = null;

// Check if app is already installed
const checkIsInstalled = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check display mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
  const isMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches;

  // Check for iOS standalone mode
  const isIOSStandalone = 'standalone' in window.navigator && (window.navigator as any).standalone === true;

  return isStandalone || isFullscreen || isMinimalUI || isIOSStandalone;
};

// Check if a week has passed since last dismissal
const hasWeekPassed = (lastDismissedAt: string | null): boolean => {
  if (!lastDismissedAt) {
    return true; // Never dismissed before
  }

  const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
  const lastDismissed = new Date(lastDismissedAt);
  const now = new Date();

  return (now.getTime() - lastDismissed.getTime()) >= oneWeekInMs;
};

export const usePwaInstall = create<PwaInstallState & PwaInstallActions>()(
  persist(
    (set, get) => ({
      // State
      ...initialState,

      // Actions
      initialize: () => {
        if (typeof window === 'undefined') {
          return;
        }

        // Check if app is already installed
        const isInstalled = checkIsInstalled();
        set({ isInstalled });

        // If already installed, no need to capture install prompt
        if (isInstalled) {
          return;
        }

        // Handle beforeinstallprompt event
        const handleBeforeInstallPrompt = (e: Event) => {
          // Prevent the mini-infobar from appearing on mobile
          e.preventDefault();

          // Stash the event so it can be triggered later
          deferredPrompt = e as BeforeInstallPromptEvent;

          // Update state to show install is available
          set({
            isInstallable: true,
            error: null,
          });
        };

        // Handle successful installation
        const handleAppInstalled = () => {
          // Clear the deferred prompt
          deferredPrompt = null;

          // Update state
          set({
            isInstallable: false,
            isInstalled: true,
            installOutcome: 'accepted',
          });
        };

        // Add event listeners
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        // Cleanup function (note: Zustand doesn't have built-in cleanup, but we store this for reference)
        // In a React component, you would call this in useEffect cleanup
        return () => {
          window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
          window.removeEventListener('appinstalled', handleAppInstalled);
        };
      },

      promptInstall: async () => {
        const state = get();

        // Check if installation is available
        if (!state.isInstallable || !deferredPrompt) {
          set({ error: 'Installation prompt is not available' });
          return false;
        }

        // Check if already installed
        if (state.isInstalled) {
          set({ error: 'App is already installed' });
          return false;
        }

        try {
          set({ isPrompting: true, error: null });

          // Show the install prompt
          await deferredPrompt.prompt();

          // Wait for the user to respond to the prompt
          const choiceResult = await deferredPrompt.userChoice;

          // Update state based on user choice
          set({
            isPrompting: false,
            installOutcome: choiceResult.outcome,
            platform: choiceResult.platform,
            // If accepted, isInstalled will be set by appinstalled event
            // If dismissed, keep isInstallable true so they can try again
            isInstallable: choiceResult.outcome === 'dismissed',
            // Record dismissal timestamp if user dismissed
            lastDismissedAt: choiceResult.outcome === 'dismissed' ? new Date().toISOString() : state.lastDismissedAt,
          });

          // Clear the deferred prompt (can only be used once)
          if (choiceResult.outcome === 'accepted') {
            deferredPrompt = null;
          }

          return choiceResult.outcome === 'accepted';
        } catch (error: unknown) {
          set({
            isPrompting: false,
            error: (error as Error).message || 'Failed to show install prompt',
          });
          return false;
        }
      },

      dismissPrompt: () => {
        // Record dismissal timestamp
        set({
          lastDismissedAt: new Date().toISOString(),
        });
      },

      shouldShowPrompt: () => {
        const state = get();

        // Don't show if already installed
        if (state.isInstalled) {
          return false;
        }

        // Don't show if not installable
        if (!state.isInstallable) {
          return false;
        }

        // Check if a week has passed since last dismissal
        return hasWeekPassed(state.lastDismissedAt);
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        deferredPrompt = null;
        set(initialState);
      },
    }),
    {
      name: 'pwa-install-storage',
      // Only persist outcome, platform info, and dismissal tracking
      partialize: (state) => ({
        installOutcome: state.installOutcome,
        platform: state.platform,
        isInstalled: state.isInstalled,
        lastDismissedAt: state.lastDismissedAt,
      }),
    }
  )
);
