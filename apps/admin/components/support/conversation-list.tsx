'use client';

/**
 * Left pane of the support inbox: search, status filters, and the conversation
 * list. A whole row is the click target; the open conversation is highlighted.
 */

import { AlertCircle, Inbox, MessagesSquare, RefreshCw, Search, UserRound, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatRelativeTime,
  isConversationUnread,
  visitorShortId,
  type InboxFilter,
  type SeenMap,
  type SupportConversation,
} from '@/lib/support-inbox';
import type { InboxText } from './inbox-text';
import type { InboxLoadState } from './use-support-inbox';

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

function SkeletonRow() {
  return (
    <div className="flex gap-3 border-b border-gray-50 px-4 py-3.5">
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-2xl bg-gray-100" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3 w-2/5 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}

export function ConversationList(props: {
  conversations: SupportConversation[];
  totalCount: number;
  unreadCount: number;
  takenOverCount: number;
  selectedId: string | null;
  seen: SeenMap;
  state: InboxLoadState;
  query: string;
  onQueryChange: (query: string) => void;
  filter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
  onSelect: (conversationId: string) => void;
  onRetry: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  text: InboxText;
  locale: string;
}) {
  const {
    conversations, totalCount, unreadCount, takenOverCount, selectedId, seen, state, query, onQueryChange,
    filter, onFilterChange, onSelect, onRetry, text: tf, locale,
  } = props;

  const filters: Array<{ id: InboxFilter; label: string; count: number }> = [
    { id: 'all', label: tf('filterAll', 'All'), count: totalCount },
    { id: 'unread', label: tf('filterUnread', 'Unread'), count: unreadCount },
    { id: 'agent', label: tf('filterAgent', 'Taken over'), count: takenOverCount },
  ];

  let body: React.ReactNode = null;
  if (state === 'loading') {
    body = SKELETON_ROWS.map((row) => <SkeletonRow key={row} />);
  } else if (state === 'error') {
    body = (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <AlertCircle className="h-7 w-7 text-red-400" />
        <p className="text-sm text-gray-600">{tf('loadFailed', 'Failed to load conversations.')}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl border border-gray-100 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          {tf('retry', 'Try again')}
        </button>
      </div>
    );
  } else if (totalCount === 0) {
    body = (
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50">
          <Inbox className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-sm font-bold text-gray-900">{tf('listEmptyTitle', 'No conversations yet')}</p>
        <p className="max-w-[240px] text-[13px] leading-5 text-gray-500">{tf('listEmptyHint', 'Messages from the storefront support chat will appear here.')}</p>
      </div>
    );
  } else if (conversations.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <Search className="h-6 w-6 text-gray-300" />
        <p className="text-sm font-bold text-gray-900">{tf('noMatchTitle', 'No matching conversations')}</p>
        <p className="text-[13px] text-gray-500">{tf('noMatchHint', 'Try a different search or filter.')}</p>
      </div>
    );
  } else {
    body = conversations.map((conversation) => {
      const selected = conversation.id === selectedId;
      const unread = isConversationUnread(conversation, seen);
      return (
        <button
          key={conversation.id}
          type="button"
          onClick={() => onSelect(conversation.id)}
          aria-current={selected ? 'true' : undefined}
          data-inbox="row"
          data-conversation={conversation.id}
          className={cn(
            'relative flex w-full gap-3 border-b border-gray-50 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500',
            selected && 'bg-blue-50/70 hover:bg-blue-50/70',
          )}
        >
          {selected ? <span className="absolute inset-y-0 left-0 w-[3px] bg-blue-600" /> : null}
          <span className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
            selected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500',
          )}>
            <UserRound className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className={cn('min-w-0 flex-1 truncate text-sm text-gray-900', unread ? 'font-bold' : 'font-semibold')}>
                {tf('visitorLabel', 'Visitor {id}', { id: visitorShortId(conversation.visitorToken) })}
              </span>
              <span className="shrink-0 text-[11px] font-medium text-gray-400">{formatRelativeTime(conversation.updatedAt, locale)}</span>
            </span>
            <span className="mt-0.5 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px] leading-5 text-gray-500">
                {conversation.lastMessage ?? tf('noMessages', 'No messages yet')}
              </span>
              {conversation.status === 'agent' ? (
                <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  {tf('takenOver', 'Taken over')}
                </span>
              ) : null}
              {unread ? (
                <span
                  data-inbox="unread"
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600"
                  title={tf('unreadMessages', 'Unread messages')}
                />
              ) : null}
            </span>
          </span>
        </button>
      );
    });
  }

  return (
    <aside
      data-inbox="list"
      className={cn('w-full shrink-0 flex-col border-r border-gray-100 lg:flex lg:w-[360px]', selectedId && 'hidden')}
    >
      <div className="space-y-3 border-b border-gray-100 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            data-inbox="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={tf('searchPlaceholder', 'Search visitors or messages…')}
            aria-label={tf('searchPlaceholder', 'Search visitors or messages…')}
            className="h-10 w-full rounded-xl border border-gray-100 bg-gray-50/70 pl-10 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label={tf('clearSearch', 'Clear search')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div role="tablist" aria-label={tf('filterLabel', 'Filter conversations')} className="flex gap-1 rounded-xl bg-gray-50 p-1">
          {filters.map((entry) => {
            const active = entry.id === filter;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                data-inbox="tab"
                data-filter={entry.id}
                aria-selected={active}
                onClick={() => onFilterChange(entry.id)}
                className={cn(
                  'flex h-8 min-w-0 flex-auto items-center justify-center gap-1 rounded-lg px-2 text-[13px] font-semibold transition-all',
                  active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
                )}
              >
                {/* One line however long the translation; the count keeps its place. */}
                <span className="min-w-0 truncate">{entry.label}</span>
                <span className={cn('shrink-0 rounded-full px-1.5 text-[11px] font-bold', active ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500')}>
                  {entry.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div data-inbox="rows" className="flex-1 overflow-y-auto">{body}</div>
      <div className="flex items-center justify-between gap-3 border-t border-gray-100 pl-4 pr-2 py-1.5">
        <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <MessagesSquare className="h-3.5 w-3.5" />
          {tf('autoRefresh', 'Refreshes automatically')}
        </span>
        <button
          type="button"
          onClick={props.onRefresh}
          disabled={props.refreshing}
          aria-label={tf('refresh', 'Refresh')}
          title={tf('refresh', 'Refresh')}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', props.refreshing && 'animate-spin')} />
        </button>
      </div>
    </aside>
  );
}
