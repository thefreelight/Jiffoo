'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react';
import { useManagedMode } from '@/lib/managed-mode';

function getSetupHref(href?: string | null, surface?: string | null): string | null {
  if (href) {
    return href;
  }

  switch (surface) {
    case 'settings':
      return '/settings';
    case 'themes':
      return '/themes';
    case 'plugins':
      return '/plugins';
    case 'dashboard':
      return '/package';
    default:
      return null;
  }
}

export function ManagedLicensePanel() {
  const { record, isManaged, isSuspended, activatePackage, isLoading } = useManagedMode();
  const [code, setCode] = useState('');

  const handleActivate = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) {
      toast.error('Enter an activation code');
      return;
    }

    try {
      await activatePackage(code);
      setCode('');
    } catch {
      // Error toast is handled by the activation hook.
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-5 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Commercial package
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-900">
              {isManaged && record ? record.displaySolutionName : 'Activate a managed deployment'}
            </h4>
            <Badge
              variant="outline"
              className={isManaged
                ? isSuspended
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600'}
            >
              {isManaged ? (isSuspended ? 'Suspended' : 'Managed') : 'Optional'}
            </Badge>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-gray-600">
            {isManaged && record
              ? 'This store is running a licensed package. Marketplace pricing stays hidden and only the approved assets remain surfaced across themes and plugins.'
              : 'If this store is part of a managed commercial rollout, enter the activation code from Super Admin here. Standard self-hosted deployments can ignore this section.'}
          </p>
        </div>

        {isManaged && record ? (
          <div className="grid gap-3 text-sm text-gray-600 md:min-w-[320px] md:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Brand</p>
              <p className="mt-1 font-medium text-gray-900">{record.displayBrandName}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Included assets</p>
              <p className="mt-1 font-medium text-gray-900">
                {record.includedThemes.length} themes · {record.includedPlugins.length} plugins
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {!isManaged ? (
        <form onSubmit={handleActivate} className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            placeholder="Activation code from Super Admin"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="h-11 rounded-xl border-gray-100 bg-white md:max-w-md"
          />
          <Button
            type="submit"
            disabled={isLoading}
            className="h-11 rounded-xl bg-blue-600 px-5 font-semibold hover:bg-blue-700"
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {isLoading ? 'Activating…' : 'Activate package'}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm text-gray-600 md:flex-row md:items-center md:justify-between">
          <span>
            Theme and plugin changes stay limited to the package assigned from Super Admin.
          </span>
          {record?.supportEmail ? (
            <span className="font-medium text-gray-900">Support: {record.supportEmail}</span>
          ) : null}
        </div>
      )}

      {isManaged && record?.offerKind === 'theme_first_solution' && record.setupSteps.length > 0 ? (
        <div className="rounded-2xl border border-blue-100 bg-white p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">
              Solution Setup
            </p>
            <h5 className="text-sm font-semibold text-gray-900">
              Finish the guided setup for {record.displaySolutionName}
            </h5>
            <p className="text-sm leading-6 text-gray-600">
              This package is sold like a theme, but it ships additional runtime capability. Complete the steps below to move from activation into a sellable starter state.
            </p>
          </div>

          <div className="space-y-3">
            {record.setupSteps.map((step, index) => {
              const targetHref = getSetupHref(step.href, step.surface);
              const isExternal = Boolean(targetHref && /^https?:\/\//.test(targetHref));

              return (
                <div key={step.id} className="rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                          Step {index + 1}
                        </Badge>
                        <span className="text-sm font-semibold text-gray-900">{step.title}</span>
                      </div>
                      {step.description ? (
                        <p className="text-sm leading-6 text-gray-600">{step.description}</p>
                      ) : null}
                    </div>

                    {targetHref ? (
                      <Button asChild variant="outline" className="rounded-xl">
                        <Link href={targetHref} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined}>
                          {step.ctaLabel || 'Open'}
                          {isExternal ? <ExternalLink className="ml-2 h-4 w-4" /> : <ArrowRight className="ml-2 h-4 w-4" />}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
