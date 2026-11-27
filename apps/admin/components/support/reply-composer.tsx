'use client';

/**
 * Reply box of the support inbox. Enter sends, Shift + Enter adds a line, and
 * an Enter that only confirms an IME candidate never sends.
 */

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CornerDownLeft, Loader2, SendHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SUPPORT_REPLY_MAX_LENGTH } from '@/lib/support-inbox';
import type { InboxText } from './inbox-text';

/** Safari reports the end of a composition before the Enter that ended it. */
const IME_SETTLE_MS = 120;
const MAX_HEIGHT = 160;

export function ReplyComposer(props: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  /** A note shown under the box, such as the takeover reminder. */
  children?: ReactNode;
  text: InboxText;
}) {
  const { value, onChange, onSend, sending, text: tf } = props;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composingRef = useRef(false);
  const compositionEndedAtRef = useRef(0);
  const [focused, setFocused] = useState(false);

  // Grow with the draft up to a few lines, then scroll inside. The scrollbar only
  // appears once the draft is taller than that, so an empty box shows no track.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    const capped = textarea.scrollHeight > MAX_HEIGHT;
    textarea.style.height = `${capped ? MAX_HEIGHT : textarea.scrollHeight}px`;
    textarea.style.overflowY = capped ? 'auto' : 'hidden';
  }, [value]);

  const canSend = value.trim().length > 0 && !sending;

  return (
    <div className="border-t border-gray-100 bg-white p-4">
      <div
        className={cn(
          'flex items-end gap-2 rounded-2xl border bg-white p-2 pl-4 transition-all',
          focused ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-gray-200',
        )}
      >
        <textarea
          ref={textareaRef}
          data-inbox="composer"
          rows={1}
          value={value}
          maxLength={SUPPORT_REPLY_MAX_LENGTH}
          placeholder={tf('composerPlaceholder', 'Type a reply…')}
          aria-label={tf('composerPlaceholder', 'Type a reply…')}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; compositionEndedAtRef.current = Date.now(); }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            const native = event.nativeEvent as KeyboardEvent;
            const composing = native.isComposing || composingRef.current
              || Date.now() - compositionEndedAtRef.current < IME_SETTLE_MS;
            if (composing) return;
            event.preventDefault();
            if (canSend) onSend();
          }}
          className="min-h-[40px] flex-1 resize-none appearance-none rounded-none border-0 bg-transparent px-0 py-2 text-sm leading-6 text-gray-900 shadow-none outline-none ring-0 placeholder:text-gray-400 focus:outline-none focus:ring-0 focus:ring-offset-0"
        />
        <button
          type="button"
          onClick={() => { if (canSend) onSend(); }}
          disabled={!canSend}
          aria-label={tf('send', 'Send')}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-100 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
        >
          {sending ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <SendHorizontal className="h-[18px] w-[18px]" />}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] leading-4 text-gray-400">
        <span className="flex items-center gap-1.5">
          <CornerDownLeft className="h-3 w-3" />
          {tf('composerHint', 'Enter to send, Shift + Enter for a new line')}
        </span>
        {value.length > SUPPORT_REPLY_MAX_LENGTH * 0.9 ? (
          <span className={cn('font-semibold', value.length >= SUPPORT_REPLY_MAX_LENGTH && 'text-red-500')}>
            {tf('charCount', '{count}/{max}', { count: value.length, max: SUPPORT_REPLY_MAX_LENGTH })}
          </span>
        ) : null}
      </div>
      {props.children ? <div className="mt-2">{props.children}</div> : null}
    </div>
  );
}
