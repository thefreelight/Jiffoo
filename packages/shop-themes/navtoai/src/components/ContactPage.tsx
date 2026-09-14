import React from 'react';
import { ArrowRight, BadgeCheck, CreditCard, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import type { ContactPageProps } from 'shared/src/types/theme';
import { MarketplaceFrame } from './MarketplaceFrame';
import { getNavCopy } from '../i18n';
import { getFallbackSubmissionPlans, type SubmissionPlanId } from '../lib/submission-plan';

function getSubmitPageCopy(locale?: string) {
  const copy = getNavCopy(locale);

  if (copy.locale === 'zh-Hant') {
    return {
      eyebrow: '付費提交方案',
      title: '把你的 AI 項目提交到 NavtoAI，需要付費訂閱。',
      subtitle:
        '我們用付費提交與人工審核來控制收錄品質，避免整站淪為低品質收錄牆。',
      planTag: '訂閱制',
      bestValue: '推薦方案',
      formTitle: '申請提交你的項目',
      formBody: '填寫項目資料與偏好方案，我們會在審核後與你確認上架；實際付款會交給站點既有的支付插件處理。',
      cta: '提交審核申請',
      browsePlan: '瀏覽方案商品',
      submitting: '送出中...',
      success: '申請已送出，我們會盡快與你聯絡。',
      failure: '送出失敗，請稍後再試。',
      includedTitle: '所有方案都包含',
      included: ['人工審核', '類別優化', '持續收錄', '可更新項目資料'],
      paymentNote: '付款不由主題處理，而是走站點既有的支付插件，例如 Stripe。',
      fields: {
        name: '聯絡人名稱',
        email: '聯絡信箱',
        projectName: '項目名稱',
        projectUrl: '項目網址',
        category: '主要分類',
        plan: '選擇方案',
        message: '補充說明',
      },
      plans: [
        {
          id: 'starter',
          name: 'Starter',
          price: '$29',
          period: '/月',
          description: '適合剛起步產品，收錄進搜尋結果與分類頁。',
          icon: CreditCard,
          badge: '',
          features: ['基礎收錄', '標準審核', '每月可更新一次'],
        },
        {
          id: 'pro',
          name: 'Pro',
          price: '$79',
          period: '/月',
          description: '加入首頁推薦池與更完整的品牌展示。',
          icon: Rocket,
          badge: '推薦方案',
          features: ['首頁候選曝光', '更完整簡介', '優先審核'],
        },
        {
          id: 'studio',
          name: 'Studio',
          price: '$199',
          period: '/月',
          description: '給需要專題曝光、編輯推薦與多語系展示的大型項目。',
          icon: ShieldCheck,
          badge: '',
          features: ['專題展示機會', '多語系資訊', '高優先支持'],
        },
      ],
    };
  }

  if (copy.locale === 'zh-Hans') {
    return {
      eyebrow: '付费提交方案',
      title: '把你的 AI 项目提交到 NavtoAI，需要付费订阅。',
      subtitle: '我们用付费提交和人工审核来控制收录质量，避免整站变成低质量项目墙。',
      planTag: '订阅制',
      bestValue: '推荐方案',
      formTitle: '申请提交你的项目',
      formBody: '填写项目资料和偏好方案，我们会在审核后与你确认上架；实际付款会交给站点现有的支付插件处理。',
      cta: '提交审核申请',
      browsePlan: '浏览方案商品',
      submitting: '提交中...',
      success: '申请已提交，我们会尽快联系你。',
      failure: '提交失败，请稍后再试。',
      includedTitle: '所有方案都包含',
      included: ['人工审核', '分类优化', '持续收录', '可更新项目信息'],
      paymentNote: '付款不会由主题处理，而是走站点现有的支付插件，例如 Stripe。',
      fields: {
        name: '联系人名称',
        email: '联系邮箱',
        projectName: '项目名称',
        projectUrl: '项目网址',
        category: '主要分类',
        plan: '选择方案',
        message: '补充说明',
      },
      plans: [
        {
          id: 'starter',
          name: 'Starter',
          price: '$29',
          period: '/月',
          description: '适合刚起步产品，收录进搜索结果和分类页。',
          icon: CreditCard,
          badge: '',
          features: ['基础收录', '标准审核', '每月可更新一次'],
        },
        {
          id: 'pro',
          name: 'Pro',
          price: '$79',
          period: '/月',
          description: '加入首页推荐池与更完整的品牌展示。',
          icon: Rocket,
          badge: '推荐方案',
          features: ['首页候选曝光', '更完整简介', '优先审核'],
        },
        {
          id: 'studio',
          name: 'Studio',
          price: '$199',
          period: '/月',
          description: '给需要专题曝光、编辑推荐和多语言展示的大型项目。',
          icon: ShieldCheck,
          badge: '',
          features: ['专题展示机会', '多语言信息', '高优先支持'],
        },
      ],
    };
  }

  return {
    eyebrow: 'Paid submission plans',
    title: 'Submitting your AI project to NavtoAI requires a paid subscription.',
    subtitle:
      'We use paid placement plus editorial review to keep the directory curated and worth browsing.',
    planTag: 'Subscription',
    bestValue: 'Best value',
    formTitle: 'Apply to submit your project',
    formBody:
      'Tell us about your project and preferred plan. After review, we will confirm listing details; actual payment stays with installed payment plugins.',
    cta: 'Send submission request',
    browsePlan: 'Browse plan product',
    submitting: 'Sending...',
    success: 'Request sent. We will get back to you soon.',
    failure: 'Failed to send. Please try again later.',
    includedTitle: 'Every plan includes',
    included: ['Editorial review', 'Category positioning', 'Ongoing listing coverage', 'Project profile updates'],
    paymentNote: 'Payments are not handled by the theme. They go through installed payment plugins, such as Stripe.',
    fields: {
      name: 'Contact name',
      email: 'Contact email',
      projectName: 'Project name',
      projectUrl: 'Project URL',
      category: 'Primary category',
      plan: 'Choose a plan',
      message: 'Extra context',
    },
    plans: [
      {
        id: 'starter',
        name: 'Starter',
        price: '$29',
        period: '/mo',
        description: 'For early products that need category placement and search visibility.',
        icon: CreditCard,
        badge: '',
        features: ['Base listing', 'Standard review', 'One update per month'],
      },
      {
        id: 'pro',
        name: 'Pro',
        price: '$79',
        period: '/mo',
        description: 'Adds homepage recommendation eligibility and richer brand presentation.',
        icon: Rocket,
        badge: 'Best value',
        features: ['Homepage candidate pool', 'Expanded profile', 'Priority review'],
      },
      {
        id: 'studio',
        name: 'Studio',
        price: '$199',
        period: '/mo',
        description: 'For bigger launches that need editorial features and multilingual presentation.',
        icon: ShieldCheck,
        badge: '',
        features: ['Editorial feature opportunities', 'Multilingual profile', 'Highest priority support'],
      },
    ],
  };
}

const submissionPlanAccentClass: Record<SubmissionPlanId, string> = {
  starter: 'text-[#4d63f7] bg-[#eef3ff]',
  pro: 'text-[#7b58fb] bg-[#f3edff]',
  studio: 'text-[#169d88] bg-[#e8fbf7]',
};

const submissionPlanIconMap: Record<SubmissionPlanId, React.ComponentType<{ className?: string }>> = {
  starter: CreditCard,
  pro: Rocket,
  studio: ShieldCheck,
};

export const ContactPage = React.memo(function ContactPage({ locale, config, onSubmitForm }: ContactPageProps) {
  const content = getSubmitPageCopy(locale);
  const plans = React.useMemo(() => getFallbackSubmissionPlans(locale), [locale]);
  const [status, setStatus] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    projectName: '',
    projectUrl: '',
    category: '',
    plan: 'pro',
    message: '',
  });

  const canSubmit = Boolean(
    formData.name.trim() &&
      formData.email.trim() &&
      formData.projectName.trim() &&
      formData.projectUrl.trim() &&
      formData.category.trim(),
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus(null);
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await onSubmitForm({
        name: formData.name.trim(),
        email: formData.email.trim(),
        subject: `[NavtoAI Submission] ${formData.plan.toUpperCase()} · ${formData.projectName.trim()}`,
        message: [
          `Project: ${formData.projectName.trim()}`,
          `URL: ${formData.projectUrl.trim()}`,
          `Category: ${formData.category.trim()}`,
          `Plan: ${formData.plan}`,
          '',
          formData.message.trim(),
        ]
          .filter(Boolean)
          .join('\n'),
      });
      setStatus(content.success);
      setFormData({
        name: '',
        email: '',
        projectName: '',
        projectUrl: '',
        category: '',
        plan: 'pro',
        message: '',
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : content.failure);
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigateTo = React.useCallback((href: string) => {
    if (typeof window !== 'undefined') {
      window.location.assign(href);
    }
  }, []);

  return (
    <MarketplaceFrame activeItem="resources" locale={locale} config={config}>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[linear-gradient(135deg,#091033_0%,#111640_45%,#130c33_100%)] p-6 text-white shadow-[var(--navtoai-shadow-hero)] sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/78">
                <Sparkles className="h-4 w-4 text-[#8f86ff]" />
                {content.eyebrow}
              </div>
              <h1 className="mt-5 max-w-4xl text-[clamp(2.2rem,4.6vw,4rem)] font-black leading-[0.96] tracking-[-0.06em]">
                {content.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-white/78">{content.subtitle}</p>
            </div>

            <div className="rounded-[var(--navtoai-radius-lg)] border border-white/10 bg-white/6 p-5 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                {content.includedTitle}
              </p>
              <div className="mt-4 grid gap-3">
                {content.included.map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-white/86">
                    <BadgeCheck className="h-4 w-4 text-[#8f86ff]" />
                    {item}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-white/74">{content.paymentNote}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          {plans.map((plan) => {
            const Icon = submissionPlanIconMap[plan.id];
            const isBest = Boolean(plan.badge);

            return (
              <article
                key={plan.id}
                className={[
                  'rounded-[var(--navtoai-radius-lg)] border p-5 shadow-[var(--navtoai-shadow-sm)]',
                  isBest
                    ? 'border-[color:color-mix(in_oklab,var(--navtoai-primary)_36%,white)] bg-[linear-gradient(180deg,rgba(239,237,255,0.94),white)]'
                    : 'border-[var(--navtoai-line)] bg-white',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[var(--navtoai-primary-soft)] text-[var(--navtoai-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  {plan.badge ? (
                    <span className="rounded-full bg-[var(--navtoai-primary)] px-3 py-1 text-[11px] font-semibold text-white">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 text-xl font-black tracking-[-0.04em] text-[var(--navtoai-ink)]">{plan.name}</div>
                <div className="mt-3 flex items-end gap-1">
                  <span className="text-4xl font-black tracking-[-0.06em] text-[var(--navtoai-ink)]">
                    {plan.price}
                  </span>
                  <span className="pb-1 text-sm font-semibold text-[var(--navtoai-copy-soft)]">{plan.period}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--navtoai-copy)]">{plan.description}</p>
                <div className="mt-5 grid gap-2">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-3 text-sm text-[var(--navtoai-copy)]">
                      <BadgeCheck className="h-4 w-4 text-[var(--navtoai-primary)]" />
                      {feature}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo(plan.href)}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--navtoai-primary)]"
                >
                  {content.browsePlan}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            );
          })}
        </section>

        <section className="rounded-[var(--navtoai-radius-xl)] border border-[var(--navtoai-line)] bg-[var(--navtoai-surface)] p-6 shadow-[var(--navtoai-shadow-sm)] sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--navtoai-primary-strong)]">
                {content.planTag}
              </p>
              <h2 className="mt-3 text-[clamp(1.8rem,3.5vw,3rem)] font-black leading-[1] tracking-[-0.05em] text-[var(--navtoai-ink)]">
                {content.formTitle}
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-[var(--navtoai-copy)]">{content.formBody}</p>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 rounded-[var(--navtoai-radius-lg)] bg-[var(--navtoai-bg-alt)] p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-[var(--navtoai-copy-soft)]">{content.fields.name}</span>
                  <input value={formData.name} onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-white px-4 text-sm text-[var(--navtoai-ink)] outline-none" />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-[var(--navtoai-copy-soft)]">{content.fields.email}</span>
                  <input type="email" value={formData.email} onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-white px-4 text-sm text-[var(--navtoai-ink)] outline-none" />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-[var(--navtoai-copy-soft)]">{content.fields.projectName}</span>
                  <input value={formData.projectName} onChange={(event) => setFormData((prev) => ({ ...prev, projectName: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-white px-4 text-sm text-[var(--navtoai-ink)] outline-none" />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-[var(--navtoai-copy-soft)]">{content.fields.projectUrl}</span>
                  <input value={formData.projectUrl} onChange={(event) => setFormData((prev) => ({ ...prev, projectUrl: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-white px-4 text-sm text-[var(--navtoai-ink)] outline-none" />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-[var(--navtoai-copy-soft)]">{content.fields.category}</span>
                  <input value={formData.category} onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-white px-4 text-sm text-[var(--navtoai-ink)] outline-none" />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold text-[var(--navtoai-copy-soft)]">{content.fields.plan}</span>
                  <select value={formData.plan} onChange={(event) => setFormData((prev) => ({ ...prev, plan: event.target.value }))} className="h-12 rounded-[1rem] border border-[var(--navtoai-line)] bg-white px-4 text-sm text-[var(--navtoai-ink)] outline-none">
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-xs font-semibold text-[var(--navtoai-copy-soft)]">{content.fields.message}</span>
                <textarea value={formData.message} onChange={(event) => setFormData((prev) => ({ ...prev, message: event.target.value }))} className="min-h-[140px] rounded-[1rem] border border-[var(--navtoai-line)] bg-white px-4 py-3 text-sm text-[var(--navtoai-ink)] outline-none" />
              </label>

              {submitError ? <div className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div> : null}
              {status ? <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status}</div> : null}

              <button type="submit" disabled={isSubmitting || !canSubmit} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--navtoai-primary),var(--navtoai-primary-strong))] px-6 text-sm font-semibold text-white shadow-[var(--navtoai-glow)] disabled:opacity-60">
                {isSubmitting ? content.submitting : content.cta}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>
      </div>
    </MarketplaceFrame>
  );
});
