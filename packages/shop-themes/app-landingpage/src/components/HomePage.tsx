import React from 'react';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  CircleUserRound,
  Compass,
  Download,
  Fingerprint,
  Globe2,
  HardDriveDownload,
  List,
  LockKeyhole,
  Minus,
  PackageCheck,
  Plus,
  QrCode,
  ScanLine,
  Search,
  ShieldCheck,
  Signal,
  ShoppingBag,
  Smartphone,
  Usb,
  Wifi,
} from 'lucide-react';
import { FEATURED_PLANS, POPULAR_DESTINATIONS, RECENTLY_VIEWED } from '../lib/plan-display';
import type { HomePageProps } from '../types';

const popularSearches = ['Japan', 'Europe', 'South Korea', 'United States', 'Thailand'];
const defaultEasyEuiccDownloadUrl = 'https://easyeuicc.cc/downloads/EasyEUICC-v1.6.2.apk';
const defaultEasyEuiccQrUrl = '/easyeuicc-download-qr.png';
const defaultEasyEuiccScreenshotUrl = '/easyeuicc-real-empty.png';

export const HomePage = React.memo(function HomePage({ config, onNavigate }: HomePageProps) {
  const brandName = config?.brand?.name?.trim() || 'EASYEUICC';
  const headline = config?.site?.headline || 'Download EasyEUICC';
  const subheadline =
    config?.site?.subheadline ||
    'A focused Android eUICC manager for installing, switching, and maintaining your eSIM profiles.';
  const navigate = (path: string) => onNavigate?.(path);
  const isExplicitAppDownload = config?.site?.archetype === 'app-download';
  const isAppDownload = isExplicitAppDownload || brandName.toLowerCase() === 'easyeuicc';
  const appSite = isExplicitAppDownload ? config?.site : undefined;

  if (isAppDownload) {
    return (
      <AppDownloadHome
        brandName={brandName}
        headline={appSite?.headline || 'Download EasyEUICC'}
        subheadline={
          appSite?.subheadline ||
          'A focused Android eUICC manager for installing, switching, and maintaining your eSIM profiles.'
        }
        primaryLabel={appSite?.primaryCtaLabel || 'Download APK'}
        downloadUrl={appSite?.androidDownloadUrl || defaultEasyEuiccDownloadUrl}
        appVersion={appSite?.appVersion || 'v1.6.2-unpriv'}
        checksum={appSite?.downloadChecksum}
        qrUrl={appSite?.downloadQrUrl || defaultEasyEuiccQrUrl}
        screenshotUrl={appSite?.appScreenshotUrl || defaultEasyEuiccScreenshotUrl}
      />
    );
  }

  return (
    <main className="esim-shell min-h-screen overflow-hidden">
      <DesktopHome
        brandName={brandName}
        headline={headline}
        subheadline={subheadline}
        onNavigate={navigate}
      />
      <MobileExplore brandName={brandName} onNavigate={navigate} />
    </main>
  );
});

