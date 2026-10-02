'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Settings2 } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import { parsePluginConfigSchema, validatePluginConfig, type PluginConfigSchema } from 'shared';
import { isAdminApiError } from '@/lib/api';
import type { PluginConfigMeta } from '@/lib/types';
import {
  useInstalledPlugins,
  usePluginConfig,
  usePluginInstances,
  useUpdatePluginInstance,
} from '@/lib/hooks/use-api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { InstalledPluginsRail } from '@/components/extensions/InstalledPluginsRail';
import { PluginTrust } from '@/components/extensions/PluginTrust';
import { DisablePluginControl } from '@/components/plugins/DisablePluginControl';
import { toast } from 'sonner';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const formText = {
  en: { title: 'Configuration', description: 'Configuration fields are declared by this extension.', save: 'Save configuration', saving: 'Saving...', configured: 'Configured. Enter a new value to replace it.', select: 'Select', invalid: 'Invalid value' },
  'zh-Hans': { title: '配置', description: '配置字段由扩展声明。', save: '保存配置', saving: '保存中...', configured: '已配置。输入新值以替换。', select: '选择', invalid: '无效的值' },
  'zh-Hant': { title: '設定', description: '設定欄位由擴充功能宣告。', save: '儲存設定', saving: '儲存中...', configured: '已設定。輸入新值以取代。', select: '選擇', invalid: '無效的值' },
} as const;

