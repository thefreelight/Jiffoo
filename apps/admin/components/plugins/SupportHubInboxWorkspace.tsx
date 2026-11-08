import { useCallback, useEffect, useState } from 'react';
import { Loader2, MessagesSquare, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

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

export function SupportHubInboxWorkspace(props: { installationId: string; disabled?: boolean }) {
  const { disabled } = props;
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
        throw new Error(data.error.message || 'Failed to load conversations');
      }
      setConversations(data?.conversations ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

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
        throw new Error(data.error.message || 'Failed to load conversation');
      }
      if (!data) {
        throw new Error('Conversation not found');
      }
      setTranscript(data);
      // Opening a conversation clears its unread contribution (best effort;
      // the bell re-polls the unread count on its own schedule).
      void apiClient.post('/extensions/plugin/support-hub/api/admin/conversations/mark-read', {
        conversationId,
      }, { headers: { 'x-installation-id': 'default' } }).catch(() => undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load conversation');
    } finally {
      setOpening(null);
    }
  }, []);

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
        throw new Error(data.error.message || 'Failed to send reply');
      }
      if (data?.reply) {
        const reply = data.reply as SupportConversationMessage;
        setTranscript((current) => (current ? { ...current, messages: [...current.messages, reply] } : current));
      }
      setReplyDraft('');
      toast.success('Reply sent to the visitor chat.');
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send reply');
    } finally {
      setReplying(false);
    }
  }, [load, replyDraft, replying, transcript]);

  if (disabled) {
    return (
      <Card className="rounded-2xl border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
            <MessagesSquare className="h-5 w-5 text-slate-500" />
            Conversations
          </CardTitle>
          <CardDescription>Enable the plugin to view visitor conversations.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
            <MessagesSquare className="h-5 w-5 text-slate-500" />
            Conversations
          </CardTitle>
          <CardDescription>
            Visitor messages from the storefront support chat and the assistant replies.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Visitor</th>
                <th className="px-4 py-2.5 font-medium">Messages</th>
                <th className="px-4 py-2.5 font-medium">Last message</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {conversations.map((conversation) => (
                <tr key={conversation.id} className={transcript?.conversationId === conversation.id ? 'bg-slate-50' : undefined}>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                    {conversation.visitorToken.length > 14
                      ? `${conversation.visitorToken.slice(0, 14)}…`
                      : conversation.visitorToken}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="secondary" className="rounded-md px-2 py-0.5">
                      {conversation.messageCount}
                    </Badge>
                  </td>
                  <td className="max-w-[320px] truncate px-4 py-2.5 text-slate-700">
                    {conversation.lastMessage ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                    {new Date(conversation.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={opening === conversation.id}
                      onClick={() => void openConversation(conversation.id)}
                    >
                      {opening === conversation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      View
                    </Button>
                  </td>
                </tr>
              ))}
              {!loading && conversations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No conversations yet.
                  </td>
                </tr>
              ) : null}
              {loading && conversations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Loading conversations…
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {transcript ? (
          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-semibold text-slate-900">
                Transcript · visitor{' '}
                <span className="font-mono text-xs text-slate-500">
                  {transcript.visitorToken.length > 14
                    ? `${transcript.visitorToken.slice(0, 14)}…`
                    : transcript.visitorToken}
                </span>
              </p>
              <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => setTranscript(null)}>
                Close
              </Button>
            </div>
            <ul className="space-y-2">
              {transcript.messages.map((message) => (
                <li
                  key={message.id}
                  className={
                    message.role === 'visitor'
                      ? 'rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950'
                      : 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800'
                  }
                >
                  <span className="mr-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    {message.role === 'assistant' && message.sender ? `assistant (${message.sender})` : message.role}
                  </span>
                  {message.content}
                  {message.actions && message.actions.length > 0 ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      actions: {message.actions.map((action) => action.label).join(', ')}
                    </span>
                  ) : null}
                </li>
              ))}
              {transcript.messages.length === 0 ? (
                <li className="px-3 py-2 text-sm text-slate-500">No messages in this conversation.</li>
              ) : null}
            </ul>
            <div className="flex items-end gap-2 border-t border-slate-100 pt-3">
              <textarea
                className="min-h-[44px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                placeholder="Reply as a support agent — the visitor sees this in the storefront chat. Replying disables AI answers for this conversation."
                value={replyDraft}
                maxLength={2000}
                onChange={(event) => setReplyDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void sendReply();
                }}
              />
              <Button
                className="rounded-lg"
                size="sm"
                disabled={replying || replyDraft.trim().length === 0}
                onClick={() => void sendReply()}
              >
                {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Send reply
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
