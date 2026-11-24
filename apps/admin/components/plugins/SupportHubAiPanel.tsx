'use client';

/**
 * Support Hub AI reply settings. The panel edits the shared config draft like
 * any other section of the workspace; the page-level Save button persists it.
 */

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useLocale } from 'shared/src/i18n/react';
import { apiClient, unwrapApiResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { usePluginSaveRegistry } from '@/components/plugins/plugin-save-registry';
import {
  WorkspaceCard,
  WorkspaceField,
  WorkspaceToggleRow,
  workspaceInputClass,
  workspaceOutlineButtonClass,
  workspaceSelectTriggerClass,
} from '@/components/plugins/plugin-workspace-ui';
import { useWorkspaceText } from '@/components/plugins/use-workspace-text';

/**
 * Mainstream OpenAI-compatible provider presets. Picking a provider fills
 * aiBaseUrl + a default aiModel, so the operator only enters the API key;
 * "custom" keeps the manual inputs.
 */
interface ProviderPreset {
  key: string;
  label: string;
  labelZhHans: string;
  labelZhHant: string;
  baseUrl: string;
  models: string[];
}

const GLM_MODELS = ['glm-5.3', 'glm-5.3-flash', 'glm-5.3-flashx', 'glm-5.2', 'glm-5.1', 'glm-4.7', 'glm-4.7-flash'];

const PROVIDER_PRESETS: ProviderPreset[] = [
  { key: 'glm', label: 'Zhipu GLM (China)', labelZhHans: '智谱 GLM（国内）', labelZhHant: '智譜 GLM（國內）', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: GLM_MODELS },
  { key: 'zai', label: 'Z.ai (Zhipu, international)', labelZhHans: 'Z.ai（智谱国际版）', labelZhHant: 'Z.ai（智譜國際版）', baseUrl: 'https://api.z.ai/api/paas/v4', models: GLM_MODELS },
  { key: 'deepseek', label: 'DeepSeek', labelZhHans: 'DeepSeek', labelZhHant: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-flash', 'deepseek-chat', 'deepseek-reasoner'] },
  { key: 'moonshot', label: 'Moonshot Kimi', labelZhHans: 'Moonshot Kimi', labelZhHant: 'Moonshot Kimi', baseUrl: 'https://api.moonshot.cn/v1', models: ['kimi-latest', 'kimi-k3.1-pro'] },
  { key: 'qwen', label: 'Qwen (Alibaba Cloud)', labelZhHans: '通义千问 Qwen', labelZhHant: '通義千問 Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen3.8-max', 'qwen3.8-flash', 'qwen-plus', 'qwen-turbo'] },
  { key: 'openai', label: 'OpenAI', labelZhHans: 'OpenAI', labelZhHant: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-5.2', 'gpt-4o-mini'] },
  { key: 'custom', label: 'Custom', labelZhHans: '自定义', labelZhHant: '自訂', baseUrl: '', models: [] },
];

interface SupportHubAiConfig {
  chatEnabled?: boolean;
  aiEnabled?: boolean;
  aiProvider?: string;
  aiBaseUrl?: string;
  aiApiKey?: string;
  aiModel?: string;
  aiSystemPrompt?: string;
  aiWelcomeMessage?: string;
  aiHandoffMessage?: string;
}

export function SupportHubAiPanel(props: {
  configDraft: Record<string, unknown>;
  onUpdateField: (field: string, value: unknown) => void;
  disabled?: boolean;
}) {
  const { configDraft, onUpdateField, disabled } = props;
  const locale = useLocale();
  const tf = useWorkspaceText();
  const { hasDirty } = usePluginSaveRegistry();
  const [testing, setTesting] = useState(false);
  const cfg = configDraft as SupportHubAiConfig;
  const aiEnabled = cfg.aiEnabled === true;
  const chatEnabled = cfg.chatEnabled === true;

  const providerKey = cfg.aiProvider || 'custom';
  const preset = PROVIDER_PRESETS.find((candidate) => candidate.key === providerKey) ??
    PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1]!;
  const providerModels = preset.models;
  const providerLabel = (candidate: ProviderPreset) =>
    locale === 'zh-Hant' ? candidate.labelZhHant : locale === 'zh-Hans' ? candidate.labelZhHans : candidate.label;

  // The test posts through the storefront with the saved configuration, so it
  // would report on stale settings while the draft has unsaved edits.
  const testBlockedHint = disabled
    ? tf('ai.testEnableFirst', 'Enable the plugin before sending a test message.')
    : hasDirty
      ? tf('ai.testSaveFirstHint', 'Save your changes before sending a test message.')
      : tf('ai.testHint', 'Sends a visitor message through the storefront using the saved configuration.');

  const testReply = async () => {
    setTesting(true);
    try {
      const visitorToken = `panel_test_${Date.now().toString(36)}`;
      const response = await apiClient.post(
        '/extensions/plugin/support-hub/api/store/chat/messages',
        { visitorToken, message: 'AI 连通性测试 / connectivity test' },
        { headers: { 'x-installation-id': 'default' } },
      );
      const data = unwrapApiResponse<{ reply?: { content?: string; sender?: string } | null }>(response);
      const reply = data?.reply;
      if (reply?.content) {
        toast.success(tf('ai.testReply', 'AI replied: {reply}', { reply: reply.content.slice(0, 80) }));
      } else {
        toast.message(tf(
          'ai.testNoReply',
          'Message sent, but no AI reply came back (the conversation may be with a human agent, or AI replies are off).',
        ));
      }
    } catch {
      toast.error(tf('ai.testFailed', 'Test failed. Check that the plugin is enabled and the configuration is saved.'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <WorkspaceCard
      icon={<Sparkles className="h-6 w-6" />}
      title={tf('ai.title', 'AI support assistant')}
      description={tf(
        'ai.description',
        'Pick a provider (the endpoint and default model are filled in for you), add an API key, and AI answers storefront questions automatically.',
      )}
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <WorkspaceToggleRow
            id="support-hub-chatEnabled"
            label={tf('ai.chatToggle', 'Storefront chat')}
            description={tf('ai.chatToggleHint', 'Show the chat entry on the storefront so visitors can start a conversation.')}
            checked={chatEnabled}
            disabled={disabled}
            onCheckedChange={(checked) => onUpdateField('chatEnabled', checked)}
          />
          <WorkspaceToggleRow
            id="support-hub-aiEnabled"
            label={tf('ai.aiToggle', 'AI replies')}
            description={tf(
              'ai.aiToggleHint',
              'Let AI answer storefront questions automatically. Conversations an agent has replied to are left to humans.',
            )}
            checked={aiEnabled}
            disabled={disabled}
            onCheckedChange={(checked) => onUpdateField('aiEnabled', checked)}
          />
        </div>

        {aiEnabled ? (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              <WorkspaceField
                label={tf('ai.provider', 'AI provider')}
                htmlFor="support-hub-aiProvider"
                hint={providerKey === 'custom' ? tf('ai.providerCustomHint', 'Custom mode: enter the endpoint and model name yourself.') : tf('ai.providerAutoHint', 'The endpoint and default model are filled in for you.')}
              >
                <Select
                  value={providerKey}
                  disabled={disabled}
                  onValueChange={(next) => {
                    const target = PROVIDER_PRESETS.find((candidate) => candidate.key === next);
                    if (!target) return;
                    onUpdateField('aiProvider', target.key);
                    if (target.key !== 'custom') {
                      onUpdateField('aiBaseUrl', target.baseUrl);
                      onUpdateField('aiModel', target.models[0] ?? '');
                    }
                  }}
                >
                  <SelectTrigger id="support-hub-aiProvider" className={workspaceSelectTriggerClass}>
                    <SelectValue placeholder={tf('ai.provider', 'AI provider')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_PRESETS.map((candidate) => (
                      <SelectItem key={candidate.key} value={candidate.key}>
                        {providerLabel(candidate)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </WorkspaceField>

              {providerKey === 'custom' ? (
                <WorkspaceField
                  label={tf('ai.baseUrl', 'Base URL')}
                  htmlFor="support-hub-aiBaseUrl"
                  hint={tf('ai.baseUrlHint', 'OpenAI-compatible endpoint; /chat/completions is appended automatically.')}
                >
                  <Input
                    id="support-hub-aiBaseUrl"
                    value={cfg.aiBaseUrl ?? ''}
                    onChange={(event) => onUpdateField('aiBaseUrl', event.target.value)}
                    placeholder="https://api.openai.com/v1"
                    disabled={disabled}
                    className={workspaceInputClass}
                  />
                </WorkspaceField>
              ) : (
                <WorkspaceField label={tf('ai.baseUrlAuto', 'Base URL (automatic)')} htmlFor="support-hub-aiBaseUrl">
                  <div
                    id="support-hub-aiBaseUrl"
                    className="flex h-11 items-center truncate rounded-xl border border-gray-100 bg-gray-50/60 px-4 text-sm text-gray-600"
                    title={preset.baseUrl}
                  >
                    {preset.baseUrl}
                  </div>
                </WorkspaceField>
              )}

              {providerModels.length > 0 ? (
                <WorkspaceField label={tf('ai.model', 'Model')} htmlFor="support-hub-aiModel">
                  <Select
                    value={providerModels.includes(cfg.aiModel ?? '') ? cfg.aiModel ?? providerModels[0] : providerModels[0]}
                    disabled={disabled}
                    onValueChange={(next) => onUpdateField('aiModel', next)}
                  >
                    <SelectTrigger id="support-hub-aiModel" className={workspaceSelectTriggerClass}>
                      <SelectValue placeholder={tf('ai.model', 'Model')} />
                    </SelectTrigger>
                    <SelectContent>
                      {providerModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
              ) : (
                <WorkspaceField label={tf('ai.modelName', 'Model name')} htmlFor="support-hub-aiModel">
                  <Input
                    id="support-hub-aiModel"
                    value={cfg.aiModel ?? ''}
                    onChange={(event) => onUpdateField('aiModel', event.target.value)}
                    placeholder="gpt-4o-mini"
                    disabled={disabled}
                    className={workspaceInputClass}
                  />
                </WorkspaceField>
              )}

              <WorkspaceField label={tf('ai.apiKey', 'API key')} htmlFor="support-hub-aiApiKey">
                <Input
                  id="support-hub-aiApiKey"
                  type="password"
                  value={cfg.aiApiKey ?? ''}
                  onChange={(event) => onUpdateField('aiApiKey', event.target.value)}
                  placeholder={providerKey === 'glm' ? tf('ai.apiKeyPlaceholderGlm', 'Paste your Zhipu API key…') : 'sk-…'}
                  disabled={disabled}
                  autoComplete="off"
                  spellCheck={false}
                  className={workspaceInputClass}
                />
              </WorkspaceField>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <WorkspaceField label={tf('ai.welcome', 'Welcome message')} htmlFor="support-hub-aiWelcomeMessage">
                <Input
                  id="support-hub-aiWelcomeMessage"
                  value={cfg.aiWelcomeMessage ?? ''}
                  onChange={(event) => onUpdateField('aiWelcomeMessage', event.target.value)}
                  disabled={disabled}
                  className={workspaceInputClass}
                />
              </WorkspaceField>
              <WorkspaceField label={tf('ai.handoff', 'Handoff message')} htmlFor="support-hub-aiHandoffMessage">
                <Input
                  id="support-hub-aiHandoffMessage"
                  value={cfg.aiHandoffMessage ?? ''}
                  onChange={(event) => onUpdateField('aiHandoffMessage', event.target.value)}
                  disabled={disabled}
                  className={workspaceInputClass}
                />
              </WorkspaceField>
              <WorkspaceField
                label={tf('ai.systemPrompt', 'System prompt')}
                htmlFor="support-hub-aiSystemPrompt"
                className="md:col-span-2"
              >
                <Textarea
                  id="support-hub-aiSystemPrompt"
                  value={cfg.aiSystemPrompt ?? ''}
                  onChange={(event) => onUpdateField('aiSystemPrompt', event.target.value)}
                  disabled={disabled}
                  className="min-h-[96px] rounded-xl border-gray-100 bg-white font-mono text-xs"
                />
              </WorkspaceField>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50/40 px-4 py-3">
              <p className="min-w-0 text-sm leading-6 text-gray-600">{testBlockedHint}</p>
              <Button
                variant="outline"
                className={workspaceOutlineButtonClass}
                disabled={disabled || hasDirty || testing}
                onClick={() => void testReply()}
              >
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {tf('ai.test', 'Send test message')}
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/40 px-4 py-8 text-center text-sm leading-6 text-gray-500">
            {tf(
              'ai.aiOffHint',
              'Turn on AI replies, pick a provider, and add an API key to let AI answer storefront questions.',
            )}
          </div>
        )}
      </div>
    </WorkspaceCard>
  );
}
