import React from 'react';
import { Mail, MessageSquareText } from 'lucide-react';
import type { ContactPageProps } from '../types/theme';

export const ContactPage = React.memo(function ContactPage({
  config,
  onSubmitForm,
}: ContactPageProps) {
  const [form, setForm] = React.useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmitForm(form);
      setForm({ name: '', email: '', subject: '', message: '' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--vault-bg)] px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1080px] gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(20rem,0.75fr)]">
        <section className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)] sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Contact</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--vault-ink)]">
                Need help with a digital order?
              </h1>
              <p className="mt-3 text-sm leading-7 text-[var(--vault-copy)]">
                Use the form below for delivery questions, order issues, or account-center recovery requests.
              </p>
            </div>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={submit}>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Your name"
              className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
            />
            <input
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Email"
              className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
            />
            <input
              value={form.subject}
              onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Subject"
              className="h-12 w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 text-sm text-[var(--vault-ink)] outline-none"
            />
            <textarea
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              rows={6}
              placeholder="Tell us what you need help with"
              className="w-full rounded-xl border border-[var(--vault-line)] bg-[var(--vault-surface)] px-4 py-3 text-sm text-[var(--vault-ink)] outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--vault-primary)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--vault-primary-strong)] disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send message'}
            </button>
          </form>
        </section>

        <aside className="rounded-[var(--vault-radius-lg)] border border-[var(--vault-line)] bg-[var(--vault-surface)] p-6 shadow-[var(--vault-shadow-soft)] sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--vault-primary-soft)] text-[var(--vault-primary)]">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--vault-copy-soft)]">Support email</p>
              <a
                href={`mailto:${config?.site?.supportEmail || 'support@example.com'}`}
                className="mt-1 inline-block text-sm font-semibold text-[var(--vault-ink)] underline underline-offset-4"
              >
                {config?.site?.supportEmail || 'support@example.com'}
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
});
