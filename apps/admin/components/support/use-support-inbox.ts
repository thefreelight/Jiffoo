'use client';

/**
 * State and data flow of the support inbox: the conversation list, the open
 * conversation, replies, read markers, and the polling that keeps both current
 * while the page is on screen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  filterConversations,
  isConversationUnread,
  mergeTranscriptMessages,
  readSeenMap,
  readSelectedConversationId,
  rememberSelectedConversationId,
  sortConversations,
  supportInboxApi,
  writeSeenMap,
  type ConversationTranscript,
  type InboxFilter,
  type SeenMap,
  type SupportConversation,
} from '@/lib/support-inbox';

/** How often the open conversation checks for a new visitor message. */
export const THREAD_REFRESH_MS = 10 * 1000;
/** How often the list checks for new conversations and messages elsewhere. */
export const LIST_REFRESH_MS = 30 * 1000;
/** From this width the list and the thread show side by side (the `lg:` breakpoint of the layout). */
const TWO_PANE_QUERY = '(min-width: 1024px)';

export type InboxLoadState = 'idle' | 'loading' | 'ready' | 'error';

function isVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

export function useSupportInbox(options: { installationId: string; enabled: boolean }) {
  const { installationId, enabled } = options;

  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [listState, setListState] = useState<InboxLoadState>('idle');
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<ConversationTranscript | null>(null);
  const [threadState, setThreadState] = useState<InboxLoadState>('idle');
  const [sending, setSending] = useState(false);
  const [seen, setSeen] = useState<SeenMap>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [query, setQuery] = useState('');

  // Mirrors for use inside async work, where reading the latest value matters.
  const seenRef = useRef<SeenMap>({});
  const conversationsRef = useRef<SupportConversation[]>([]);
  const selectedRef = useRef<string | null>(null);
  const openRequestRef = useRef(0);
  const sendingRef = useRef(false);
  const listInFlightRef = useRef<Promise<SupportConversation[] | null> | null>(null);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const updateSeen = useCallback((next: SeenMap) => {
    seenRef.current = next;
    setSeen(next);
    writeSeenMap(next);
  }, []);

  const markSeen = useCallback((conversationId: string, count: number) => {
    if (count <= (seenRef.current[conversationId] ?? 0)) return;
    updateSeen({ ...seenRef.current, [conversationId]: count });
  }, [updateSeen]);

  const refreshList = useCallback((): Promise<SupportConversation[] | null> => {
    // A second caller while one list request is out shares its answer instead of giving up.
    if (!enabled) return Promise.resolve(null);
    if (listInFlightRef.current) return listInFlightRef.current;
    const request = (async (): Promise<SupportConversation[] | null> => {
      try {
        const list = sortConversations(await supportInboxApi.for(installationId).listConversations());
        setConversations(list);
        setLastRefreshAt(Date.now());
        setListState('ready');
        return list;
      } catch {
        setListState((current) => (current === 'ready' ? current : 'error'));
        return null;
      } finally {
        listInFlightRef.current = null;
      }
    })();
    listInFlightRef.current = request;
    return request;
  }, [enabled, installationId]);

  const clearSelection = useCallback(() => {
    openRequestRef.current += 1;
    selectedRef.current = null;
    setSelectedId(null);
    setTranscript(null);
    setThreadState('idle');
    rememberSelectedConversationId(null);
  }, []);

  const select = useCallback(async (conversationId: string) => {
    // A newer selection wins even if this one answers last.
    const request = ++openRequestRef.current;
    selectedRef.current = conversationId;
    setSelectedId(conversationId);
    setTranscript(null);
    setThreadState('loading');
    rememberSelectedConversationId(conversationId);
    try {
      const data = await supportInboxApi.for(installationId).readConversation(conversationId);
      if (request !== openRequestRef.current) return;
      setTranscript(data);
      setThreadState('ready');
    } catch {
      if (request !== openRequestRef.current) return;
      setThreadState('error');
    }
  }, [installationId]);

  // Opens the conversation the address bar names, else the first unread one, else the newest.
  const openDefault = useCallback(async (list: SupportConversation[]) => {
    const wanted = readSelectedConversationId();
    // Where the list fills the screen (a phone), it stays until a conversation is picked;
    // only a link to one conversation opens it directly.
    if (!wanted && !window.matchMedia(TWO_PANE_QUERY).matches) return;
    const target = (wanted && list.some((conversation) => conversation.id === wanted) ? wanted : null)
      ?? list.find((conversation) => isConversationUnread(conversation, seenRef.current))?.id
      ?? list[0]?.id;
    if (target) await select(target);
  }, [select]);

  /** Loads the list again after it failed, and opens a conversation the way the first load does. */
  const retryList = useCallback(async (): Promise<SupportConversation[] | null> => {
    const list = await refreshList();
    if (list && !selectedRef.current) await openDefault(list);
    return list;
  }, [openDefault, refreshList]);

  // First load: the read markers, then the list and the conversation to open.
  useEffect(() => {
    if (!enabled) return;
    updateSeen(readSeenMap());
    let disposed = false;
    (async () => {
      const list = await refreshList();
      if (disposed || !list) return;
      await openDefault(list);
    })();
    return () => {
      disposed = true;
    };
  }, [enabled, openDefault, refreshList, updateSeen]);

  const refreshThread = useCallback(async (conversationId: string): Promise<void> => {
    try {
      const data = await supportInboxApi.for(installationId).readConversation(conversationId);
      if (selectedRef.current !== conversationId) return;
      setTranscript((current) => {
        if (!current || current.conversationId !== conversationId) return current;
        const serverLast = data.messages[data.messages.length - 1]?.id;
        const localLast = current.messages[current.messages.length - 1]?.id;
        if (serverLast === localLast && data.messages.length === current.messages.length) return current;
        return { ...data, messages: mergeTranscriptMessages(data.messages, current.messages) };
      });
    } catch {
      // Keep what is on screen; the next refresh tries again.
    }
  }, [installationId]);

  // The open conversation refreshes faster, so a visitor's next message shows up while the agent is here.
  useEffect(() => {
    if (!enabled || !selectedId) return;
    const conversationId = selectedId;
    // Refreshing only puts messages on screen; whether they were read is up to the thread.
    const tick = () => {
      if (isVisible()) void refreshThread(conversationId);
    };
    const timer = setInterval(tick, THREAD_REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled, refreshThread, selectedId]);

  /** The newest message of the open conversation is on screen: read here and for the bell's count. */
  const markViewed = useCallback((shown: number) => {
    const conversationId = selectedRef.current;
    if (!conversationId) return;
    const listed = conversationsRef.current.find((conversation) => conversation.id === conversationId);
    markSeen(conversationId, Math.max(shown, listed?.messageCount ?? 0));
    supportInboxApi.for(installationId).markRead(conversationId).catch(() => undefined);
  }, [installationId, markSeen]);

  // The list follows new conversations and messages in other conversations.
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (isVisible()) void refreshList();
    };
    const timer = setInterval(tick, LIST_REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [enabled, refreshList]);

  const reply = useCallback(async (text: string): Promise<boolean> => {
    const conversationId = selectedRef.current;
    const message = text.trim();
    if (!enabled || !conversationId || !message || sendingRef.current) return false;
    sendingRef.current = true;
    setSending(true);
    try {
      const sent = await supportInboxApi.for(installationId).reply(conversationId, message);
      if (sent) {
        setTranscript((current) => (current && current.conversationId === conversationId
          ? { ...current, messages: [...current.messages, sent] }
          : current));
      } else {
        await refreshThread(conversationId);
      }
      const listed = conversationsRef.current.find((conversation) => conversation.id === conversationId);
      const count = (listed?.messageCount ?? 0) + (sent ? 1 : 0);
      setConversations((current) => sortConversations(current.map((conversation) => (
        conversation.id === conversationId
          ? { ...conversation, status: 'agent', messageCount: count, lastMessage: message, updatedAt: new Date().toISOString() }
          : conversation
      ))));
      markSeen(conversationId, count);
      setDrafts((current) => ({ ...current, [conversationId]: '' }));
      void refreshList();
      return true;
    } catch {
      return false;
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }, [enabled, installationId, markSeen, refreshList, refreshThread]);

  const unreadCount = conversations.filter((conversation) => isConversationUnread(conversation, seen)).length;
  const selectedConversation = selectedId
    ? conversations.find((conversation) => conversation.id === selectedId) ?? null
    : null;

  return {
    conversations,
    seen,
    visibleConversations: filterConversations(conversations, filter, query, seen),
    listState,
    lastRefreshAt,
    unreadCount,
    takenOverCount: conversations.filter((conversation) => conversation.status === 'agent').length,
    filter,
    setFilter,
    query,
    setQuery,
    selectedId,
    selectedConversation,
    transcript,
    threadState,
    sending,
    draft: selectedId ? drafts[selectedId] ?? '' : '',
    setDraft: (value: string) => setDrafts((current) => (selectedId ? { ...current, [selectedId]: value } : current)),
    select,
    clearSelection,
    markViewed,
    refreshList,
    retryList,
    reply,
  };
}
