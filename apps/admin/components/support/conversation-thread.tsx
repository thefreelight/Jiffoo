'use client';

/**
 * Right pane of the support inbox: the open conversation's header, its
 * messages as a chat thread, and the reply box. Visitor messages sit on the
 * left; AI replies and agent replies sit on the right and look different.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowDown, ArrowLeft, Bot, Headset, MessagesSquare, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildThreadEntries,
  formatClockTime,
  formatRelativeTime,
  SUPPORT_TRANSCRIPT_LIMIT,
  visitorShortId,
  type ConversationTranscript,
  type SupportConversation,
  type ThreadEntry,
} from '@/lib/support-inbox';
import type { InboxText } from './inbox-text';
import type { InboxLoadState } from './use-support-inbox';
import { ReplyComposer } from './reply-composer';

const BOTTOM_SLACK = 64;

/** Whether the page is on screen. A conversation only counts as read while the agent can see it. */
function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

/**
 * Scrolls to the newest message as long as the agent is at the bottom of the
 * thread. Higher up, new messages are counted in a pill instead, and nothing
 * counts as read until the end of the thread is on screen again.
 */
function MessageScroll(props: {
  transcript: ConversationTranscript | null;
  state: InboxLoadState;
  onRetry: () => void;
  /** Reports how many messages the conversation had when its newest one came on screen. */
  onViewed: (shown: number) => void;
  text: InboxText;
  locale: string;
  emptyText: string;
}) {
  const { transcript, state, onRetry, onViewed, text: tf, locale, emptyText } = props;
  const visible = useDocumentVisible();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(true);
  /** Message count the last time the end of the thread was on screen in a visible page. */
  const [shownCount, setShownCount] = useState(0);
  const count = transcript?.messages.length ?? 0;
  const atLatest = pinned && visible;
  const unseen = atLatest ? 0 : Math.max(0, count - shownCount);

  useEffect(() => {
    if (!atLatest || count <= shownCount) return;
    setShownCount(count);
    onViewed(count);
  }, [atLatest, count, onViewed, shownCount]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (pinned && element) element.scrollTop = element.scrollHeight;
  }, [count, pinned]);

  const jumpToLatest = () => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
    setPinned(true);
  };

  let content: ReactNode;
  if (state === 'loading') {
    content = (
      <div className="space-y-4 p-6">
        <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-gray-100" />
        <div className="ml-auto h-12 w-1/2 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-12 w-3/5 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  } else if (state === 'error') {
    content = (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <AlertCircle className="h-7 w-7 text-red-400" />
        <p className="text-sm text-gray-600">{tf('openFailed', 'Failed to load the conversation.')}</p>
        <button type="button" onClick={onRetry} className="rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50">
          {tf('retry', 'Try again')}
        </button>
      </div>
    );
  } else if (count === 0) {
    content = <p className="px-6 py-12 text-center text-sm text-gray-500">{emptyText}</p>;
  } else {
    content = buildThreadEntries(transcript?.messages ?? [], locale).map((entry) => (
      <ThreadRow key={entry.key} entry={entry} text={tf} locale={locale} />
    ));
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        data-inbox="thread"
        onScroll={(event) => {
          const element = event.currentTarget;
          setPinned(element.scrollHeight - element.scrollTop - element.clientHeight < BOTTOM_SLACK);
        }}
        className="h-full space-y-1 overflow-y-auto bg-gray-50/50 px-4 py-5 sm:px-6"
      >
        {count >= SUPPORT_TRANSCRIPT_LIMIT ? (
          <p className="mx-auto mb-4 w-fit rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
            {tf('showEarlierLimit', 'Showing the latest {count} messages of this conversation.', { count: SUPPORT_TRANSCRIPT_LIMIT })}
          </p>
        ) : null}
        {content}
      </div>
      {unseen > 0 ? (
        <button
          type="button"
          onClick={jumpToLatest}
          data-inbox="pill"
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-blue-200 transition-colors hover:bg-blue-700"
        >
          <ArrowDown className="h-3.5 w-3.5" />
          {tf('newMessages', '{count} new messages', { count: unseen })}
        </button>
      ) : null}
    </div>
  );
}

