/**
 * OAuth Callback Page Component
 * Hardcore digital network infrastructure style
 */

import React from 'react';
import { Loader2, ShieldAlert, Cpu } from 'lucide-react';
import type { AuthCallbackPageProps } from '../types';
import { Button } from '../ui/Button';

export function AuthCallbackPage({ isLoading, error, config }: AuthCallbackPageProps) {
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#bdbdbd] font-mono flex items-center justify-center px-4 relative overflow-hidden">
      <div className="network-grid-bg absolute inset-0 opacity-[0.05]"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-[#141414] border border-[#2a2a2a] p-8 relative">
          {/* Decorative UI elements */}
          <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[var(--c-eae)] -mt-px -mr-px"></div>
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[var(--c-eae)] -mb-px -ml-px"></div>

          {error ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 border border-[#2a2a2a] bg-[#1c1c1c] mb-6 relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#1c1c1c]"></div>
                <ShieldAlert className="h-8 w-8 text-[#bdbdbd] animate-pulse" />
              </div>
              <h1 className="text-xl font-bold text-[#eaeaea] mb-3 tracking-widest uppercase">AUTH_HANDSHAKE_FAILED</h1>
              <p className="text-[10px] text-[#bdbdbd] mb-8 uppercase tracking-widest leading-relaxed border-y border-[#2a2a2a] py-3">{error}</p>
              <a href="/auth/login" className="block w-full">
                <Button className="w-full rounded-none text-[10px] uppercase tracking-widest border border-[#2a2a2a] bg-[#1c1c1c] hover:bg-[var(--c-fff)] hover:text-[var(--c-000)] transition-colors py-4">
                  REINITIALIZE_LOGIN_SEQUENCE
                </Button>
              </a>
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-16 w-16 border border-[#2a2a2a] bg-[#1c1c1c] mb-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-[#1c1c1c] hidden sm:block"></div>
                <Loader2 className="h-8 w-8 text-[#eaeaea] animate-spin" />
              </div>
              <h1 className="text-xl font-bold text-[#eaeaea] mb-3 tracking-widest uppercase">VERIFYING_CREDENTIALS</h1>
              <p className="text-[10px] text-[#bdbdbd] uppercase tracking-widest flex items-center justify-center gap-2">
                <Cpu className="w-3 h-3 animate-pulse text-[#bdbdbd]" />
                Processing external token...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

