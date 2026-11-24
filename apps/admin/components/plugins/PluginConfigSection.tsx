'use client';

/**
 * Schema-driven settings form for a plugin instance. It is a plain section of
 * the workspace: edits land in the shared config draft and are persisted by
 * the single Save button in the page header.
 */

import type { ReactNode } from 'react';
import { Settings2 } from 'lucide-react';
import { useLocale } from 'shared/src/i18n/react';
import {
  localizePluginConfigDescription,
  localizePluginConfigOption,
} from '@/lib/extension-catalog-zh';
import type { PluginConfigMeta } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  getDescriptorType,
  getConfigFieldLabel,
  type PluginConfigSchema,
} from '@/components/plugins/plugin-config-utils';
import {
  WorkspaceCard,
  WorkspaceField,
  WorkspaceToggleRow,
  workspaceInputClass,
  workspaceSelectTriggerClass,
} from '@/components/plugins/plugin-workspace-ui';
import { useWorkspaceText } from '@/components/plugins/use-workspace-text';

export function PluginConfigSection(props: {
  slug: string;
  configSchema: PluginConfigSchema;
  configDraft: Record<string, unknown>;
  configMeta?: PluginConfigMeta;
  jsonFieldDrafts: Record<string, string>;
  jsonFieldErrors: Record<string, string>;
  onUpdateField: (field: string, value: unknown) => void;
  onUpdateJsonField: (field: string, rawValue: string, expectedType: 'object' | 'array') => void;
  title?: string;
  description?: string;
  icon?: ReactNode;
}) {
  const {
    slug,
    configSchema,
    configDraft,
    configMeta,
    jsonFieldDrafts,
    jsonFieldErrors,
    onUpdateField,
    onUpdateJsonField,
    title,
    description,
    icon,
  } = props;
  const locale = useLocale();
  const tf = useWorkspaceText();
  const secretStoredHint = tf(
    'secretStoredHint',
    'A secure value is already stored. Enter a new value only if you want to replace it.',
  );
  const secretStoredPlaceholder = tf('secretStoredPlaceholder', 'Stored securely. Leave blank to keep the current value');

  return (
    <WorkspaceCard
      icon={icon ?? <Settings2 className="h-6 w-6" />}
      title={title ?? tf('configTitle', 'Plugin settings')}
      description={description ?? tf('configDescription', 'Click Save changes in the top-right corner to apply your edits.')}
    >
      <div className="grid gap-6 md:grid-cols-2">
        {Object.entries(configSchema).map(([field, descriptor]) => {
          const type = getDescriptorType(descriptor);
          const label = getConfigFieldLabel(slug, locale, field, descriptor);
          const fieldHint = descriptor?.description
            ? localizePluginConfigDescription(slug, field, descriptor.description, locale)
            : undefined;
          const required = Boolean(descriptor?.required);
          const value = configDraft[field];
          const secretConfigured = Boolean(configMeta?.secretFields?.[field]?.configured);
          const id = `${slug}-${field}`;

          if (Array.isArray(descriptor?.enum) && descriptor.enum.length > 0) {
            const normalizedValue =
              typeof value === 'string' && descriptor.enum.includes(value) ? value : descriptor.enum[0];

            return (
              <WorkspaceField key={field} label={label} htmlFor={id} required={required} hint={fieldHint}>
                <Select value={normalizedValue} onValueChange={(nextValue) => onUpdateField(field, nextValue)}>
                  <SelectTrigger id={id} className={workspaceSelectTriggerClass}>
                    <SelectValue placeholder={label} />
                  </SelectTrigger>
                  <SelectContent>
                    {descriptor.enum.map((option) => (
                      <SelectItem key={option} value={option}>
                        {localizePluginConfigOption(slug, field, option, locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </WorkspaceField>
            );
          }

          if (type === 'boolean') {
            return (
              <WorkspaceToggleRow
                key={field}
                id={id}
                label={label}
                description={fieldHint}
                checked={Boolean(value)}
                onCheckedChange={(checked) => onUpdateField(field, checked)}
              />
            );
          }

          if (type === 'object' || type === 'array') {
            return (
              <WorkspaceField
                key={field}
                label={label}
                htmlFor={id}
                required={required}
                hint={fieldHint}
                error={jsonFieldErrors[field]}
                className="md:col-span-2"
              >
                <Textarea
                  id={id}
                  value={jsonFieldDrafts[field] ?? JSON.stringify(value ?? (type === 'array' ? [] : {}), null, 2)}
                  onChange={(event) => onUpdateJsonField(field, event.target.value, type)}
                  className="min-h-[180px] rounded-xl border-gray-100 bg-white font-mono text-xs"
                  spellCheck={false}
                />
              </WorkspaceField>
            );
          }

          if (type === 'number' || type === 'integer') {
            return (
              <WorkspaceField key={field} label={label} htmlFor={id} required={required} hint={fieldHint}>
                <Input
                  id={id}
                  type="number"
                  value={typeof value === 'number' || value === '' ? value : ''}
                  onChange={(event) => onUpdateField(field, event.target.value === '' ? '' : Number(event.target.value))}
                  className={workspaceInputClass}
                />
              </WorkspaceField>
            );
          }

          const isSecret = type === 'secret';

          return (
              <WorkspaceField
                key={field}
                label={label}
                htmlFor={id}
                required={required}
                // A stored secret already explains itself through its placeholder; keep the field's own hint.
                hint={fieldHint ?? (isSecret && secretConfigured ? secretStoredHint : undefined)}
              >
              <Input
                id={id}
                type={isSecret ? 'password' : 'text'}
                value={value == null ? '' : String(value)}
                onChange={(event) => onUpdateField(field, event.target.value)}
                placeholder={isSecret && secretConfigured ? secretStoredPlaceholder : descriptor?.placeholder}
                autoComplete="off"
                spellCheck={false}
                className={cn(workspaceInputClass, isSecret && secretConfigured && 'bg-gray-50/50')}
              />
            </WorkspaceField>
          );
        })}
      </div>
    </WorkspaceCard>
  );
}