function ThreadRow(props: { entry: ThreadEntry; text: InboxText; locale: string }) {
  const { entry, text: tf, locale } = props;
  if (entry.type === 'day') {
    return <p className="py-3 text-center text-[11px] font-bold uppercase tracking-wide text-gray-400">{entry.label}</p>;
  }
  const { side, sender, messages } = entry;
  const fromVisitor = side === 'visitor';
  const first = messages[0]!;
  const last = messages[messages.length - 1]!;
  const senderLabel = fromVisitor
    ? tf('roleVisitor', 'Visitor')
    : sender === 'agent' ? tf('roleAgent', 'Support agent') : tf('roleAi', 'AI assistant');
  const SenderIcon = fromVisitor ? UserRound : sender === 'agent' ? Headset : Bot;

  return (
    <div className={cn('flex items-end gap-2.5 py-1', !fromVisitor && 'flex-row-reverse')}>
      <span className={cn(
        'mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl',
        fromVisitor ? 'bg-gray-100 text-gray-500' : sender === 'agent' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600',
      )}>
        <SenderIcon className="h-3.5 w-3.5" />
      </span>
      <div className={cn('flex max-w-[78%] flex-col gap-1.5 sm:max-w-[70%]', !fromVisitor && 'items-end')}>
        <span className={cn('px-1 text-[11px] font-bold uppercase tracking-wide text-gray-400', !fromVisitor && 'text-right')}>
          {senderLabel}
        </span>
        {messages.map((message) => (
          <div
            key={message.id}
            data-inbox="bubble"
            data-sender={fromVisitor ? 'visitor' : sender}
            className={cn(
              'rounded-2xl px-4 py-2.5 text-sm leading-6 shadow-sm',
              fromVisitor
                ? 'rounded-bl-md bg-white text-gray-900'
                : sender === 'agent'
                  ? 'rounded-br-md bg-blue-600 text-white'
                  : 'rounded-br-md border border-blue-100 bg-blue-50/40 text-gray-800',
            )}
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
            {message.actions && message.actions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {message.actions.map((action) => (
                  <a
                    key={`${message.id}-${action.kind}`}
                    href={action.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      fromVisitor ? 'bg-gray-100 text-gray-700' : sender === 'agent' ? 'bg-blue-500 text-white' : 'bg-white text-blue-700',
                    )}
                  >
                    {action.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        <span className="px-1 text-[11px] text-gray-400">
          {formatClockTime(first.createdAt, locale)}
          {last.id !== first.id ? ` – ${formatClockTime(last.createdAt, locale)}` : ''}
        </span>
      </div>
    </div>
  );
}

export function ConversationThread(props: {
  conversation: SupportConversation | null;
  transcript: ConversationTranscript | null;
  state: InboxLoadState;
  sending: boolean;
  canReply: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onRetry: () => void;
  onBack: () => void;
  onViewed: (shown: number) => void;
  text: InboxText;
  locale: string;
}) {
  const {
    conversation, transcript, state, sending, canReply, draft, onDraftChange, onSend, onRetry, onBack, onViewed, text: tf, locale,
  } = props;

  if (!conversation) {
    return (
      <section className="hidden min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-gray-50/30 px-6 text-center lg:flex">
        <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-white shadow-sm">
          <MessagesSquare className="h-7 w-7 text-blue-500" />
        </div>
        <p className="text-[15px] font-bold text-gray-900">{tf('selectTitle', 'Pick a conversation to start')}</p>
        <p className="max-w-[320px] text-sm leading-6 text-gray-500">
          {tf('selectHint', 'Open a conversation on the left to read it and reply as a support agent.')}
        </p>
      </section>
    );
  }

  const takenOver = conversation.status === 'agent';
  const messageCount = Math.max(conversation.messageCount, transcript?.messages.length ?? 0);

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          aria-label={tf('backToList', 'Back to conversations')}
          className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
          <UserRound className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p data-inbox="thread-title" className="truncate text-[15px] font-bold text-gray-900">
            {tf('visitorLabel', 'Visitor {id}', { id: visitorShortId(conversation.visitorToken) })}
          </p>
          <p className="truncate text-xs text-gray-500">
            {tf('messageCount', '{count} messages', { count: messageCount })}
            {' · '}
            {tf('startedAt', 'Started {time}', {
              time: formatRelativeTime(conversation.createdAt, locale),
            })}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold',
            takenOver ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500',
          )}
        >
          {takenOver ? tf('takenOver', 'Taken over') : tf('notTakenOver', 'No agent has replied yet')}
        </span>
      </header>
      {/* Keyed by conversation so each one starts at its newest message with its own read state. */}
      <MessageScroll
        key={conversation.id}
        transcript={transcript}
        state={state}
        onRetry={onRetry}
        onViewed={onViewed}
        text={tf}
        locale={locale}
        emptyText={tf('emptyTranscript', 'No messages in this conversation.')}
      />
      {canReply ? (
        <ReplyComposer value={draft} onChange={onDraftChange} onSend={onSend} sending={sending} text={tf}>
          {!takenOver ? (
            <p className="text-[11px] leading-4 text-amber-600">{tf('takeoverHint', 'Once you reply, this conversation is handled by you and AI replies stop.')}</p>
          ) : null}
        </ReplyComposer>
      ) : (
        <p className="border-t border-gray-100 px-6 py-3 text-xs text-gray-500">
          {tf('readOnlyHint', 'You can read this conversation but not reply to it.')}
        </p>
      )}
    </section>
  );
}