function GenericConfigEditor({
  schema,
  draft,
  meta,
  saving,
  locale,
  errors,
  onChange,
  onSave,
}: {
  schema: PluginConfigSchema;
  draft: Record<string, unknown>;
  meta?: PluginConfigMeta;
  saving: boolean;
  locale: string;
  errors: Record<string, string>;
  onChange: (field: string, value: unknown) => void;
  onSave: () => void;
}) {
  const text = formText[locale as keyof typeof formText] ?? formText.en;
  return (
    <Card className="rounded-2xl border-cool-soft/80 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <CardHeader>
        <CardTitle className="text-lg tracking-tight">{text.title}</CardTitle>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {Object.entries(schema.properties).map(([field, descriptor]) => {
          const type = descriptor.type;
          const configured = Boolean(meta?.secretFields?.[field]?.configured);
          const label = descriptor.title || field;
          const value = draft[field];
          const required = schema.required?.includes(field) ?? false;
          return (
            <div key={field} className="space-y-2">
              <Label htmlFor={`plugin-config-${field}`}>
                {label}{required ? ' *' : ''}
              </Label>
              {descriptor.description ? <p className="text-sm text-muted-foreground">{descriptor.description}</p> : null}
              {type === 'boolean' ? (
                <Switch id={`plugin-config-${field}`} aria-label={label} checked={Boolean(value ?? descriptor.default)} onCheckedChange={(checked) => onChange(field, checked)} />
              ) : type === 'string' && descriptor.enum ? (
                <Select value={typeof value === 'string' ? value : ''} onValueChange={(next) => onChange(field, next)}>
                  <SelectTrigger id={`plugin-config-${field}`} aria-label={label}><SelectValue placeholder={`${text.select} ${label}`} /></SelectTrigger>
                  <SelectContent>{descriptor.enum.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input
                  id={`plugin-config-${field}`}
                  type={descriptor.sensitive ? 'password' : type === 'number' || type === 'integer' ? 'number' : 'text'}
                  step={type === 'integer' ? 1 : type === 'number' ? 'any' : undefined}
                  min={descriptor.minimum}
                  max={descriptor.maximum}
                  minLength={descriptor.minLength}
                  maxLength={descriptor.maxLength}
                  value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
                  placeholder={descriptor.sensitive && configured ? text.configured : undefined}
                  onChange={(event) => onChange(field, type === 'number' || type === 'integer'
                    ? event.target.value === '' ? undefined : Number(event.target.value)
                    : event.target.value)}
                />
              )}
              {errors[field] ? <p role="alert" className="text-sm text-destructive">{errors[field] || text.invalid}</p> : null}
            </div>
          );
        })}
        <Button onClick={onSave} disabled={saving} className="rounded-lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {saving ? text.saving : text.save}
        </Button>
      </CardContent>
    </Card>
  );
}

export function PluginWorkspace({ slug }: { slug: string }) {
  const locale = useLocale();
  const t = useT();
  const { data, isLoading, error } = usePluginConfig(slug);
  const { data: instancesData } = usePluginInstances(slug);
  const { data: installedPluginsData } = useInstalledPlugins();
  const { mutateAsync: updateInstance, isPending: updating } = useUpdatePluginInstance();
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const getText = (key: string, fallback: string) => {
    const translated = t?.(key);
    return translated && translated !== key ? translated : fallback;
  };
  const instances = useMemo(() => instancesData?.items || [], [instancesData?.items]);
  const selected = instances[0] || null;
  const schema = data?.configSchema ? parsePluginConfigSchema(data.configSchema).schema : null;
  const config = isPlainObject(selected?.config) ? selected.config : {};
  const meta = selected?.configMeta || data?.configMeta;
  const readinessConfig = { ...config };
  if (schema) for (const [name, field] of Object.entries(schema.properties)) {
    if (field.sensitive && meta?.secretFields?.[name]?.configured && !readinessConfig[name]) readinessConfig[name] = 'configured';
  }
  const missing = schema ? validatePluginConfig(schema, readinessConfig)
    .filter((issue) => issue.message === 'Required field is missing')
    .map((issue) => issue.path.slice('config.'.length)) : [];
  const readiness = { ready: missing.length === 0, missing };
  const saving = updating;

  useEffect(() => {
    const initial = { ...config };
    if (schema) for (const [name, field] of Object.entries(schema.properties)) {
      if (field.sensitive) delete initial[name];
      else if (!Object.prototype.hasOwnProperty.call(initial, name) && field.default !== undefined) initial[name] = field.default;
    }
    setDraft(initial);
    setFieldErrors({});
  }, [selected?.installationId, selected?.updatedAt, data?.configSchema]);

  const save = async () => {
    try {
      if (!selected) throw new Error('Default plugin instance is unavailable');
      setFieldErrors({});
      await updateInstance({ slug, installationId: selected.installationId, enabled: selected.enabled, config: draft });
    } catch (error) {
      if (isAdminApiError(error) && isPlainObject(error.details) && Array.isArray(error.details.fields)) {
        const fields: Record<string, string> = {};
        for (const issue of error.details.fields) {
          if (isPlainObject(issue) && typeof issue.path === 'string' && issue.path.startsWith('config.')) {
            fields[issue.path.slice('config.'.length)] = typeof issue.message === 'string' ? issue.message : '';
          }
        }
        setFieldErrors(fields);
      }
    }
  };

  const toggle = async () => {
    if (!selected) {
      toast.error('Default plugin instance is unavailable.');
      return;
    }
    if (!selected.enabled && !readiness.ready) {
      toast.error(`This plugin requires configuration before enabling: ${readiness.missing.join(', ')}`);
      return;
    }
    try {
      await updateInstance({ slug, installationId: selected.installationId, enabled: !selected.enabled, config });
    } catch {
      // Mutation hooks present save errors.
    }
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading plugin workspace...</div>;
  if (error || !data) return <div className="flex min-h-screen items-center justify-center p-6"><Alert className="max-w-md"><AlertTriangle className="h-4 w-4" /><AlertTitle>Plugin unavailable</AlertTitle><AlertDescription>The plugin details could not be loaded.</AlertDescription></Alert></div>;

  return (
    <div className="min-h-screen bg-cool-veil p-5 sm:p-7 lg:p-10">
      <div className="mx-auto grid max-w-[1600px] gap-5 lg:grid-cols-[260px,minmax(0,1fr)]">
        <InstalledPluginsRail locale={locale} plugins={installedPluginsData?.items || []} selectedSlug={slug} getText={getText} />
        <div className="space-y-5">
          <Card className="rounded-2xl border-cool-soft/80 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-cool-base"><Link href={`/${locale}/plugins`} className="hover:text-action-strong">Plugins</Link><span>/</span><span>{data.name || slug}</span></div>
              <CardTitle className="flex items-center gap-2 text-2xl">{data.name || slug}</CardTitle>
              <CardDescription>{data.description || 'Manage the extension configuration.'}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <PluginTrust plugin={data} />
              <Badge variant={selected?.enabled ? 'default' : 'outline'}>{selected?.enabled ? 'Enabled' : 'Disabled'}</Badge>
              <Badge variant={readiness.ready ? 'default' : 'outline'}>{readiness.ready ? 'Configuration ready' : 'Configuration required'}</Badge>
            </CardContent>
          </Card>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),360px]">
            <div className="space-y-5">
              {schema && Object.keys(schema.properties).length ? <GenericConfigEditor schema={schema} draft={draft} meta={meta} saving={saving} locale={locale} errors={fieldErrors} onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))} onSave={() => void save()} /> : <Alert><Settings2 className="h-4 w-4" /><AlertTitle>No configuration declared</AlertTitle><AlertDescription>This extension does not declare configuration fields.</AlertDescription></Alert>}
            </div>
            <div className="space-y-5">
              <Card><CardHeader><CardTitle>Plugin status</CardTitle><CardDescription>Core manages the default plugin configuration.</CardDescription></CardHeader><CardContent className="space-y-4">{selected?.enabled
                ? <DisablePluginControl slug={slug} category={data.category} label="Disable plugin" disabled={saving} onDisable={toggle} />
                : <Button onClick={() => void toggle()} disabled={saving || !selected}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enable plugin</Button>}
                </CardContent></Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
