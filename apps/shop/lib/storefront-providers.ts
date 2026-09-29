export type ProviderIds = {
  ga4MeasurementId: string | null;
  metaPixelId: string | null;
  baiduSiteKey: string | null;
};
export type Provider = 'ga4' | 'meta' | 'baidu';
export type ProviderLibraryOverrides = Partial<Record<Provider, string>>;
export type ProviderInit = {
  provider: Provider;
  url: string;
  commands: unknown[][];
};

export function providerInitPlan(
  ids: ProviderIds, overrides: ProviderLibraryOverrides = {}, now = new Date(),
): ProviderInit[] {
  const plan: ProviderInit[] = [];
  if (ids.ga4MeasurementId) plan.push({
    provider: 'ga4',
    url: overrides.ga4 ?? `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids.ga4MeasurementId)}`,
    commands: [['js', now], ['config', ids.ga4MeasurementId]],
  });
  if (ids.metaPixelId) plan.push({
    provider: 'meta',
    url: overrides.meta ?? 'https://connect.facebook.net/en_US/fbevents.js',
    commands: [['init', ids.metaPixelId], ['track', 'PageView']],
  });
  if (ids.baiduSiteKey) plan.push({
    provider: 'baidu',
    url: overrides.baidu ?? `https://hm.baidu.com/hm.js?${encodeURIComponent(ids.baiduSiteKey)}`,
    commands: [],
  });
  return plan;
}

type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
};
type ProviderWindow = Window & {
  dataLayer?: IArguments[];
  gtag?: (...args: unknown[]) => void;
  fbq?: Fbq;
  _fbq?: Fbq;
  _hmt?: unknown[][];
};

export function initializeProviders(ids: ProviderIds, overrides: ProviderLibraryOverrides) {
  const target = window as ProviderWindow;
  for (const step of providerInitPlan(ids, overrides)) {
    if (step.provider === 'ga4') {
      target.dataLayer = target.dataLayer || [];
      // GA4's standard queue stores Arguments objects, not rest arrays.
      // eslint-disable-next-line prefer-rest-params
      target.gtag = function () { target.dataLayer!.push(arguments); };
      for (const command of step.commands) target.gtag(...command);
    } else if (step.provider === 'meta') {
      if (!target.fbq) {
        const fbq = function (...args: unknown[]) {
          if (fbq.callMethod) fbq.callMethod(...args);
          else fbq.queue.push(args);
        } as Fbq;
        fbq.push = fbq;
        fbq.loaded = true;
        fbq.version = '2.0';
        fbq.queue = [];
        target.fbq = fbq;
        target._fbq = target._fbq || fbq;
      }
      for (const command of step.commands) target.fbq(...command);
    } else {
      target._hmt = target._hmt || [];
    }
    const script = document.createElement('script');
    script.async = true;
    script.src = step.url;
    document.head.appendChild(script);
  }
}