function AppDownloadHome({
  brandName,
  headline,
  subheadline,
  primaryLabel,
  downloadUrl,
  appVersion,
  checksum,
  qrUrl,
  screenshotUrl,
}: {
  brandName: string;
  headline: string;
  subheadline: string;
  primaryLabel: string;
  downloadUrl: string;
  appVersion: string;
  checksum?: string;
  qrUrl?: string;
  screenshotUrl: string;
}) {
  const localEasyEuiccQrUrl = '/extensions/themes/shop/app-landingpage/assets/app/easyeuicc-download-qr.png';
  const qrImageUrl =
    qrUrl ||
    (downloadUrl.includes('easyeuicc.cc/downloads/EasyEUICC-v1.6.2.apk')
      ? localEasyEuiccQrUrl
      : `https://quickchart.io/qr?size=180&margin=1&text=${encodeURIComponent(downloadUrl)}`);
  const shortChecksum = checksum ? `${checksum.slice(0, 14)}...${checksum.slice(-10)}` : 'SHA-256 verified package';

  return (
    <main className="min-h-screen bg-[#f5f8fc] text-[#101827]">
      <section className="px-5 pb-16 pt-8 md:px-8 md:pb-20 md:pt-[126px]">
        <div className="mx-auto max-w-[1220px]">
          <div className="flex items-center justify-between md:hidden">
            <a href="/" className="flex items-center gap-3 text-lg font-black text-[#1156d9]" aria-label={`${brandName} home`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#176bff] text-white">E</span>
              {brandName}
            </a>
            <a href={downloadUrl} className="rounded-full bg-[#101827] px-4 py-2 text-sm font-black text-white">
              下载
            </a>
          </div>

          <div className="grid items-center gap-10 pt-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 md:pt-0">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#cfe0ff] bg-white px-3.5 py-2 text-sm font-black text-[#1156d9] shadow-sm">
                <ShieldCheck className="h-4 w-4" />
                EasyEUICC for Android · {appVersion}
              </div>
              <h1 className="mt-7 max-w-[620px] text-[44px] font-black leading-[1.02] text-[#101827] sm:text-[58px] lg:text-[74px]">
                {headline}
              </h1>
              <p className="mt-6 max-w-[560px] text-lg font-semibold leading-8 text-[#475569] sm:text-xl">
                {subheadline}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={downloadUrl}
                  className="inline-flex min-h-[56px] items-center justify-center gap-3 rounded-[16px] bg-[#176bff] px-6 text-base font-black text-white shadow-[0_18px_42px_rgb(23_107_255_/_0.24)] transition hover:bg-[#0b4edb]"
                >
                  <Download className="h-5 w-5" />
                  {primaryLabel}
                </a>
              </div>

              <div className="mt-6 grid gap-3 text-sm font-bold text-[#475569] sm:grid-cols-3">
                <span className="flex items-center gap-2">
                  <LockKeyhole className="h-4 w-4 text-[#176bff]" />
                  无广告
                </span>
                <span className="flex items-center gap-2">
                  <Usb className="h-4 w-4 text-[#176bff]" />
                  eUICC 管理
                </span>
                <span className="flex items-center gap-2">
                  <HardDriveDownload className="h-4 w-4 text-[#176bff]" />
                  APK 直装
                </span>
              </div>

              <div id="download" className="mt-8 flex flex-col gap-4 rounded-[20px] border border-[#dbe7f7] bg-white p-4 shadow-[0_22px_60px_rgb(15_23_42_/_0.07)] sm:flex-row sm:items-center">
                <div className="flex h-[132px] w-[132px] shrink-0 items-center justify-center rounded-[16px] border border-[#e2e8f0] bg-white">
                  <img src={qrImageUrl} alt={`${brandName} download QR code`} className="h-[112px] w-[112px]" />
                </div>
                <div>
                  <p className="text-base font-black text-[#101827]">扫码或点击下载最新 APK</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#64748b]">
                    当前版本 {appVersion}。Android 9+ 推荐使用，下载后请核对签名与校验信息。
                  </p>
                  <p className="mt-3 rounded-full bg-[#f1f5f9] px-3 py-2 text-xs font-bold text-[#334155]">
                    {shortChecksum}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative mt-2 min-h-0 sm:min-h-[520px] lg:min-h-[700px]">
              <div className="absolute left-2 top-8 hidden h-[82%] w-[88%] rounded-[40px] border border-[#dbe7f7] bg-white shadow-[0_36px_90px_rgb(15_23_42_/_0.08)] lg:block" />
              <div className="relative mx-auto grid max-w-[620px] grid-cols-1 items-end gap-5 sm:grid-cols-[0.88fr_1fr]">
                <AppPhonePreview screenshotUrl={screenshotUrl} />
                <div className="mb-10 hidden rounded-[30px] border border-[#dbe7f7] bg-white p-5 shadow-[0_28px_70px_rgb(15_23_42_/_0.10)] sm:block">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-[#101827]">Profile tools</p>
                    <span className="rounded-full bg-[#e8f1ff] px-3 py-1 text-xs font-black text-[#1156d9]">Ready</span>
                  </div>
                  <div className="mt-5 grid gap-3">
                    <AppToolRow icon={ScanLine} title="Scan activation code" meta="Camera and manual entry" />
                    <AppToolRow icon={Signal} title="Switch active profile" meta="Fast profile control" />
                    <AppToolRow icon={Fingerprint} title="Local profile storage" meta="Device-first management" />
                  </div>
                  <div className="mt-6 rounded-[20px] bg-[#101827] p-4 text-white">
                    <p className="text-xs font-bold text-white/62">Latest package</p>
                    <p className="mt-1 text-lg font-black">{appVersion}</p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/12">
                      <div className="h-full w-[72%] rounded-full bg-[#5eead4]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section id="features" className="mt-8 grid gap-4 md:mt-14 md:grid-cols-4">
            {[
              ['配置文件管理', '查看、启用和维护设备内的 eSIM profile。'],
              ['扫码添加', '通过二维码或手动信息快速写入激活数据。'],
              ['本地优先', '核心管理动作在设备侧完成，减少不必要依赖。'],
              ['本地可控', '关键操作在设备端完成，减少外部依赖。'],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-[18px] border border-[#dbe7f7] bg-white p-5 shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-[#176bff]" />
                <h2 className="mt-4 text-base font-black text-[#101827]">{title}</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#64748b]">{copy}</p>
              </div>
            ))}
          </section>

          <section id="security" className="mt-6 rounded-[28px] border border-[#dbe7f7] bg-[#101827] p-6 text-white md:mt-10 md:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
              <div>
                <p className="text-sm font-black text-[#93c5fd]">安全下载</p>
                <h2 className="mt-3 text-3xl font-black leading-tight md:text-4xl">只提供已确认的最新 Android 安装包。</h2>
              </div>
              <div className="grid gap-3 text-sm font-semibold text-white/74 md:grid-cols-3">
                <span className="rounded-[18px] bg-white/8 p-4">版本号：{appVersion}</span>
                <span className="rounded-[18px] bg-white/8 p-4">包名：im.angry.easyeuicc</span>
                <span className="rounded-[18px] bg-white/8 p-4">Target SDK：35</span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function AppPhonePreview({ screenshotUrl }: { screenshotUrl: string }) {
  return (
    <div className="mx-auto w-full max-w-[286px] rounded-[38px] border-[10px] border-[#101827] bg-[#101827] shadow-[0_34px_90px_rgb(15_23_42_/_0.24)]">
      <div className="overflow-hidden rounded-[27px] bg-[#f2f2f2]">
        <img
          src={screenshotUrl}
          alt="EasyEUICC Android app screen"
          className="aspect-[9/19.5] w-full object-cover object-top"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = '/easyeuicc-real-empty.png';
          }}
        />
      </div>
    </div>
  );
}

function AppToolRow({ icon: Icon, title, meta }: { icon: React.ComponentType<{ className?: string }>; title: string; meta: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-[#e2e8f0] bg-[#f8fbff] p-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#e8f1ff] text-[#1156d9]">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-sm font-black text-[#101827]">{title}</span>
        <span className="block text-xs font-semibold text-[#64748b]">{meta}</span>
      </span>
    </div>
  );
}

function DesktopHome({
  brandName,
  headline,
  subheadline,
  onNavigate,
}: {
  brandName: string;
  headline: string;
  subheadline: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="hidden md:block">
      <section className="px-7 pb-16 pt-[122px]">
        <div className="mx-auto max-w-[1380px] rounded-[28px] border border-[var(--esim-line)] bg-white px-16 pb-14 pt-14 shadow-[0_30px_90px_rgb(15_23_42_/_0.08)]">
          <div className="grid min-h-[330px] items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="esim-kicker">Web — Home</p>
              <h1 className="mt-7 max-w-[560px] text-[72px] font-black leading-[0.98] tracking-[-0.035em] text-[var(--esim-ink)] xl:text-[84px]">
                {headline}
              </h1>
              <p className="mt-6 max-w-[420px] text-xl font-medium leading-8 text-[var(--esim-muted)]">
                {subheadline}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-8 text-sm font-semibold text-[var(--esim-ink-soft)]">
                <Benefit icon={PackageCheck} label="Instant QR delivery" />
                <Benefit icon={Globe2} label="190+ countries" />
                <Benefit icon={Wifi} label="24/7 support" />
              </div>
            </div>

            <div className="relative min-h-[360px] overflow-hidden rounded-[32px] bg-[linear-gradient(180deg,#ffffff_0%,#f7faff_100%)]">
              <WorldMap />
            </div>
          </div>

          <SearchPanel onNavigate={onNavigate} />

          <section className="mt-12">
            <SectionHeader title="Popular destinations" action="View all destinations" onAction={() => onNavigate('/products')} />
            <div className="mt-5 grid gap-5 lg:grid-cols-4">
              {POPULAR_DESTINATIONS.map((destination) => (
                <button
                  key={destination.title}
                  type="button"
                  onClick={() => onNavigate('/products')}
                  className="group overflow-hidden rounded-[13px] border border-[var(--esim-line)] bg-white text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgb(15_23_42_/_0.09)]"
                >
                  <img
                    src={destination.image}
                    alt={destination.title}
                    className="h-[145px] w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="flex items-end justify-between px-4 py-4">
                    <div>
                      <h3 className="text-base font-black tracking-[-0.03em] text-[var(--esim-ink)]">{destination.title}</h3>
                      <p className="mt-1 text-xs font-semibold text-[var(--esim-muted)]">{destination.country}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold text-[var(--esim-muted)]">From</p>
                      <p className="text-sm font-black text-[var(--esim-primary)]">{destination.priceLabel}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-9">
            <SectionHeader title="Featured plans" action="View all plans" onAction={() => onNavigate('/products')} />
            <div className="mt-5 grid gap-5 lg:grid-cols-4">
              {FEATURED_PLANS.map((plan) => (
                <button
                  key={plan.title}
                  type="button"
                  onClick={() => onNavigate('/products')}
                  className="group rounded-[13px] border border-[var(--esim-line)] bg-white p-4 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgb(15_23_42_/_0.09)]"
                >
                  <span className="rounded-full border border-[var(--esim-primary)]/20 bg-[var(--esim-primary-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.04em] text-[var(--esim-primary-dark)]">
                    {plan.badge}
                  </span>
                  <h3 className="mt-3 text-base font-black tracking-[-0.03em] text-[var(--esim-ink)]">{plan.title}</h3>
                  <p className="mt-1 text-xs font-semibold text-[var(--esim-muted)]">
                    {plan.data} • {plan.validity}
                  </p>
                  <p className="mt-3 text-lg font-black text-[var(--esim-primary)]">{plan.priceLabel}</p>
                  <div className="mt-4 grid gap-2 text-xs font-semibold text-[var(--esim-muted)]">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--esim-ink-soft)]" />
                      {plan.network}
                    </span>
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--esim-ink-soft)]" />
                      Instant QR delivery
                    </span>
                  </div>
                  <ArrowRight className="ml-auto mt-4 h-4 w-4 text-[var(--esim-ink)] transition group-hover:translate-x-1 group-hover:text-[var(--esim-primary)]" />
                </button>
              ))}
            </div>
          </section>

          <TrustStrip brandName={brandName} />
        </div>
      </section>
    </div>
  );
}

function SearchPanel({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="mt-10 rounded-[18px] border border-[var(--esim-line)] bg-white p-7 shadow-[0_24px_74px_rgb(15_23_42_/_0.08)]">
      <div className="grid items-end gap-5 lg:grid-cols-[1.45fr_0.75fr_0.75fr_0.62fr_0.82fr]">
        <label>
          <span className="text-[11px] font-bold text-[var(--esim-ink-soft)]">Where do you need data?</span>
          <div className="mt-2 flex h-[48px] items-center gap-3 rounded-[13px] border border-[var(--esim-line)] px-4">
            <Search className="h-4 w-4 text-[var(--esim-muted)]" />
            <input className="w-full border-0 bg-transparent p-0 text-sm font-semibold outline-none ring-0 placeholder:text-[var(--esim-muted)] focus:border-transparent focus:ring-0" placeholder="Search a destination" />
          </div>
        </label>
        <CompactSelect label="Data" value="Any amount" />
        <CompactSelect label="Duration" value="Any duration" />
        <label>
          <span className="text-[11px] font-bold text-[var(--esim-ink-soft)]">Travelers</span>
          <div className="mt-2 flex h-[48px] items-center justify-between rounded-[13px] border border-[var(--esim-line)] px-4 text-sm font-bold">
            <Minus className="h-4 w-4 text-[var(--esim-muted)]" />
            1
            <Plus className="h-4 w-4 text-[var(--esim-muted)]" />
          </div>
        </label>
        <button
          type="button"
          onClick={() => onNavigate('/products')}
          className="h-[54px] rounded-[13px] bg-[var(--esim-primary)] text-sm font-black text-white shadow-[0_16px_32px_rgb(23_107_255_/_0.24)] transition hover:bg-[var(--esim-primary-dark)]"
        >
          Find plans
        </button>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-[var(--esim-muted)]">Popular searches:</span>
        {popularSearches.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onNavigate('/products')}
            className="rounded-full border border-[var(--esim-line)] bg-white px-4 py-2 text-xs font-bold text-[var(--esim-ink-soft)] transition hover:border-[var(--esim-primary)] hover:text-[var(--esim-primary)]"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function CompactSelect({ label, value }: { label: string; value: string }) {
  return (
    <label>
      <span className="text-[11px] font-bold text-[var(--esim-ink-soft)]">{label}</span>
      <select className="mt-2 h-[48px] w-full rounded-[13px] border border-[var(--esim-line)] bg-white px-4 text-sm font-semibold text-[var(--esim-ink)] outline-none">
        <option>{value}</option>
      </select>
    </label>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <h2 className="text-[22px] font-black tracking-[-0.04em] text-[var(--esim-ink)]">{title}</h2>
      <button type="button" onClick={onAction} className="flex items-center gap-2 text-sm font-black text-[var(--esim-primary)]">
        {action}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function TrustStrip({ brandName }: { brandName: string }) {
  return (
    <div className="mt-10 grid rounded-[24px] border border-[var(--esim-line)] bg-[linear-gradient(180deg,#ffffff,#f8fbff)] text-sm font-semibold text-[var(--esim-muted)] lg:grid-cols-3">
      <div className="flex items-center justify-center gap-3 px-6 py-5">
        <span className="text-lg text-[var(--esim-success)]">★</span>
        <span>
          <strong className="text-[var(--esim-ink)]">Trusted by travelers</strong> worldwide
        </span>
      </div>
      <div className="flex items-center justify-center gap-3 border-y border-[var(--esim-line)] px-6 py-5 lg:border-x lg:border-y-0">
        <ShieldCheck className="h-5 w-5 text-[var(--esim-ink-soft)]" />
        Secure payments
      </div>
      <div className="flex items-center justify-center gap-3 px-6 py-5">
        <Globe2 className="h-5 w-5 text-[var(--esim-ink-soft)]" />
        Your data is protected by {brandName}
      </div>
    </div>
  );
}

function MobileExplore({ brandName, onNavigate }: { brandName: string; onNavigate: (path: string) => void }) {
  const featured = POPULAR_DESTINATIONS[0];
  return (
    <div className="block min-h-screen bg-white px-5 pb-24 pt-5 md:hidden">
      <div className="mx-auto max-w-[430px]">
        <div className="mb-6 flex items-center justify-between text-[var(--esim-ink)]">
          <span className="text-[15px] font-black">9:41</span>
          <div className="h-7 w-[116px] rounded-full bg-black" />
          <div className="flex items-center gap-1.5 text-[11px] font-black">
            <span>●●●</span>
            <Wifi className="h-4 w-4" />
            <span className="h-3 w-6 rounded-[4px] border border-black/60" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button type="button" onClick={() => onNavigate('/')} className="text-[30px] font-black tracking-[-0.08em] text-[var(--esim-primary-dark)]">
            {brandName}
          </button>
          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--esim-line)]">
            <Bell className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-8 text-xs font-bold uppercase tracking-[0.12em] text-[var(--esim-muted)]">Mobile — Explore</p>
        <h1 className="mt-3 text-[38px] font-black tracking-[-0.06em] text-[var(--esim-ink)]">Explore</h1>
        <p className="mt-2 text-base font-medium text-[var(--esim-muted)]">Where are you landing?</p>

        <label className="mt-5 flex h-[52px] items-center gap-3 rounded-[15px] border border-[var(--esim-line)] bg-white px-4 shadow-sm">
          <Search className="h-5 w-5 text-[var(--esim-muted)]" />
          <input className="w-full border-0 bg-transparent p-0 text-sm font-semibold outline-none ring-0 placeholder:text-[var(--esim-muted)] focus:border-transparent focus:ring-0" placeholder="Search destinations" />
        </label>

        <div className="mt-4 flex gap-3">
          {['Popular', 'Nearby', 'All regions'].map((item, index) => (
            <button
              key={item}
              type="button"
              className={`rounded-full border px-5 py-2 text-xs font-bold ${index === 0 ? 'border-[var(--esim-primary)] bg-[var(--esim-primary-soft)] text-[var(--esim-primary-dark)]' : 'border-[var(--esim-line)] text-[var(--esim-muted)]'}`}
            >
              {item}
            </button>
          ))}
        </div>

        <h2 className="mt-7 text-base font-black text-[var(--esim-ink)]">Featured plan</h2>
        <button
          type="button"
          onClick={() => onNavigate('/products')}
          className="mt-3 grid w-full grid-cols-[112px_1fr] gap-4 rounded-[18px] border border-[var(--esim-line)] bg-white p-3 text-left shadow-[0_18px_42px_rgb(15_23_42_/_0.08)]"
        >
          <img src={featured.image} alt={featured.title} className="h-[132px] w-[112px] rounded-[13px] object-cover" />
          <div className="py-1">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xl font-black tracking-[-0.05em] text-[var(--esim-ink)]">{featured.title}</h3>
                <p className="mt-1 text-sm font-semibold text-[var(--esim-ink-soft)]">
                  {featured.data} • {featured.validity}
                </p>
              </div>
              <span className="rounded-full bg-red-50 px-2 py-1 text-[9px] font-black uppercase text-red-700">Best seller</span>
            </div>
            <div className="mt-4 grid gap-2 text-xs font-semibold text-[var(--esim-muted)]">
              <span className="flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-[var(--esim-ink-soft)]" />
                High speed data
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--esim-ink-soft)]" />
                Instant QR delivery
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-lg font-black text-[var(--esim-primary)]">{featured.priceLabel}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--esim-primary)] text-white shadow-[0_12px_24px_rgb(23_107_255_/_0.25)]">
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </button>

        <div className="mt-7 flex items-center justify-between">
          <h2 className="text-base font-black text-[var(--esim-ink)]">Popular destinations</h2>
        </div>
        <div className="mt-3 overflow-hidden rounded-[18px] border border-[var(--esim-line)] bg-white">
          {FEATURED_PLANS.slice(0, 3).map((plan) => (
            <button
              key={plan.title}
              type="button"
              onClick={() => onNavigate('/products')}
              className="flex w-full items-center gap-3 border-b border-[var(--esim-line)] p-3 text-left last:border-b-0"
            >
              <img src={plan.image} alt={plan.title} className="h-[58px] w-[58px] rounded-[12px] object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-[var(--esim-ink)]">{plan.title}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--esim-muted)]">From {plan.priceLabel}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--esim-muted)]" />
            </button>
          ))}
        </div>

        <div className="mt-7 flex items-center justify-between">
          <h2 className="text-base font-black text-[var(--esim-ink)]">Recently viewed</h2>
          <button type="button" onClick={() => onNavigate('/products')} className="text-xs font-black text-[var(--esim-primary)]">
            See all
          </button>
        </div>
        <div className="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-2">
          {RECENTLY_VIEWED.map((plan) => (
            <button
              key={plan.title}
              type="button"
              onClick={() => onNavigate('/products')}
              className="min-w-[116px] overflow-hidden rounded-[13px] border border-[var(--esim-line)] bg-white text-left shadow-sm"
            >
              <img src={plan.image} alt={plan.title} className="h-[68px] w-full object-cover" />
              <div className="p-2">
                <p className="truncate text-sm font-black text-[var(--esim-ink)]">{plan.title}</p>
                <p className="truncate text-xs font-semibold text-[var(--esim-muted)]">{plan.country}</p>
              </div>
            </button>
          ))}
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--esim-line)] bg-white/92 px-6 pb-5 pt-3 backdrop-blur-xl">
          <div className="mx-auto grid max-w-[430px] grid-cols-4 text-[11px] font-bold">
            <MobileNavItem active icon={Compass} label="Explore" />
            <MobileNavItem icon={ShoppingBag} label="My eSIMs" />
            <MobileNavItem icon={CircleUserRound} label="Profile" />
            <MobileNavItem icon={List} label="More" />
          </div>
          <div className="mx-auto mt-3 h-1 w-[134px] rounded-full bg-black" />
        </nav>
      </div>
    </div>
  );
}

