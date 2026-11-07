import React from 'react';
import type { ThemeI18nProps } from 'shared/src/types/theme';
import { pickCopy } from '../site';

interface SupportChannel {
  kind: string;
  label: string;
  href: string;
}

interface SupportChatConfig {
  enabled: boolean;
  welcomeMessage: string;
}

interface SupportConfig {
  enabled: boolean;
  channels: SupportChannel[];
  chat: SupportChatConfig;
}

interface SupportChatMessage {
  id: string;
  role: 'visitor' | 'assistant';
  content: string;
  actions?: SupportChannel[];
  createdAt?: string;
}

const VISITOR_TOKEN_STORAGE_KEY = 'bokmoo-support-visitor-token';
const CONFIG_ENDPOINT = '/api/v1/plugins/support-hub/store/config';
const MESSAGES_ENDPOINT = '/api/v1/plugins/support-hub/store/chat/messages';
const HISTORY_ENDPOINT = '/api/v1/plugins/support-hub/store/chat/history';

function readVisitorToken(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_TOKEN_STORAGE_KEY);
    if (existing && /^[A-Za-z0-9_-]{8,128}$/.test(existing)) return existing;
    const generated =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '')
        : `v${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(VISITOR_TOKEN_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `v${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
}

const CHANNEL_ICONS: Record<string, string> = {
  telegram: '✈️',
  whatsapp: '💬',
  feishu: '📮',
  https: '🛟',
};

