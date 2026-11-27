/**
 * Support inbox data: the conversations and messages of the support-hub
 * plugin, the admin API calls that read and answer them, and the pure helpers
 * the inbox workspace renders from.
 */

import { apiClient } from '@/lib/api';

export interface SupportChannel {
  kind: string;
  label: string;
  href: string;
}

export interface SupportConversation {
  id: string;
  visitorToken: string;
  /** 'open' until an agent replies, then 'agent'. */
  status: string;
  messageCount: number;
  /** Visitor messages this account has not read, counted by the server; absent on an older core. */
  unreadVisitorCount?: number;
  lastMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportConversationMessage {
  id: string;
  role: 'visitor' | 'assistant';
  content: string;
  actions?: SupportChannel[];
  /** 'ai' | 'agent' for assistant messages (plugin 0.0.5+). */
  sender?: 'ai' | 'agent';
  createdAt: string;
}

export interface ConversationTranscript {
  conversationId: string;
  visitorToken: string;
  messages: SupportConversationMessage[];
}

export type InboxFilter = 'all' | 'unread' | 'agent';
export type MessageSender = 'visitor' | 'ai' | 'agent';

/** The plugin returns at most this many messages of a conversation. */
export const SUPPORT_TRANSCRIPT_LIMIT = 200;
/** Longest reply the plugin accepts. */
export const SUPPORT_REPLY_MAX_LENGTH = 2000;
/** Local read markers: conversation id -> message count when it was last read here. */
const SEEN_STORAGE_KEY = 'jiffoo.supportInbox.seen.v1';
/** `?c=<conversation id>` opens that conversation when the page loads. */
const SELECTION_PARAM = 'c';

export class SupportInboxError extends Error {
  code: string;

  constructor(message: string, code: string = 'SUPPORT_INBOX_ERROR') {
    super(message);
    this.name = 'SupportInboxError';
    this.code = code;
  }
}

/**
 * The apiClient normalizes bodies without an explicit `success` field into
 * { success, data }; the support-hub adapter already returns that envelope.
 */
function unwrap<T>(response: unknown): T {
  const envelope = response as { success?: boolean; data?: T; error?: { code?: string; message?: string } | string } | T;
  if (envelope && typeof envelope === 'object' && 'success' in envelope) {
    if (envelope.success === true) return envelope.data as T;
    const error = envelope.error;
    if (typeof error === 'string') throw new SupportInboxError(error);
    throw new SupportInboxError(error?.message || 'Support inbox request failed', error?.code || 'SUPPORT_INBOX_ERROR');
  }
  return response as T;
}

const conversationsPath = '/extensions/plugin/support-hub/api/admin/conversations';

function api(installationId: string) {
  const headers = { 'x-installation-id': installationId };
  return {
    listConversations: async (): Promise<SupportConversation[]> => {
      const data = unwrap<{ conversations?: SupportConversation[] }>(
        await apiClient.get(conversationsPath, { headers }),
      );
      return data?.conversations ?? [];
    },
    readConversation: async (conversationId: string): Promise<ConversationTranscript> => {
      const data = unwrap<ConversationTranscript>(
        await apiClient.get(`${conversationsPath}/${encodeURIComponent(conversationId)}/messages`, { headers }),
      );
      if (!data?.conversationId) throw new SupportInboxError('Conversation not found', 'CONVERSATION_NOT_FOUND');
      return data;
    },
    reply: async (conversationId: string, message: string): Promise<SupportConversationMessage | null> => {
      const data = unwrap<{ reply?: SupportConversationMessage }>(
        await apiClient.post(`${conversationsPath}/${encodeURIComponent(conversationId)}/reply`, { message }, { headers }),
      );
      return data?.reply ?? null;
    },
    /** Best effort: clears the server-side unread count that feeds the inbox bell. */
    markRead: async (conversationId: string): Promise<void> => {
      await apiClient.post(`${conversationsPath}/mark-read`, { conversationId }, { headers });
    },
  };
}

export const supportInboxApi = {
  for: (installationId: string) => api(installationId || 'default'),
};

// ---------------------------------------------------------------------------
// Read markers
// The plugin reports one unread total for the bell, not per conversation, so
// the list keeps its own markers in this browser: a conversation is unread
// when it holds more messages than when it was last opened here.

export type SeenMap = Record<string, number>;

function storageLike(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readSeenMap(storage: Pick<Storage, 'getItem'> | null = storageLike()): SeenMap {
  const seen: SeenMap = {};
  if (!storage) return seen;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(SEEN_STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object') return seen;
    for (const [id, count] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof count === 'number' && Number.isFinite(count) && count >= 0) seen[id] = Math.floor(count);
    }
  } catch {
    // A damaged marker file only costs the unread dots; start over.
  }
  return seen;
}

export function writeSeenMap(seen: SeenMap, storage: Pick<Storage, 'setItem'> | null = storageLike()): void {
  if (!storage) return;
  try {
    storage.setItem(SEEN_STORAGE_KEY, JSON.stringify(seen));
  } catch {
    // Private mode or a full quota: the markers then last for this visit only.
  }
}

/**
 * Unread while the server still counts unread visitor messages for this account
 * and this browser has not shown the conversation since. The server's count
 * covers the same account on other devices; the browser's marker covers the
 * moment between showing a message and the next list refresh.
 */
export function isConversationUnread(
  conversation: Pick<SupportConversation, 'id' | 'messageCount' | 'unreadVisitorCount'>,
  seen: SeenMap,
): boolean {
  const unreadOnServer = conversation.unreadVisitorCount === undefined || conversation.unreadVisitorCount > 0;
  return unreadOnServer && conversation.messageCount > (seen[conversation.id] ?? 0);
}

// ---------------------------------------------------------------------------
// Selection in the address bar

export function readSelectedConversationId(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(SELECTION_PARAM);
}

export function rememberSelectedConversationId(conversationId: string | null): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (conversationId) url.searchParams.set(SELECTION_PARAM, conversationId);
  else url.searchParams.delete(SELECTION_PARAM);
  window.history.replaceState(window.history.state, '', url);
}