function MobileNavItem({ icon: Icon, label, active = false }: { icon: React.ComponentType<{ className?: string }>; label: string; active?: boolean }) {
  return (
    <button type="button" className={`flex flex-col items-center gap-1 ${active ? 'text-[var(--esim-primary)]' : 'text-[var(--esim-ink-soft)]'}`}>
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

function Benefit({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="h-5 w-5 text-[var(--esim-primary)]" />
      {label}
    </span>
  );
}

function WorldMap() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 760 360" fill="none" aria-hidden="true">
      <defs>
        <pattern id="yevbi-dots" x="0" y="0" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="1.4" cy="1.4" r="1.15" fill="#CBD5E1" opacity="0.74" />
        </pattern>
        <clipPath id="yevbi-map-a">
          <path d="M95 105C146 68 234 63 292 96C323 114 335 148 310 173C282 202 218 189 184 226C150 263 89 247 68 203C48 161 61 130 95 105Z" />
        </clipPath>
        <clipPath id="yevbi-map-b">
          <path d="M329 98C390 45 502 60 556 114C606 164 555 206 600 246C628 271 689 258 711 288C650 322 566 312 512 273C463 239 483 181 433 160C390 143 348 141 329 98Z" />
        </clipPath>
        <clipPath id="yevbi-map-c">
          <path d="M264 235C311 206 365 206 403 238C432 263 421 309 377 322C334 335 275 299 264 235Z" />
        </clipPath>
      </defs>
      <rect x="64" y="34" width="642" height="292" rx="34" fill="#F8FAFC" />
      <rect x="64" y="34" width="642" height="292" rx="34" stroke="#E2E8F0" />
      <g clipPath="url(#yevbi-map-a)">
        <rect x="44" y="54" width="300" height="218" fill="url(#yevbi-dots)" />
      </g>
      <g clipPath="url(#yevbi-map-b)">
        <rect x="314" y="40" width="420" height="300" fill="url(#yevbi-dots)" />
      </g>
      <g clipPath="url(#yevbi-map-c)">
        <rect x="246" y="198" width="200" height="140" fill="url(#yevbi-dots)" />
      </g>
      <path d="M154 140C232 78 330 82 421 144C489 190 555 177 634 108" stroke="#176BFF" strokeWidth="1.7" opacity="0.38" />
      <path d="M234 167C328 132 440 142 520 237" stroke="#176BFF" strokeWidth="1.7" opacity="0.32" />
      <path d="M421 144C389 187 389 222 424 252" stroke="#176BFF" strokeWidth="1.7" opacity="0.26" />
      {[
        [154, 140],
        [310, 119],
        [421, 144],
        [519, 237],
        [634, 108],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill="#176BFF" />
      ))}
    </svg>
  );
}

export default HomePage;