export const SupportChat = React.memo(function SupportChat({ locale }: ThemeI18nProps) {
  const [config, setConfig] = React.useState<SupportConfig | null>(null);
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<SupportChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const historyLoaded = React.useRef(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const labels = {
    open: pickCopy(locale, {
      en: 'Chat with support',
      hans: '联系客服',
      hant: '聯絡客服',
      ja: 'サポートにチャット',
      ko: '고객 지원 채팅',
      fr: 'Discuter avec le support',
      de: 'Mit dem Support chatten',
    }),
    close: pickCopy(locale, {
      en: 'Close support chat',
      hans: '关闭客服聊天',
      hant: '關閉客服聊天',
      ja: 'チャットを閉じる',
      ko: '채팅 닫기',
      fr: 'Fermer le chat',
      de: 'Chat schließen',
    }),
    title: pickCopy(locale, {
      en: 'Support',
      hans: '客服',
      hant: '客服',
      ja: 'サポート',
      ko: '고객 지원',
      fr: 'Support',
      de: 'Support',
    }),
    placeholder: pickCopy(locale, {
      en: 'Type your message…',
      hans: '输入你的问题…',
      hant: '輸入你的問題…',
      ja: 'メッセージを入力…',
      ko: '메시지를 입력하세요…',
      fr: 'Saisissez votre message…',
      de: 'Nachricht schreiben…',
    }),
    send: pickCopy(locale, {
      en: 'Send',
      hans: '发送',
      hant: '發送',
      ja: '送信',
      ko: '보내기',
      fr: 'Envoyer',
      de: 'Senden',
    }),
    typing: pickCopy(locale, {
      en: 'Typing…',
      hans: '正在输入…',
      hant: '正在輸入…',
      ja: '入力中…',
      ko: '입력 중…',
      fr: 'En train d’écrire…',
      de: 'Schreibt…',
    }),
    error: pickCopy(locale, {
      en: 'Message could not be delivered. Please try again shortly.',
      hans: '消息发送失败，请稍后重试。',
      hant: '訊息傳送失敗，請稍後重試。',
      ja: 'メッセージを送信できませんでした。しばらくしてからもう一度お試しください。',
      ko: '메시지를 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      fr: 'Le message n’a pas pu être envoyé. Veuillez réessayer shortly.',
      de: 'Nachricht konnte nicht zugestellt werden. Bitte später erneut versuchen.',
    }),
  };

  React.useEffect(() => {
    let cancelled = false;
    fetch(CONFIG_ENDPOINT)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled && payload?.success && payload.data) {
          setConfig(payload.data as SupportConfig);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, sending]);

  const loadHistory = React.useCallback((visitorToken: string) => {
    if (historyLoaded.current) return;
    historyLoaded.current = true;
    fetch(`${HISTORY_ENDPOINT}?visitorToken=${encodeURIComponent(visitorToken)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload?.success && payload.data) {
          setConversationId(payload.data.conversationId ?? null);
          setMessages((current) =>
            current.length > 0 ? current : ((payload.data.messages ?? []) as SupportChatMessage[]).slice(-50),
          );
        }
      })
      .catch(() => undefined);
  }, []);

  const openChat = React.useCallback(() => {
    setOpen(true);
    loadHistory(readVisitorToken());
  }, [loadHistory]);

  const send = React.useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    const visitorToken = readVisitorToken();
    setSending(true);
    setMessages((current) => [
      ...current,
      { id: `local_${Date.now()}`, role: 'visitor', content: text },
    ]);
    setInput('');
    try {
      const response = await fetch(MESSAGES_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          visitorToken,
          ...(conversationId ? { conversationId } : {}),
          message: text,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (payload?.success && payload.data) {
        setConversationId(payload.data.conversationId ?? conversationId);
        const reply = payload.data.reply as SupportChatMessage | undefined;
        if (reply) setMessages((current) => [...current, reply]);
      } else {
        setMessages((current) => [
          ...current,
          { id: `error_${Date.now()}`, role: 'assistant', content: labels.error },
        ]);
      }
    } catch {
      setMessages((current) => [
        ...current,
        { id: `error_${Date.now()}`, role: 'assistant', content: labels.error },
      ]);
    } finally {
      setSending(false);
    }
  }, [conversationId, input, labels.error, sending]);

  if (!config || !config.enabled) return null;

  const chatEnabled = config.chat?.enabled === true;
  const hasChannels = Array.isArray(config.channels) && config.channels.length > 0;
  if (!chatEnabled && !hasChannels) return null;

  return (
    <div className="bokmoo-support-root">
      {chatEnabled && open && (
        <div className="bokmoo-support-panel" role="dialog" aria-label={labels.title}>
          <div className="bokmoo-support-head">
            <span className="bokmoo-support-title">{labels.title}</span>
            <button
              type="button"
              className="bokmoo-support-close"
              aria-label={labels.close}
              onClick={() => setOpen(false)}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="bokmoo-support-body" ref={scrollRef}>
            <div className="bokmoo-support-bubble bokmoo-support-bubble-assistant">
              {config.chat.welcomeMessage}
            </div>
            {messages.map((message) => (
              <React.Fragment key={message.id}>
                <div
                  className={
                    message.role === 'visitor'
                      ? 'bokmoo-support-bubble bokmoo-support-bubble-visitor'
                      : 'bokmoo-support-bubble bokmoo-support-bubble-assistant'
                  }
                >
                  {message.content}
                </div>
                {message.role === 'assistant' && message.actions && message.actions.length > 0 && (
                  <div className="bokmoo-support-actions">
                    {message.actions.map((action) => (
                      <a
                        key={`${message.id}_${action.kind}`}
                        className="bokmoo-support-action"
                        href={action.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {CHANNEL_ICONS[action.kind] || '💬'} {action.label}
                      </a>
                    ))}
                  </div>
                )}
              </React.Fragment>
            ))}
            {sending && <div className="bokmoo-support-typing">{labels.typing}</div>}
          </div>
          <div className="bokmoo-support-inputrow">
            <input
              className="bokmoo-support-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') send();
              }}
              placeholder={labels.placeholder}
              maxLength={2000}
              aria-label={labels.placeholder}
            />
            <button type="button" className="bokmoo-support-send" onClick={send} disabled={sending}>
              {labels.send}
            </button>
          </div>
        </div>
      )}

      {chatEnabled ? (
        <button
          type="button"
          className="bokmoo-support-launcher"
          aria-label={open ? labels.close : labels.open}
          title={open ? labels.close : labels.open}
          onClick={() => (open ? setOpen(false) : openChat())}
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 11.5C21 16.194 17.194 20 12.5 20C11.235 20 10.036 19.716 8.962 19.209L3 21L4.791 15.038C4.284 13.964 4 12.765 4 11.5C4 6.806 7.806 3 12.5 3C17.194 3 21 6.806 21 11.5Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      ) : (
        <div className="bokmoo-support-channels">
          {config.channels.map((channel) => (
            <a
              key={channel.kind}
              className="bokmoo-support-channel"
              href={channel.href}
              target="_blank"
              rel="noopener noreferrer"
              title={channel.label}
              aria-label={channel.label}
            >
              {CHANNEL_ICONS[channel.kind] || '💬'}
            </a>
          ))}
        </div>
      )}
    </div>
  );
});
