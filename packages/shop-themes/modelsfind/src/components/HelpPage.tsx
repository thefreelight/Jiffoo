import React from 'react';
import { Bell, MoreHorizontal, Search, Send, Sparkles } from 'lucide-react';
import type { HelpPageProps } from 'shared/src/types/theme';
import {
  conciergeConversation,
  conciergePrompts,
  conciergeQuickActions,
  conciergeSuggestions,
} from '../site';

export const HelpPage = React.memo(function HelpPage({ onNavigateToContact }: HelpPageProps) {
  const [draft, setDraft] = React.useState('');

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-24 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)] sm:px-6 sm:pt-24 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        <div className="modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] bg-[rgba(10,8,12,0.96)]">
          <div className="hidden items-center justify-between border-b border-[var(--modelsfind-line)] px-5 py-4 md:flex">
            <div className="inline-flex items-center gap-2 text-[var(--modelsfind-primary)]">
              <Sparkles className="h-4 w-4" />
              <span className="[font-family:var(--modelsfind-display)] text-lg italic text-white">ModelsFind Concierge</span>
            </div>
            <div className="flex items-center gap-3 text-[var(--modelsfind-copy-soft)]">
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)]">
                <Search className="h-4 w-4" />
              </button>
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)]">
                <Bell className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-[16rem_minmax(0,1fr)] md:p-5">
            <aside className="hidden rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(15,12,18,0.92)] p-4 md:block">
              <h2 className="[font-family:var(--modelsfind-display)] text-[1.6rem] italic text-white">Recent Match Suggestions</h2>
              <div className="mt-4 grid gap-3">
                {conciergeSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.name}
                    type="button"
                    className="flex items-center gap-3 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-2.5 text-left transition-colors hover:border-[var(--modelsfind-line-strong)]"
                  >
                    <img src={suggestion.image} alt={suggestion.name} className="h-14 w-14 rounded-[0.9rem] object-cover grayscale" />
                    <div className="min-w-0">
                      <p className="[font-family:var(--modelsfind-display)] text-[1.2rem] text-white">{suggestion.name}</p>
                      <p className="truncate text-[10px] uppercase tracking-[0.14em] text-[var(--modelsfind-primary)]">
                        {suggestion.role}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {conciergeQuickActions.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className="rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </aside>

            <section className="rounded-[1.2rem] border border-[var(--modelsfind-line)] bg-[rgba(14,11,18,0.96)] p-4 md:p-5">
              <div className="flex items-center justify-between border-b border-[var(--modelsfind-line)] pb-4">
                <div>
                  <p className="[font-family:var(--modelsfind-display)] text-[2.1rem] italic text-white md:text-[2.4rem]">AI Concierge</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-[var(--modelsfind-copy-soft)]">
                    Personalizing your elite experience
                  </p>
                </div>
                <button type="button" className="hidden text-[var(--modelsfind-copy-soft)] md:inline-flex">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 grid gap-4">
                {conciergeConversation.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={message.role === 'user' ? 'ml-auto max-w-[32rem]' : 'max-w-[36rem]'}
                  >
                    <div
                      className={[
                        'rounded-[1rem] px-4 py-4 text-sm leading-6',
                        message.role === 'user'
                          ? 'bg-[rgba(58,31,69,0.72)] text-[var(--modelsfind-copy)]'
                          : 'bg-[rgba(24,22,29,0.96)] text-[var(--modelsfind-copy)]',
                      ].join(' ')}
                    >
                      {message.text}
                    </div>
                    <p
                      className={[
                        'mt-2 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]',
                        message.role === 'user' ? 'text-right' : '',
                      ].join(' ')}
                    >
                      {message.role === 'user' ? 'You · 10:43 PM' : 'Concierge · 10:42 PM'}
                    </p>
                  </div>
                ))}

                <div className="grid gap-3 md:grid-cols-2">
                  {conciergeSuggestions.slice(0, 2).map((suggestion) => (
                    <article
                      key={suggestion.name}
                      className="overflow-hidden rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)]"
                    >
                      <img src={suggestion.image} alt={suggestion.name} className="h-56 w-full object-cover grayscale" />
                      <div className="p-3">
                        <p className="[font-family:var(--modelsfind-display)] text-[1.3rem] text-white">{suggestion.name}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--modelsfind-primary)]">
                          {suggestion.role}
                        </p>
                        <div className="mt-3 flex gap-2">
                          {conciergeQuickActions.slice(0, 2).map((action) => (
                            <button
                              key={`${suggestion.name}-${action}`}
                              type="button"
                              className="rounded-full border border-[var(--modelsfind-line)] px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-[var(--modelsfind-copy-soft)]"
                            >
                              {action}
                            </button>
                          ))}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="md:hidden">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {conciergeQuickActions.map((action) => (
                      <button
                        key={action}
                        type="button"
                        className="whitespace-nowrap rounded-full border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[9px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (onNavigateToContact) {
                      onNavigateToContact();
                    }
                  }}
                  className="mt-2 flex items-center gap-3 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] p-3"
                >
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Inquire with your AI Concierge..."
                    className="h-11 flex-1 bg-transparent px-2 text-sm text-[var(--modelsfind-ink)] outline-none placeholder:text-[var(--modelsfind-copy-soft)]"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(145deg,color-mix(in_oklab,var(--modelsfind-primary)_82%,white),color-mix(in_oklab,var(--modelsfind-primary)_72%,black))] text-white"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>

                <div className="rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.02)] p-4 md:hidden">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Suggested prompts</p>
                  <div className="mt-3 grid gap-2">
                    {conciergePrompts.slice(0, 2).map((prompt) => (
                      <div key={prompt} className="rounded-[0.9rem] bg-[rgba(24,22,29,0.96)] px-4 py-3 text-sm leading-6 text-[var(--modelsfind-copy)]">
                        {prompt}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
});
