'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Settings2 } from 'lucide-react';
import { useLocale, useT } from 'shared/src/i18n/react';
import type { PluginConfigMeta } from '@/lib/types';
import {
  useCreatePluginInstance,
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
import { Textarea } from '@/components/ui/textarea';
import { InstalledPluginsRail } from '@/components/extensions/InstalledPluginsRail';
import { PluginInstanceManager } from '@/components/plugins/PluginInstanceManager';
import { toast } from 'sonner';

type PluginConfigDescriptor = {
  type?: string;
  label?: string;
  description?: string;
  required?: boolean;
  enum?: string[];
};

type PluginConfigSchema = Record<string, PluginConfigDescriptor>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function descriptorType(descriptor: PluginConfigDescriptor): string {
  return descriptor.type || 'string';
}

function configReadiness(
  schema: PluginConfigSchema | undefined,
  config: Record<string, unknown>,
  meta?: PluginConfigMeta
) {
  const missing = Object.entries(schema || {}).flatMap(([key, descriptor]) => {
    if (!descriptor.required) return [];
    const value = config[key];
    const secretConfigured = Boolean(meta?.secretFields?.[key]?.configured);
    if (descriptorType(descriptor) === 'secret' && secretConfigured && !value) return [];
    if (value === undefined || value === null || value === '') return [key];
    return [];
  });
  return { required: missing.length > 0, ready: missing.length === 0, missing };
}

function GenericConfigEditor({
  schema,
  draft,
  meta,
  saving,
  onChange,
  onSave,
}: {
  schema: PluginConfigSchema;
  draft: Record<string, unknown>;
  meta?: PluginConfigMeta;
  saving: boolean;
  onChange: (field: string, value: unknown) => void;
  onSave: () => void;
}) {
  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <CardHeader>
        <CardTitle className="text-lg tracking-tight">Configuration</CardTitle>
        <CardDescription>Configuration fields are declared by this extension.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {Object.entries(schema).map(([field, descriptor]) => {
          const type = descriptorType(descriptor);
          const configured = Boolean(meta?.secretFields?.[field]?.configured);
          const label = descriptor.label || field;
          const value = draft[field];
          return (
            <div key={field} className="space-y-2">
              <Label htmlFor={`plugin-config-${field}`}>
                {label}{descriptor.required ? ' *' : ''}
              </Label>
              {descriptor.description ? <p className="text-sm text-muted-foreground">{descriptor.description}</p> : null}
              {type === 'boolean' ? (
                <Switch checked={Boolean(value)} onCheckedChange={(checked) => onChange(field, checked)} />
              ) : type === 'enum' && descriptor.enum ? (
                <Select value={typeof value === 'string' ? value : ''} onValueChange={(next) => onChange(field, next)}>
                  <SelectTrigger id={`plugin-config-${field}`}><SelectValue placeholder={`Select ${label}`} /></SelectTrigger>
                  <SelectContent>{descriptor.enum.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
                </Select>
              ) : type === 'object' || type === 'array' ? (
                <Textarea
                  id={`plugin-config-${field}`}
                  value={typeof value === 'string' ? value : JSON.stringify(value ?? (type === 'array' ? [] : {}), null, 2)}
                  onChange={(event) => {
                    try {
                      const parsed: unknown = JSON.parse(event.target.value);
                      if ((type === 'array' && Array.isArray(parsed)) || (type === 'object' && isPlainObject(parsed))) onChange(field, parsed);
                    } catch {
                      onChange(field, event.target.value);
                    }
                  }}
                  className="min-h-32 font-mono text-xs"
                />
              ) : (
                <Input
                  id={`plugin-config-${field}`}
                  type={type === 'secret' ? 'password' : type === 'number' ? 'number' : 'text'}
                  value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
                  placeholder={type === 'secret' && configured ? 'Configured. Enter a new value to replace it.' : undefined}
                  onChange={(event) => onChange(field, type === 'number' ? Number(event.target.value) : event.target.value)}
                />
              )}
            </div>
          );
        })}
        <Button onClick={onSave} disabled={saving} className="rounded-lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save configuration
        </Button>
      </CardContent>
    </Card>
  );
}

export function PluginWorkspace({ slug }: { slug: string }) {
  const locale = useLocale();
  const t = useT();
  const { data, isLoading, error } = usePluginConfig(slug);
  const { data: instancesData, isLoading: instancesLoading } = usePluginInstances(slug);
  const { data: installedPluginsData } = useInstalledPlugins();
  const { mutateAsync: createInstance, isPending: creating } = useCreatePluginInstance();
  const { mutateAsync: updateInstance, isPending: updating } = useUpdatePluginInstance();
  const [selectedId, setSelectedId] = useState('default');
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  const getText = (key: string, fallback: string) => {
    const translated = t?.(key);
    return translated && translated !== key ? translated : fallback;
  };
  const instances = useMemo(() => instancesData?.items || [], [instancesData?.items]);
  const selected = instances.find((instance) => instance.installationId === selectedId) || instances[0] || null;
  const schema = isPlainObject(data?.configSchema) ? data.configSchema as PluginConfigSchema : undefined;
  const config = isPlainObject(selected?.config) ? selected.config : {};
  const meta = selected?.configMeta || data?.configMeta;
  const readiness = configReadiness(schema, config, meta);
  const saving = creating || updating;

  useEffect(() => {
    setDraft(config);
    if (selected) setSelectedId(selected.installationId);
  }, [selected?.installationId, selected?.updatedAt]);

  const save = async () => {
    try {
      if (selected) {
        await updateInstance({ slug, installationId: selected.installationId, enabled: selected.enabled, config: draft });
      } else {
        const created = await createInstance({ slug, instanceKey: 'default', enabled: false, config: draft });
        setSelectedId(created.installationId);
      }
    } catch {
      // Mutation hooks present save errors.
    }
  };

  const toggle = async () => {
    if (!selected && !readiness.ready) {
      toast.error(`This plugin requires configuration before enabling: ${readiness.missing.join(', ')}`);
      return;
    }
    try {
      if (selected) {
        if (!selected.enabled && !readiness.ready) {
          toast.error(`This plugin requires configuration before enabling: ${readiness.missing.join(', ')}`);
          return;
        }
        await updateInstance({ slug, installationId: selected.installationId, enabled: !selected.enabled, config });
      } else {
        const created = await createInstance({ slug, instanceKey: 'default', enabled: true, config: draft });
        setSelectedId(created.installationId);
      }
    } catch {
      // Mutation hooks present save errors.
    }
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading plugin workspace...</div>;
  if (error || !data) return <div className="flex min-h-screen items-center justify-center p-6"><Alert className="max-w-md"><AlertTriangle className="h-4 w-4" /><AlertTitle>Plugin unavailable</AlertTitle><AlertDescription>The plugin details could not be loaded.</AlertDescription></Alert></div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-5 sm:p-7 lg:p-10">
      <div className="mx-auto grid max-w-[1600px] gap-5 lg:grid-cols-[260px,minmax(0,1fr)]">
        <InstalledPluginsRail locale={locale} plugins={installedPluginsData?.items || []} selectedSlug={slug} officialSlugs={new Set()} getText={getText} />
        <div className="space-y-5">
          <Card className="rounded-2xl border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm text-slate-500"><Link href={`/${locale}/plugins`} className="hover:text-blue-600">Plugins</Link><span>/</span><span>{data.name || slug}</span></div>
              <CardTitle className="flex items-center gap-2 text-2xl">{data.name || slug}</CardTitle>
              <CardDescription>{data.description || 'Manage the extension configuration and instances.'}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Select value={selected?.installationId || selectedId} onValueChange={setSelectedId} disabled={instancesLoading || instances.length === 0}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Select instance" /></SelectTrigger>
                <SelectContent>{instances.length ? instances.map((instance) => <SelectItem key={instance.installationId} value={instance.installationId}>{instance.instanceKey}</SelectItem>) : <SelectItem value="default">default</SelectItem>}</SelectContent>
              </Select>
              <Badge variant={selected?.enabled ? 'default' : 'outline'}>{selected?.enabled ? 'Enabled' : 'Disabled'}</Badge>
              <Badge variant={readiness.ready ? 'default' : 'outline'}>{readiness.ready ? 'Configuration ready' : 'Configuration required'}</Badge>
            </CardContent>
          </Card>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),360px]">
            <div className="space-y-5">
              {schema ? <GenericConfigEditor schema={schema} draft={draft} meta={meta} saving={saving} onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))} onSave={() => void save()} /> : <Alert><Settings2 className="h-4 w-4" /><AlertTitle>No configuration declared</AlertTitle><AlertDescription>This extension does not declare configuration fields.</AlertDescription></Alert>}
            </div>
            <div className="space-y-5">
              <Card><CardHeader><CardTitle>Instance status</CardTitle><CardDescription>Core manages this extension instance.</CardDescription></CardHeader><CardContent className="space-y-4"><Button onClick={() => void toggle()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{selected?.enabled ? 'Disable instance' : 'Enable instance'}</Button><PluginInstanceManager pluginSlug={slug} pluginName={data.name || slug} /></CardContent></Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
