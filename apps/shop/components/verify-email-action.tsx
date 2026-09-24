'use client';

import { useState } from 'react';

export function VerifyEmailAction({ token, labels }: {
  token: string;
  labels: { verifyAction: string; verificationSuccess: string; verificationFailed: string };
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const verify = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/bff/auth/verify-email?token=${encodeURIComponent(token)}`);
      setMessage(response.ok ? labels.verificationSuccess : labels.verificationFailed);
    } catch {
      setMessage(labels.verificationFailed);
    } finally {
      setBusy(false);
    }
  };
  return <>
    <button type="button" onClick={verify} disabled={busy}
      className="mt-6 rounded-shop bg-action px-4 py-2 text-action-ink disabled:opacity-50">
      {labels.verifyAction}
    </button>
    {message && <p role="status" className="mt-5">{message}</p>}
  </>;
}
