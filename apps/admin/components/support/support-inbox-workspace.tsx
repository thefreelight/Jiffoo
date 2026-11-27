'use client';

/**
 * The support inbox: a standard two-pane help-desk workspace for the
 * support-hub plugin. Conversations on the left, the open one and its reply
 * box on the right.
 */

import { useCallback, useLayoutEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store';
import { canAccessAnyPermission } from '@/lib/admin-access';
import { useWorkspaceText } from '@/components/plugins/use-workspace-text';
import { useLocale } from 'shared/src/i18n/react';
import { ADMIN_PERMISSIONS } from 'shared';
import { ConversationList } from './conversation-list';
import { ConversationThread } from './conversation-thread';
import { useSupportInbox } from './use-support-inbox';

/** Space the page shell leaves under its content. */
const PAGE_BOTTOM_GAP = 20;
/** Never shorter than this, even on a small screen; the page scrolls instead. */
const MIN_HEIGHT = 600;

/**
 * Height that lets the inbox fill the viewport under the page header. Measured
 * rather than fixed, because the header wraps to a different height per
 * language and screen width.
 */
function useFillHeight(): [(element: HTMLDivElement | null) => void, number | undefined] {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const scroller = element?.closest('main');
    if (!element || !scroller) return;
    const measure = () => {
      // Where the card starts inside the scroll area, whatever its current scroll position.
      const top = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      setHeight(Math.max(Math.round(scroller.clientHeight - top - PAGE_BOTTOM_GAP), MIN_HEIGHT));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    // The page header sits in the same box; its height changes when its text rewraps.
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [element]);
  return [setElement, height];
}

export function SupportInboxWorkspace(props: { installationId: string; disabled?: boolean }) {
  const { installationId, disabled } = props;
  const workspaceText = useWorkspaceText();
  const locale = useLocale();
  // Every inbox key lives under `merchant.plugins.workspace.inbox.*`; only the shared `refresh` does not.
  const tf = useCallback((key: string, fallback: string, params?: Record<string, string | number>) =>
    workspaceText(key === 'refresh' ? key : `inbox.${key}`, fallback, params), [workspaceText]);
  const user = useAuthStore((state) => state.user);
  const canReply = canAccessAnyPermission(user, [ADMIN_PERMISSIONS.SUPPORT_WRITE]);
  const inbox = useSupportInbox({ installationId, enabled: !disabled });
  const [refreshing, setRefreshing] = useState(false);
  const { markViewed } = inbox;
  const onViewed = useCallback((shown: number) => { markViewed(shown); }, [markViewed]);
  const [workspaceRef, height] = useFillHeight();

  const refresh = async () => {
    setRefreshing(true);
    try {
      await inbox.refreshList();
    } finally {
      setRefreshing(false);
    }
  };

  const send = async () => {
    const sent = await inbox.reply(inbox.draft);
    if (sent) toast.success(tf('replySent', 'Reply sent to the visitor chat.'));
    else if (inbox.draft.trim()) toast.error(tf('replyFailed', 'Failed to send the reply.'));
  };

  if (disabled) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[2rem] border border-gray-100 bg-white px-6 py-16 text-center shadow-sm">
        <p className="text-[15px] font-bold text-gray-900">{tf('disabledTitle', 'Support chat is turned off')}</p>
        <p className="text-sm text-gray-500">{tf('disabledHint', 'Enable the plugin to view visitor conversations.')}</p>
      </div>
    );
  }

  return (
    <div
      ref={workspaceRef}
      data-inbox="workspace"
      // The fixed height is the fallback for a page that has no scroll area to measure.
      style={height ? { height } : undefined}
      className="flex h-[calc(100dvh-176px)] min-h-[600px] overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm"
    >
      <ConversationList
        conversations={inbox.visibleConversations}
        totalCount={inbox.conversations.length}
        unreadCount={inbox.unreadCount}
        takenOverCount={inbox.takenOverCount}
        selectedId={inbox.selectedId}
        seen={inbox.seen}
        state={inbox.listState}
        query={inbox.query}
        onQueryChange={inbox.setQuery}
        filter={inbox.filter}
        onFilterChange={inbox.setFilter}
        onSelect={(conversationId) => void inbox.select(conversationId)}
        onRetry={() => void inbox.retryList()}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
        text={tf}
        locale={locale}
      />
      <ConversationThread
        conversation={inbox.selectedConversation}
        transcript={inbox.transcript}
        state={inbox.threadState}
        sending={inbox.sending}
        canReply={canReply}
        draft={inbox.draft}
        onDraftChange={inbox.setDraft}
        onSend={() => void send()}
        onRetry={() => { if (inbox.selectedId) void inbox.select(inbox.selectedId); }}
        onBack={inbox.clearSelection}
        onViewed={onViewed}
        text={tf}
        locale={locale}
      />
    </div>
  );
}
