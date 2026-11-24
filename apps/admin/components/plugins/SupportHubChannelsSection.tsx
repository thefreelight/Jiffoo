'use client';

/**
 * Support Hub contact channels. Each channel pairs its on/off switch with its
 * link on one row, so the two schema fields read as a single setting. Edits
 * go to the shared config draft and are saved by the page-level Save button.
 */

import { Waypoints } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { PluginConfigSchema } from '@/components/plugins/plugin-config-utils';
import { WorkspaceCard, workspaceInputClass } from '@/components/plugins/plugin-workspace-ui';
import { useWorkspaceText } from '@/components/plugins/use-workspace-text';

export const SUPPORT_HUB_CHANNEL_FIELDS = [
  'telegramEnabled',
  'telegramLink',
  'whatsappEnabled',
  'whatsappLink',
  'feishuEnabled',
  'feishuLink',
  'httpsChatEnabled',
  'httpsChatUrl',
];

const CHANNELS = [
  { enabledField: 'telegramEnabled', linkField: 'telegramLink', nameKey: 'channels.telegram', name: 'Telegram', placeholder: 'https://t.me/your-account' },
  { enabledField: 'whatsappEnabled', linkField: 'whatsappLink', nameKey: 'channels.whatsapp', name: 'WhatsApp', placeholder: 'https://wa.me/8613800000000' },
  { enabledField: 'feishuEnabled', linkField: 'feishuLink', nameKey: 'channels.feishu', name: 'Feishu / Lark', placeholder: 'https://applink.feishu.cn/…' },
  { enabledField: 'httpsChatEnabled', linkField: 'httpsChatUrl', nameKey: 'channels.webChat', name: 'Web chat', placeholder: 'https://example.com/contact' },
];

export function SupportHubChannelsSection(props: {
  configSchema: PluginConfigSchema;
  configDraft: Record<string, unknown>;
  onUpdateField: (field: string, value: unknown) => void;
  disabled?: boolean;
}) {
  const { configSchema, configDraft, onUpdateField, disabled } = props;
  const tf = useWorkspaceText();
  // Older plugin versions may not declare every channel; render only the fields that exist.
  const channels = CHANNELS.filter((channel) => channel.linkField in configSchema || channel.enabledField in configSchema);

  if (channels.length === 0) return null;

  return (
    <WorkspaceCard
      icon={<Waypoints className="h-6 w-6" />}
      title={tf('channelsTitle', 'Contact channels')}
      description={tf(
        'channelsDescription',
        'Enabled channels appear as contact options in the storefront support launcher.',
      )}
    >
      <div className="space-y-3">
        {channels.map((channel) => {
          const enabled = configDraft[channel.enabledField] === true;

          return (
            <div
              key={channel.linkField}
              className={cn(
                'grid gap-3 rounded-2xl border border-gray-50 bg-gray-50/40 p-4 transition-colors md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:items-center',
                enabled && 'border-blue-100 bg-blue-50/30',
              )}
            >
              <div className="flex items-center gap-3">
                {channel.enabledField in configSchema ? (
                  <Switch
                    id={`support-hub-${channel.enabledField}`}
                    checked={enabled}
                    disabled={disabled}
                    onCheckedChange={(checked) => onUpdateField(channel.enabledField, checked)}
                    aria-label={tf('channels.channelEnable', 'Enable {channel}', { channel: tf(channel.nameKey, channel.name) })}
                  />
                ) : null}
                <Label htmlFor={`support-hub-${channel.linkField}`} className="text-sm font-semibold text-gray-900">
                  {tf(channel.nameKey, channel.name)}
                </Label>
              </div>
              <Input
                id={`support-hub-${channel.linkField}`}
                value={configDraft[channel.linkField] == null ? '' : String(configDraft[channel.linkField])}
                onChange={(event) => onUpdateField(channel.linkField, event.target.value)}
                placeholder={channel.placeholder}
                disabled={disabled}
                autoComplete="off"
                spellCheck={false}
                className={cn(workspaceInputClass, 'bg-white')}
              />
            </div>
          );
        })}
      </div>
    </WorkspaceCard>
  );
}
