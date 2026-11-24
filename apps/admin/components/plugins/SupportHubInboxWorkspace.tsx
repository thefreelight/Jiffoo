'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessagesSquare, RefreshCw, Send } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  WorkspaceCard,
  workspaceOutlineButtonClass,
  workspacePrimaryButtonClass,
} from '@/components/plugins/plugin-workspace-ui';
import { useWorkspaceText } from '@/components/plugins/use-workspace-text';

interface SupportChannel {
  kind: string;
  label: string;
  href: string;
}

interface SupportConversation {
  id: string;
  visitorToken: string;
  status: string;
  messageCount: number;
  lastMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SupportConversationMessage {
  id: string;
  role: 'visitor' | 'assistant';
  content: string;
  actions?: SupportChannel[];
  /** 'ai' | 'agent' for assistant messages (0.0.5+). */
  sender?: 'ai' | 'agent';
  createdAt: string;
}

interface ConversationTranscript {
  conversationId: string;
  visitorToken: string;
  messages: SupportConversationMessage[];
}

/**
 * The apiClient normalizes bodies without an explicit `success` field into
 * { success, data }; the support-hub adapter already returns that envelope.
 * Unwrap defensively either way so a proxy payload shape change can never
 * render the inbox permanently empty (RemoteRadarJobs lesson).
 */
function unwrap<T>(response: unknown): (T & { error?: { message?: string } }) | undefined {
  const envelope = response as { success?: boolean; data?: T; error?: { message?: string } };
  if (envelope && typeof envelope === 'object' && envelope.success === true && envelope.data) {
    return envelope.data as (T & { error?: { message?: string } });
  }
  if (envelope && typeof envelope === 'object' && envelope.success === false) {
    return { error: envelope.error } as (T & { error?: { message?: string } });
  }
  return response as (T & { error?: { message?: string } });
}

function shortToken(token: string): string {
  return token.length > 14 ? `${token.slice(0, 14)}…` : token;
}

export function SupportHubInboxWorkspace(props: { installationId: string; disabled?: boolean }) {
  const { disabled } = props;
  const tf = useWorkspaceText();
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [transcript, setTranscript] = useState<ConversationTranscript | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replying, setReplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/extensions/plugin/support-hub/api/admin/conversations', {
        headers: { 'x-installation-id': 'default' },
      });
      const data = unwrap<{ conversations?: SupportConversation[] }>(response);
      if (data?.error) {
        throw new Error(data.error.message || tf('inbox.loadFailed', 'Failed to load conversations.'));
      }
      setConversations(data?.conversations ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tf('inbox.loadFailed', 'Failed to load conversations.'));
    } finally {
      setLoading(false);
    }
  }, [tf]);

  useEffect(() => {
    if (!disabled) {
      void load();
    }
  }, [disabled, load]);

  const openConversation = useCallback(async (conversationId: string) => {
    setOpening(conversationId);
    try {
      const response = await apiClient.get(
        `/extensions/plugin/support-hub/api/admin/conversations/${encodeURIComponent(conversationId)}/messages`,
        { headers: { 'x-installation-id': 'default' } },
      );
      const data = unwrap<ConversationTranscript>(response);
      if (data?.error) {
        throw new Error(data.error.message || tf('inbox.openFailed', 'Failed to load the conversation.'));
      }
      if (!data) {
        throw new Error(tf('inbox.notFound', 'Conversation not found.'));
      }
      setTranscript(data);
      // Opening a conversation clears its unread contribution (best effort;
      // the bell re-polls the unread count on its own schedule).
      void apiClient.post('/extensions/plugin/support-hub/api/admin/conversations/mark-read', {
        conversationId,
      }, { headers: { 'x-installation-id': 'default' } }).catch(() => undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tf('inbox.openFailed', 'Failed to load the conversation.'));
    } finally {
      setOpening(null);
    }
  }, [tf]);

  const sendReply = useCallback(async () => {
    const text = replyDraft.trim();
    const conversationId = transcript?.conversationId;
    if (!text || replying || !conversationId) return;
    setReplying(true);
    try {
      const response = await apiClient.post(
        `/extensions/plugin/support-hub/api/admin/conversations/${encodeURIComponent(conversationId)}/reply`,
        { message: text },
        { headers: { 'x-installation-id': 'default' } },
      );
      const data = unwrap<{ reply?: SupportConversationMessage }>(response);
      if (data?.error) {
        throw new Error(data.error.message || tf('inbox.replyFailed', 'Failed to send the reply.'));
      }
      if (data?.reply) {
        const reply = data.reply as SupportConversationMessage;
        setTranscript((current) => (current ? { ...current, messages: [...current.messages, reply] } : current));
      }
      setReplyDraft('');
      toast.success(tf('inbox.replySent', 'Reply sent to the visitor chat.'));
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tf('inbox.replyFailed', 'Failed to send the reply.'));
    } finally {
      setReplying(false);
    }
  }, [load, replyDraft, replying, tf, transcript]);

  return (
    <WorkspaceCard
      icon={<MessagesSquare className="h-6 w-6" />}
      title={tf('supportTitle', 'Support conversations')}
      description={disabled
        ? tf('inbox.disabledHint', 'Enable the plugin to view visitor conversations.')
        : tf('inbox.description', 'Visitor messages from the storefront support chat and the assistant replies.')}
      actions={disabled ? null : (
        <Button variant="outline" className={workspaceOutlineButtonClass} onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {tf('refresh', 'Refresh')}
        </Button>
      )}
    >
      {!disabled ? (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/60 text-left">
                <tr>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">{tf('inbox.visitor', 'Visitor')}</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">{tf('inbox.messages', 'Messages')}</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">{tf('inbox.lastMessage', 'Last message')}</th>
                  <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">{tf('inbox.updated', 'Updated')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {conversations.map((conversation) => {
                  const isSelected = transcript?.conversationId === conversation.id;
                  return (
                    <tr key={conversation.id} className={isSelected ? 'bg-blue-50/50' : undefined}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-700">
                        {shortToken(conversation.visitorToken)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                          {conversation.messageCount}
                        </Badge>
                      </td>
                      <td className="max-w-[320px] truncate px-4 py-3 text-gray-700">
                        {conversation.lastMessage ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                        {new Date(conversation.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg px-3 text-xs font-semibold"
                          disabled={opening === conversation.id}
                          onClick={() => void openConversation(conversation.id)}
                        >
                          {opening === conversation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {tf('inbox.view', 'View')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!loading && conversations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      {tf('inbox.empty', 'No conversations yet.')}
                    </td>
                  </tr>
                ) : null}
                {loading && conversations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      {tf('inbox.loading', 'Loading conversations…')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {transcript ? (
            <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/40 p-5">
              <div className="flex items-center justify-between gap-4">
                <p className="min-w-0 text-sm font-semibold text-gray-900">
                  {tf('inbox.transcript', 'Conversation with visitor {visitor}', { visitor: shortToken(transcript.visitorToken) })}
                </p>
                <Button variant="ghost" size="sm" className="h-8 rounded-lg px-3 text-xs font-semibold text-gray-500 hover:text-gray-900" onClick={() => setTranscript(null)}>
                  {tf('inbox.close', 'Close')}
                </Button>
              </div>
              <ul className="space-y-2">
                {transcript.messages.map((message) => {
                  const fromVisitor = message.role === 'visitor';
                  const fromAgent = !fromVisitor && message.sender === 'agent';
                  return (
                    <li
                      key={message.id}
                      className={
                        fromVisitor
                          ? 'rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm leading-6 text-blue-950'
                          : 'rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm leading-6 text-gray-800'
                      }
                    >
                      <span className="mr-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                        {fromVisitor
                          ? tf('inbox.roleVisitor', 'Visitor')
                          : fromAgent ? tf('inbox.roleAgent', 'Support agent') : tf('inbox.roleAi', 'AI assistant')}
                      </span>
                      {message.content}
                      {message.actions && message.actions.length > 0 ? (
                        <span className="mt-1 block text-xs text-gray-500">
                          {tf('inbox.actions', 'Actions: {actions}', { actions: message.actions.map((action) => action.label).join(', ') })}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
                {transcript.messages.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-500">{tf('inbox.emptyTranscript', 'No messages in this conversation.')}</li>
                ) : null}
              </ul>
              <div className="flex items-end gap-3 border-t border-gray-100 pt-4">
                <textarea
                  className="min-h-[44px] flex-1 resize-y rounded-xl border border-gray-100 bg-white px-3.5 py-2.5 text-sm leading-6 text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                  placeholder={tf(
                    'inbox.replyPlaceholder',
                    'Reply as a support agent. The visitor sees this in the storefront chat, and AI replies stop for this conversation.',
                  )}
                  value={replyDraft}
                  maxLength={2000}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void sendReply();
                  }}
                />
                <Button
                  className={workspacePrimaryButtonClass}
                  disabled={replying || replyDraft.trim().length === 0}
                  onClick={() => void sendReply()}
                >
                  {replying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {tf('inbox.sendReply', 'Send reply')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </WorkspaceCard>
  );
}
