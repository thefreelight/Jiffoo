import { describe, expect, it } from 'vitest';

import {
  buildThreadEntries,
  filterConversations,
  formatRelativeTime,
  isConversationUnread,
  mergeTranscriptMessages,
  readSeenMap,
  sortConversations,
  visitorShortId,
  writeSeenMap,
  type SeenMap,
  type SupportConversation,
  type SupportConversationMessage,
} from '../../lib/support-inbox';

const conversation = (id: string, patch: Partial<SupportConversation> = {}): SupportConversation => ({
  id,
  visitorToken: `visitor-token-${id}`,
  status: 'open',
  messageCount: 2,
  lastMessage: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

const message = (id: string, patch: Partial<SupportConversationMessage> = {}): SupportConversationMessage => ({
  id,
  role: 'visitor',
  content: id,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  };
}

describe('support inbox read markers', () => {
  it('counts a conversation as unread once it holds more messages than were last read', () => {
    const seen: SeenMap = { a: 4, b: 7 };
    expect(isConversationUnread(conversation('a'), seen)).toBe(false);
    expect(isConversationUnread(conversation('a', { messageCount: 5 }), seen)).toBe(true);
    // Never opened in this browser: every message is new.
    expect(isConversationUnread(conversation('c'), seen)).toBe(true);
    expect(isConversationUnread(conversation('c', { messageCount: 0 }), seen)).toBe(false);
  });

  it('keeps only well-formed counts and survives a damaged marker file', () => {
    const storage = memoryStorage();
    const seen: SeenMap = { a: 3, b: 12 };
    writeSeenMap(seen, storage);
    expect(readSeenMap(storage)).toEqual(seen);

    storage.setItem('jiffoo.supportInbox.seen.v1', '{"a": "many", "b": -4, "c": 5.7, "d": null}');
    expect(readSeenMap(storage)).toEqual({ c: 5 });

    storage.setItem('jiffoo.supportInbox.seen.v1', 'not json');
    expect(readSeenMap(storage)).toEqual({});
    // No storage (private mode, server render) is not an error.
    expect(readSeenMap(null)).toEqual({});
  });
});

describe('support inbox list', () => {
  const list = [
    conversation('new', { visitorToken: 'aaaa1111ffff', lastMessage: 'Refund please', updatedAt: '2026-03-05T10:00:00.000Z', status: 'agent', messageCount: 6 }),
    conversation('old', { visitorToken: 'bbbb2222eeee', lastMessage: 'How do I activate the card?', updatedAt: '2026-03-01T10:00:00.000Z', messageCount: 2 }),
  ];

  it('sorts by latest activity even when the server order changes', () => {
    expect(sortConversations([list[1]!, list[0]!]).map((entry) => entry.id)).toEqual(['new', 'old']);
    // The input is not mutated.
    expect(sortConversations([list[1]!, list[0]!])).not.toBe(list);
  });

  it('filters by read state and by agent takeover', () => {
    const seen: SeenMap = { new: 6, old: 1 };
    expect(filterConversations(list, 'all', '', seen)).toEqual(list);
    expect(filterConversations(list, 'unread', '', seen).map((entry) => entry.id)).toEqual(['old']);
    expect(filterConversations(list, 'agent', '', seen).map((entry) => entry.id)).toEqual(['new']);
  });

  it('searches the visitor token and the last message, ignoring case and surrounding spaces', () => {
    expect(filterConversations(list, 'all', '  REFUND ', {}).map((entry) => entry.id)).toEqual(['new']);
    expect(filterConversations(list, 'all', 'ffff', {}).map((entry) => entry.id)).toEqual(['new']);
    expect(filterConversations(list, 'all', 'nothing-matches', {})).toEqual([]);
  });

  it('labels a visitor by the tail of the browser token', () => {
    expect(visitorShortId('7f1c9e2b4d6a8f30')).toBe('6a8f30');
    expect(visitorShortId('abc')).toBe('abc');
    expect(visitorShortId('  123456789 ')).toBe('456789');
  });
});

describe('support inbox thread', () => {
  const at = (minute: number) => `2026-03-05T10:${String(minute).padStart(2, '0')}:00.000Z`;

  it('groups runs of one sender and breaks them on a long pause', () => {
    const entries = buildThreadEntries([
      message('v1', { createdAt: at(0) }),
      message('v2', { createdAt: at(1) }),
      message('a1', { role: 'assistant', sender: 'ai', createdAt: at(2) }),
      message('v3', { createdAt: at(20) }),
      message('a2', { role: 'assistant', sender: 'agent', createdAt: at(21) }),
      message('a3', { role: 'assistant', createdAt: at(22) }),
    ], 'en', Date.parse(at(30)));
    expect(entries.map((entry) => entry.type === 'day' ? 'day' : `${entry.sender}:${entry.messages.length}`)).toEqual([
      'day', 'visitor:2', 'ai:1', 'visitor:1', 'agent:1', 'ai:1',
    ]);
  });

  it('starts a new day separator for each calendar day', () => {
    // Thirty hours apart, so they fall on different local days in any time zone.
    const entries = buildThreadEntries([
      message('v1', { createdAt: '2026-03-05T10:00:00.000Z' }),
      message('v2', { createdAt: '2026-03-06T16:00:00.000Z' }),
    ], 'en', Date.parse('2026-03-06T16:05:00.000Z'));
    expect(entries.filter((entry) => entry.type === 'day').length).toBe(2);
    const labels = entries.filter((entry) => entry.type === 'day').map((entry) => entry.label);
    expect(labels[1]).toBe('today');
  });

  it('keeps a reply this page just sent when an older server answer arrives after it', () => {
    const server = [message('v1'), message('v2')];
    const local = [message('v1'), message('v2'), message('a1', { role: 'assistant', sender: 'agent', createdAt: '2026-01-01T00:00:05.000Z' })];
    expect(mergeTranscriptMessages(server, local).map((entry) => entry.id)).toEqual(['v1', 'v2', 'a1']);
    // Once the server knows the reply, the plain server list is used.
    expect(mergeTranscriptMessages(local, local)).toEqual(local);
  });
});

describe('support inbox relative time', () => {
  const now = Date.parse('2026-03-06T12:00:00.000Z');

  it('steps from seconds to days and falls back to a date', () => {
    const steps = [30, 5 * 60, 3 * 3600, 2 * 86400, 30 * 86400].map((seconds) => formatRelativeTime(new Date(now - seconds * 1000).toISOString(), 'en', now));
    expect(steps.slice(0, 4)).toEqual(['30 seconds ago', '5 minutes ago', '3 hours ago', '2 days ago']);
    // Older than a week shows the calendar date instead of a count.
    // Some locales separate the month from the day with a no-break space.
    expect(steps[4]).toMatch(/Feb( |\u00a0)4/);
  });

  it('follows the UI language', () => {
    const iso = new Date(now - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(iso, 'zh-Hans', now)).toBe('5分钟前');
    expect(formatRelativeTime(iso, 'ja', now)).toBe('5 分前');
  });

  it('returns an empty label for a date it cannot read', () => {
    expect(formatRelativeTime('not a date', 'en', now)).toBe('');
  });
});