// ---------------------------------------------------------------------------
// List helpers

/** Newest activity first, which is the order the plugin sorts by as well. */
export function sortConversations(conversations: SupportConversation[]): SupportConversation[] {
  return [...conversations].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function filterConversations(
  conversations: SupportConversation[],
  filter: InboxFilter,
  query: string,
  seen: SeenMap,
): SupportConversation[] {
  const needle = query.trim().toLowerCase();
  return conversations.filter((conversation) => {
    if (filter === 'unread' && !isConversationUnread(conversation, seen)) return false;
    if (filter === 'agent' && conversation.status !== 'agent') return false;
    if (!needle) return true;
    return conversation.visitorToken.toLowerCase().includes(needle)
      || (conversation.lastMessage ?? '').toLowerCase().includes(needle);
  });
}

/** The short label an agent knows a visitor by: the tail of the browser token. */
export function visitorShortId(visitorToken: string): string {
  const token = visitorToken.trim();
  return token.length > 6 ? token.slice(-6) : token;
}

// ---------------------------------------------------------------------------
// Time and thread helpers

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Messages of one sender closer together than this share a bubble group. */
const GROUP_GAP = 5 * MINUTE;

export function formatRelativeTime(iso: string, locale: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  // Negative counts are the past for Intl.RelativeTimeFormat.
  const elapsed = then - now;
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (Math.abs(elapsed) < MINUTE) return relative.format(Math.round(elapsed / 1000), 'second');
  if (Math.abs(elapsed) < HOUR) return relative.format(Math.round(elapsed / MINUTE), 'minute');
  if (Math.abs(elapsed) < DAY) return relative.format(Math.round(elapsed / HOUR), 'hour');
  const days = Math.round(elapsed / DAY);
  if (Math.abs(days) < 7) return relative.format(days, 'day');
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(then);
}

export function formatClockTime(iso: string, locale: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(then);
}

function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** 'Today', 'Yesterday', or the calendar date. */
export function formatDayLabel(iso: string, locale: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const date = new Date(then);
  const today = new Date(now);
  const yesterday = new Date(now - DAY);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (dayKey(iso) === `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`) return relative.format(0, 'day');
  if (dayKey(iso) === `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`) return relative.format(-1, 'day');
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== today.getFullYear()) options.year = 'numeric';
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export type ThreadEntry =
  | { type: 'day'; key: string; label: string }
  | { type: 'group'; key: string; side: 'visitor' | 'assistant'; sender: MessageSender; messages: SupportConversationMessage[] };

export function messageSender(message: SupportConversationMessage): MessageSender {
  if (message.role === 'visitor') return 'visitor';
  return message.sender === 'agent' ? 'agent' : 'ai';
}

/** Day separators, then runs of messages from one sender. */
export function buildThreadEntries(messages: SupportConversationMessage[], locale: string, now: number = Date.now()): ThreadEntry[] {
  const entries: ThreadEntry[] = [];
  let currentDay = '';
  let group: Extract<ThreadEntry, { type: 'group' }> | null = null;
  let groupEnd = 0;
  for (const message of messages) {
    const day = dayKey(message.createdAt);
    if (day !== currentDay) {
      entries.push({ type: 'day', key: `day-${day}-${entries.length}`, label: formatDayLabel(message.createdAt, locale, now) });
      currentDay = day;
      group = null;
    }
    const sender = messageSender(message);
    const at = Date.parse(message.createdAt);
    if (!group || group.sender !== sender || at - groupEnd > GROUP_GAP) {
      group = { type: 'group', key: `group-${message.id}`, side: sender === 'visitor' ? 'visitor' : 'assistant', sender, messages: [] };
      entries.push(group);
    }
    group.messages.push(message);
    groupEnd = Number.isFinite(at) ? at : groupEnd;
  }
  return entries;
}

/** Server messages first, then replies this page just sent that the server has not returned yet. */
export function mergeTranscriptMessages(server: SupportConversationMessage[], local: SupportConversationMessage[]): SupportConversationMessage[] {
  const serverIds = new Set(server.map((message) => message.id));
  const localOnly = local.filter((message) => !serverIds.has(message.id));
  const merged = localOnly.length > 0 ? [...server, ...localOnly] : server;
  if (localOnly.length > 0) merged.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return merged;
}
