'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { apiClient, unwrapApiResponse } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

/**
 * Mainstream OpenAI-compatible provider presets. Picking a provider fills
 * aiBaseUrl + a default aiModel, so the operator only enters the API key;
 * "custom" keeps the manual inputs.
 */
interface ProviderPreset {
  key: string;
  label: string;
  baseUrl: string;
  models: string[];
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  { key: 'glm', label: '智谱 GLM（国内）', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-5.3', 'glm-5.3-flash', 'glm-5.3-flashx', 'glm-5.2', 'glm-5.1', 'glm-4.7', 'glm-4.7-flash'] },
  { key: 'zai', label: 'Z.ai（智谱国际版）', baseUrl: 'https://api.z.ai/api/paas/v4', models: ['glm-5.3', 'glm-5.3-flash', 'glm-5.3-flashx', 'glm-5.2', 'glm-5.1', 'glm-4.7', 'glm-4.7-flash'] },
  { key: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-flash', 'deepseek-chat', 'deepseek-reasoner'] },
  { key: 'moonshot', label: 'Moonshot Kimi', baseUrl: 'https://api.moonshot.cn/v1', models: ['kimi-latest', 'kimi-k3.1-pro'] },
  { key: 'qwen', label: '通义千问 Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen3.8-max', 'qwen3.8-flash', 'qwen-plus', 'qwen-turbo'] },
  { key: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-5.2', 'gpt-4o-mini'] },
  { key: 'custom', label: '自定义 / Custom', baseUrl: '', models: [] },
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
  onSave: () => Promise<void> | void;
  saving: boolean;
  disabled?: boolean;
}) {
  const { configDraft, onUpdateField, onSave, saving, disabled } = props;
  const cfg = configDraft as SupportHubAiConfig;
  const aiEnabled = cfg.aiEnabled === true;
  const chatEnabled = cfg.chatEnabled === true;

  const providerKey = cfg.aiProvider || 'custom';
  const preset = PROVIDER_PRESETS.find((candidate) => candidate.key === providerKey) ??
    PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1]!;
  const providerModels = preset.models;

  const testReply = async () => {
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
        toast.success(`AI 回复：${reply.content.slice(0, 80)}`);
      } else {
        toast.message('已保存，但当前没有 AI 回复（可能已转人工模式或 AI 未启用）');
      }
    } catch {
      toast.error('连通性测试失败：请确认插件已启用且配置已保存');
    }
  };

  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-7 pt-7">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-lg tracking-tight">
            <Sparkles className="h-5 w-5 text-blue-600" />
            AI 客服助手
            <Badge variant="secondary" className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              AI replies
            </Badge>
          </CardTitle>
          <CardDescription>
            选择主流厂商（自动填好接口地址和模型），填入 API Key 即可让 AI 自动回复店面咨询。客服人工回复过的会话会停用 AI。
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">店面聊天</span>
            <Switch
              checked={chatEnabled}
              disabled={disabled}
              onCheckedChange={(checked) => onUpdateField('chatEnabled', checked)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">AI 回复</span>
            <Switch
              checked={aiEnabled}
              disabled={disabled}
              onCheckedChange={(checked) => onUpdateField('aiEnabled', checked)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-7 pb-7">
        {aiEnabled ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">AI 提供商</Label>
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
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="选择厂商" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_PRESETS.map((candidate) => (
                      <SelectItem key={candidate.key} value={candidate.key}>
                        {candidate.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {providerKey === 'custom'
                    ? '自定义模式：手动填写接口地址与模型名。'
                    : '已自动填好接口地址与默认模型。'}
                </p>
              </div>

              {providerKey === 'custom' ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">接口地址（Base URL）</Label>
                  <Input
                    value={cfg.aiBaseUrl ?? ''}
                    onChange={(event) => onUpdateField('aiBaseUrl', event.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="h-11 rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">OpenAI 兼容地址，系统自动补 /chat/completions。</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">接口地址（自动）</Label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
                    {preset.baseUrl}
                  </div>
                </div>
              )}

              {providerModels.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">模型</Label>
                  <Select
                    value={providerModels.includes(cfg.aiModel ?? '') ? cfg.aiModel : providerModels[0]}
                    disabled={disabled}
                    onValueChange={(next) => {
                      onUpdateField('aiModel', next);
                      if (!providerModels.includes(cfg.aiModel ?? '')) onUpdateField('aiModel', next);
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                      {providerModels.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">模型名</Label>
                  <Input
                    value={cfg.aiModel ?? ''}
                    onChange={(event) => onUpdateField('aiModel', event.target.value)}
                    placeholder="gpt-4o-mini"
                    className="h-11 rounded-xl"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm font-medium">API Key</Label>
                <Input
                  type="password"
                  value={cfg.aiApiKey ?? ''}
                  onChange={(event) => onUpdateField('aiApiKey', event.target.value)}
                  placeholder={providerKey === 'glm' ? '粘贴智谱 API Key…' : 'sk-…'}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">欢迎语</Label>
                <Input
                  value={cfg.aiWelcomeMessage ?? ''}
                  onChange={(event) => onUpdateField('aiWelcomeMessage', event.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">兜底文案（AI 不可用时展示）</Label>
                <Input
                  value={cfg.aiHandoffMessage ?? ''}
                  onChange={(event) => onUpdateField('aiHandoffMessage', event.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium">系统提示词（AI 人设与边界）</Label>
                <Textarea
                  value={cfg.aiSystemPrompt ?? ''}
                  onChange={(event) => onUpdateField('aiSystemPrompt', event.target.value)}
                  className="min-h-[96px] rounded-xl font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3">
              <p className="text-sm text-blue-950">
                保存后可用店面发一条消息做连通性测试。
              </p>
              <Button variant="outline" size="sm" className="shrink-0 rounded-lg" disabled={saving} onClick={() => void testReply()}>
                {!saving ? null : <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                发送测试消息
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            打开上方「AI 回复」开关后，选择厂商并填入 API Key，即可让 AI 自动回答店面咨询。
          </div>
        )}
      </CardContent>
    </Card>
  );
}
