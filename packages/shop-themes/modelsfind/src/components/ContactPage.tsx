import React from 'react';
import { Mail, Send, Sparkles } from 'lucide-react';
import type { ContactPageProps } from 'shared/src/types/theme';

export const ContactPage = React.memo(function ContactPage({ onSubmitForm }: ContactPageProps) {
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const canSubmit = Boolean(
    formData.name.trim() && formData.email.trim() && formData.subject.trim() && formData.message.trim()
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setStatus(null);
    setSubmitError(null);
    try {
      await onSubmitForm({
        name: formData.name.trim(),
        email: formData.email.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
      });
      setStatus('Message sent.');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to send message.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modelsfind-shell min-h-screen px-4 pb-32 pt-20 [font-family:var(--modelsfind-body)] text-[var(--modelsfind-ink)]">
      <div className="mx-auto max-w-[1120px]">
        <section className="modelsfind-frame overflow-hidden rounded-[2rem] border border-[var(--modelsfind-line-strong)] p-4 md:p-6 xl:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(20rem,0.72fr)]">
            <div className="modelsfind-hero overflow-hidden rounded-[1.8rem] border border-[var(--modelsfind-line)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,108,240,0.24),transparent_24%),radial-gradient(circle_at_78%_18%,rgba(214,184,255,0.14),transparent_20%),linear-gradient(180deg,rgba(10,8,14,0.82),rgba(10,8,14,0.96))]" />
              <div className="relative z-10 flex min-h-[22rem] flex-col justify-end px-6 pb-8 pt-10 md:px-10 md:pb-10 md:pt-12">
                <p className="text-[10px] uppercase tracking-[0.32em] text-[var(--modelsfind-primary)]">Contact</p>
                <h1 className="mt-4 [font-family:var(--modelsfind-display)] text-[clamp(2.8rem,7vw,4.8rem)] leading-[0.92] tracking-[-0.05em] text-white">
                  Reach the concierge team directly.
                </h1>
                <p className="mt-4 max-w-[34rem] text-sm leading-7 text-[var(--modelsfind-copy)]">
                  Support and inquiry forms should feel like part of the product, with the same visual restraint as the booking flow.
                </p>
              </div>
            </div>
            <form
              onSubmit={handleSubmit}
              className="rounded-[1.6rem] border border-[var(--modelsfind-line)] bg-[rgba(17,14,20,0.92)] p-6"
            >
              <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[var(--modelsfind-primary)]">
                <Mail className="h-4 w-4" />
                Inquiry form
              </div>
              <div className="mt-5 grid gap-4">
                {[
                  ['name', 'Name'],
                  ['email', 'Email'],
                  ['subject', 'Subject'],
                ].map(([key, label]) => (
                  <label key={key} className="grid gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">{label}</span>
                    <input
                      type={key === 'email' ? 'email' : 'text'}
                      value={formData[key as 'name' | 'email' | 'subject']}
                      onChange={(event) => setFormData((prev) => ({ ...prev, [key]: event.target.value }))}
                      className="modelsfind-field h-12 rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 text-sm text-[var(--modelsfind-ink)]"
                    />
                  </label>
                ))}
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">Message</span>
                  <textarea
                    value={formData.message}
                    onChange={(event) => setFormData((prev) => ({ ...prev, message: event.target.value }))}
                    className="modelsfind-field min-h-[140px] rounded-[1rem] border border-[var(--modelsfind-line)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--modelsfind-ink)]"
                  />
                </label>
              </div>
              {submitError ? (
                <div className="mt-4 rounded-[1rem] border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200">
                  {submitError}
                </div>
              ) : null}
              {status ? (
                <div className="mt-4 rounded-[1rem] border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">
                  {status}
                </div>
              ) : null}
              <button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--modelsfind-primary),var(--modelsfind-primary-strong))] px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#140d16] shadow-[0_0_24px_var(--modelsfind-glow)] disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? 'Sending...' : 'Send message'}
              </button>
              <div className="mt-5 inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[var(--modelsfind-copy-soft)]">
                <Sparkles className="h-4 w-4 text-[var(--modelsfind-primary)]" />
                Keep support accessible without breaking the luxury mood.
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
});

