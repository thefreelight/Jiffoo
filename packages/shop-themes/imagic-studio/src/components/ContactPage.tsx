'use client';

import { FormEvent, useState } from 'react';
import { Mail, MessageSquare, Send, Sparkles } from 'lucide-react';
import type { ContactPageProps } from 'shared/src/types/theme';

import { StudioMain, StudioPage, StudioPanel, StudioSectionIntro } from './StudioShell';

export function ContactPage({ config, onSubmitForm }: ContactPageProps) {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const supportEmail = (config as any)?.site?.supportEmail || 'support@imagic.art';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    try {
      await onSubmitForm(formData);
      setSent(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } finally {
      setSending(false);
    }
  }

  return (
    <StudioPage activeNav="history">
      <StudioMain className="space-y-6">
        <StudioPanel>
          <StudioSectionIntro
            eyebrow="Contact"
            title="Talk to the team behind the imagic workspace."
            body="Use this lane for plan questions, creator workflow issues, billing help, or anything that needs a human review outside the normal self-serve surfaces."
          />
        </StudioPanel>

        <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-4">
            {[
              ['Support email', supportEmail, Mail],
              ['Creator workflow', 'Prompt lanes, uploads, and generation guidance', Sparkles],
              ['Billing and access', 'Plans, invoices, account locks, and purchase issues', MessageSquare],
            ].map(([title, body, Icon]) => (
              <StudioPanel key={String(title)}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-primary)]">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-xl font-semibold tracking-[-0.04em] text-[color:var(--imagic-ink)]">{title}</h2>
                <p className="mt-2 text-sm leading-7 text-[color:var(--imagic-ink-soft)]">{body}</p>
              </StudioPanel>
            ))}
          </div>

          <StudioPanel>
            {sent ? (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/14 text-emerald-300">
                  <Send className="h-6 w-6" />
                </div>
                <h2 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--imagic-ink)]">Message sent.</h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[color:var(--imagic-ink-soft)]">The team will get back to you soon. If it is urgent, send a follow-up directly to {supportEmail}.</p>
                <button type="button" onClick={() => setSent(false)} className="imagic-button-primary mt-6 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)]">
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['name', 'Name'],
                    ['email', 'Email'],
                  ].map(([key, label]) => (
                    <label key={key} className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--imagic-muted)]">{label}</span>
                      <input
                        type={key === 'email' ? 'email' : 'text'}
                        value={(formData as Record<string, string>)[key]}
                        onChange={(event) => setFormData((current) => ({ ...current, [key]: event.target.value }))}
                        className="h-12 w-full rounded-[1rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 text-sm text-[color:var(--imagic-ink)] outline-none"
                      />
                    </label>
                  ))}
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--imagic-muted)]">Subject</span>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(event) => setFormData((current) => ({ ...current, subject: event.target.value }))}
                    className="h-12 w-full rounded-[1rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 text-sm text-[color:var(--imagic-ink)] outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--imagic-muted)]">Message</span>
                  <textarea
                    rows={6}
                    value={formData.message}
                    onChange={(event) => setFormData((current) => ({ ...current, message: event.target.value }))}
                    className="w-full rounded-[1rem] border border-[color:var(--imagic-line)] bg-[color:var(--imagic-surface-elevated)] px-4 py-3 text-sm text-[color:var(--imagic-ink)] outline-none"
                  />
                </label>

                <button type="submit" disabled={sending} className="imagic-button-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-[var(--imagic-primary-shadow)] disabled:opacity-60">
                  <Send className="h-4 w-4" />
                  {sending ? 'Sending...' : 'Send message'}
                </button>
              </form>
            )}
          </StudioPanel>
        </div>
      </StudioMain>
    </StudioPage>
  );
}
