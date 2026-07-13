'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Heart,
  Image as ImageIcon,
  LoaderCircle,
  Sparkles,
  Square,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { HomePageProps } from 'shared/src/types/theme';

import {
  featuredCards,
  inspirationCategories,
  mobileCategories,
  mobileQuickCards,
  recentCreations,
  templateCards,
  type CreativeCard,
} from '../site';
import { StudioMain, StudioPage } from './StudioShell';

const IMAGER_AI_STUDIO_API_BASE = '/api/extensions/plugin/imager-ai/api/api/studio';
const FALLBACK_SEED_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

const STUDIO_STYLE_OPTIONS = [
  { id: 'ghibli', label: 'Ghibli' },
  { id: 'poster-design', label: 'Poster' },
  { id: 'product-ads', label: 'Product' },
  { id: '3d-render', label: '3D render' },
  { id: 'minimalist', label: 'Minimal' },
];

const ASPECT_RATIO_OPTIONS = ['16:9', '1:1', '4:5', '3:4', '9:16'];

type PluginResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

type ImagicSetupStatus = {
  imageReady?: boolean;
  plugin?: string;
  version?: string;
  image?: {
    ready?: boolean;
    model?: string;
  };
  capabilities?: {
    imageGeneration?: boolean;
  };
};

type ImagicUploadResult = {
  assetId: string;
  imageUrl?: string;
  url?: string;
};

type ImagicImageResult = {
  imageUrl?: string;
  resultImageUrl?: string;
  taskId?: string;
  cached?: boolean;
  styleLabel?: string;
  model?: string;
};

type StudioTaskStatus = {
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  imageUrl?: string;
  resultImageUrl?: string;
  error?: string;
};

type GenerationStatus =
  | { phase: 'idle' }
  | { phase: 'info'; message: string }
  | { phase: 'working'; message: string }
  | { phase: 'success'; message: string; imageUrl: string }
  | { phase: 'error'; message: string };

function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

async function requestStudioPlugin<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  const token = getStoredAuthToken();
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${IMAGER_AI_STUDIO_API_BASE}${path}`, {
    method: options.method || 'GET',
    credentials: 'include',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = (await response.json().catch(() => null)) as PluginResponse<T> | null;

  if (!response.ok || !payload?.success) {
    const message = payload?.error?.message || `imager-ai request failed (${response.status})`;
    throw new Error(message);
  }

  return payload.data as T;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForStudioTask(taskId: string): Promise<StudioTaskStatus> {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const task = await requestStudioPlugin<StudioTaskStatus>(`/tasks/${encodeURIComponent(taskId)}`);
    if (task.status === 'completed' || task.status === 'failed') return task;
    await wait(attempt < 8 ? 1500 : 3000);
  }

  throw new Error('Generation is still running. Please check your history in a moment.');
}

function createPromptSeedImage(prompt: string): string {
  if (typeof document === 'undefined') {
    return FALLBACK_SEED_IMAGE;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (!context) {
    return FALLBACK_SEED_IMAGE;
  }

  const gradient = context.createLinearGradient(0, 0, 1024, 1024);
  gradient.addColorStop(0, '#fbfbff');
  gradient.addColorStop(0.52, '#f2efff');
  gradient.addColorStop(1, '#e9f2ff');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 1024);

  context.fillStyle = 'rgba(112, 87, 255, 0.18)';
  context.beginPath();
  context.arc(725, 288, 210, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(8, 11, 18, 0.08)';
  context.beginPath();
  context.arc(320, 710, 250, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#080b12';
  context.font = '700 54px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText('imagic.art', 92, 130);
  context.fillStyle = 'rgba(88, 96, 113, 0.78)';
  context.font = '500 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText(prompt.slice(0, 42) || 'image + magic = imagic', 92, 190);

  return canvas.toDataURL('image/png');
}

function generationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || 'Generation failed');
  if (message.includes('额度不足') || message.toLowerCase().includes('insufficient')) {
    return `Image engine quota is exhausted: ${message}`;
  }
  if (message.includes('not configured')) {
    return 'Image engine is not configured yet. Please enable and configure the official imager-ai plugin first.';
  }
  return message;
}

type StudioHomeClientProps = HomePageProps & {
  isAuthenticated?: boolean;
  onNavigateToRegister?: () => void;
};

function navigate(onNavigate: HomePageProps['onNavigate'], path: string) {
  if (typeof onNavigate === 'function') {
    onNavigate(path);
    return;
  }
  window.location.href = path;
}

function navigateToRegister(onNavigate: HomePageProps['onNavigate'], onNavigateToRegister?: () => void) {
  if (typeof onNavigateToRegister === 'function') {
    onNavigateToRegister();
    return;
  }
  navigate(onNavigate, '/auth/register');
}

function isUserAuthenticated(isAuthenticated?: boolean): boolean {
  if (typeof isAuthenticated === 'boolean') {
    return isAuthenticated;
  }
  return Boolean(getStoredAuthToken());
}

function ImageModePill({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="imagic-tool-pill is-active"
      aria-pressed="true"
      title="Image generation mode is active. Add a prompt, then press Generate."
      onClick={onClick}
    >
      <ImageIcon className="h-4 w-4" />
      <span>Image</span>
    </button>
  );
}

function SelectPill({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon?: 'ratio';
  label: string;
  value: string;
  options: Array<string | { id: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const dropdownId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => {
    const optionValue = typeof option === 'string' ? option : option.id;
    return optionValue === value;
  });
  const selectedLabel = typeof selectedOption === 'string' ? selectedOption : selectedOption?.label ?? value;
  const normalizedOptions = options.map((option) => ({
    value: typeof option === 'string' ? option : option.id,
    label: typeof option === 'string' ? option : option.label,
  }));

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={clsx('imagic-tool-dropdown', icon === 'ratio' && 'imagic-tool-dropdown--ratio', isOpen && 'is-open')}
    >
      <button
        type="button"
        className="imagic-tool-pill imagic-tool-pill--select"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={dropdownId}
        onClick={() => setIsOpen((open) => !open)}
      >
        {icon === 'ratio' ? <Square className="h-4 w-4" /> : null}
        <span className="sr-only">{label}</span>
        <span className="imagic-tool-value" aria-hidden="true">
          {selectedLabel}
        </span>
        <ChevronDown className="imagic-tool-chevron h-4 w-4" aria-hidden="true" />
      </button>
      {isOpen ? (
        <div id={dropdownId} role="listbox" aria-label={`${label} options`} className="imagic-tool-menu">
          {normalizedOptions.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                className={clsx('imagic-tool-option', selected && 'is-selected')}
                onClick={() => handleSelect(option.value)}
              >
                <span>{option.label}</span>
                {selected ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function GeneratedImagePreview({ imageUrl }: { imageUrl: string }) {
  return (
    <figure className="imagic-generated-preview">
      <img src={imageUrl} alt="Generated imagic result" loading="eager" decoding="async" />
      <figcaption>
        <span>Generated image</span>
        <a href={imageUrl} target="_blank" rel="noreferrer">
          Open full size
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </figcaption>
    </figure>
  );
}

function PromptComposer({
  prompt,
  onPromptChange,
  onGenerate,
  onImageModeClick,
  selectedStyleId,
  onStyleChange,
  selectedRatio,
  onRatioChange,
  generationStatus,
  isGenerating,
  compact = false,
}: {
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  onImageModeClick: () => void;
  selectedStyleId: string;
  onStyleChange: (value: string) => void;
  selectedRatio: string;
  onRatioChange: (value: string) => void;
  generationStatus: GenerationStatus;
  isGenerating: boolean;
  compact?: boolean;
}) {
  return (
    <div id="create" className={clsx('imagic-prompt-card', compact && 'imagic-prompt-card--mobile')}>
      <label className="imagic-prompt-label">
        <span className="sr-only">Describe what you want to create</span>
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={compact ? 3 : 1}
          placeholder="Describe what you want to create..."
          className="imagic-prompt-input"
        />
      </label>
      <div className="imagic-prompt-controls">
        <ImageModePill onClick={onImageModeClick} />
        <SelectPill
          label="Style"
          value={selectedStyleId}
          options={STUDIO_STYLE_OPTIONS}
          onChange={onStyleChange}
        />
        <SelectPill
          icon="ratio"
          label="Aspect ratio"
          value={selectedRatio}
          options={ASPECT_RATIO_OPTIONS}
          onChange={onRatioChange}
        />
        <button type="button" onClick={onGenerate} disabled={isGenerating} className="imagic-generate-button">
          <span>{isGenerating ? 'Generating...' : 'Generate'}</span>
          {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : compact ? <Sparkles className="h-5 w-5" /> : <ArrowRight className="h-4 w-4" />}
        </button>
      </div>
      {generationStatus.phase !== 'idle' ? (
        <div className="imagic-generation-output">
          <div className={clsx('imagic-generation-status', `is-${generationStatus.phase}`)} role={generationStatus.phase === 'error' ? 'alert' : 'status'}>
            {generationStatus.phase === 'info' ? <ImageIcon className="h-4 w-4" /> : null}
            {generationStatus.phase === 'working' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {generationStatus.phase === 'success' ? <CheckCircle2 className="h-4 w-4" /> : null}
            {generationStatus.phase === 'error' ? <AlertCircle className="h-4 w-4" /> : null}
            <span>{generationStatus.message}</span>
          </div>
          {generationStatus.phase === 'success' ? <GeneratedImagePreview imageUrl={generationStatus.imageUrl} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ArtCard({
  card,
  variant = 'template',
  mobile = false,
  priority = false,
}: {
  card: CreativeCard;
  variant?: 'hero' | 'stack' | 'poster' | 'template';
  mobile?: boolean;
  priority?: boolean;
}) {
  const imageProps = {
    width: 1024,
    height: 1024,
    loading: priority ? ('eager' as const) : ('lazy' as const),
    decoding: 'async' as const,
    fetchPriority: priority ? ('high' as const) : ('low' as const),
  };

  if (mobile) {
    return (
      <article className="imagic-mobile-card">
        <div className="imagic-mobile-card-image">
          <img {...imageProps} src={card.image} alt={card.title} />
        </div>
        <div className="imagic-mobile-card-overlay">
          <h3>{card.title}</h3>
          <Heart className="h-5 w-5" />
        </div>
      </article>
    );
  }

  return (
    <article className={clsx('imagic-art-card', `imagic-art-card--${variant}`)}>
      <div className="imagic-art-image">
        <img {...imageProps} src={card.image} alt={card.title} />
      </div>
      <div className="imagic-art-meta">
        <div>
          <h3>{card.title}</h3>
          {variant === 'hero' || variant === 'poster' ? null : <p>{card.subtitle}</p>}
        </div>
        <span>{card.ratio}</span>
      </div>
    </article>
  );
}

function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: string;
}) {
  return (
    <div className="imagic-section-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action ? (
        <a href="/products">
          <span>{action}</span>
          <ArrowRight className="h-4 w-4" />
        </a>
      ) : null}
    </div>
  );
}

export function StudioHomeClient({ config, onNavigate, isAuthenticated, onNavigateToRegister }: StudioHomeClientProps) {
  const [prompt, setPrompt] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedStyleId, setSelectedStyleId] = useState(STUDIO_STYLE_OPTIONS[0].id);
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIO_OPTIONS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({ phase: 'idle' });

  const defaultHeadline = 'Create visuals that bring ideas to life.';
  const defaultSubheadline = 'Design, render, and generate stunning images, posters, and marketing visuals in seconds.';
  const configuredHeadline = config?.site?.headline?.trim();
  const configuredSubheadline = config?.site?.subheadline?.trim();
  const hasLegacyCopy = /painterly worlds|cinematic|film lab|video transformation/i.test(
    `${configuredHeadline || ''} ${configuredSubheadline || ''}`,
  );
  const headline = hasLegacyCopy ? defaultHeadline : configuredHeadline || defaultHeadline;
  const subheadline = hasLegacyCopy ? defaultSubheadline : configuredSubheadline || defaultSubheadline;

  const activeCards = useMemo(() => {
    if (activeCategory === 'all') return templateCards;
    if (activeCategory === 'poster') return templateCards.filter((card) => card.id.includes('poster') || card.id.includes('banner'));
    if (activeCategory === 'product') return templateCards.filter((card) => card.id.includes('product') || card.id.includes('brand'));
    if (activeCategory === 'ui') return templateCards.filter((card) => card.id.includes('ui'));
    return templateCards;
  }, [activeCategory]);

  async function handleGenerate() {
    if (!isUserAuthenticated(isAuthenticated)) {
      navigateToRegister(onNavigate, onNavigateToRegister);
      return;
    }

    const currentPrompt = prompt.trim();
    if (!currentPrompt) {
      const starterPrompt = 'Create a polished visual campaign with soft light, premium composition, and imagic.art clarity.';
      setPrompt(starterPrompt);
      setGenerationStatus({ phase: 'working', message: 'Starter prompt added. Press Generate again to render it.' });
      return;
    }

    setIsGenerating(true);
    setGenerationStatus({ phase: 'working', message: 'Checking the imagic image engine...' });

    try {
      const setup = await requestStudioPlugin<ImagicSetupStatus>('/setup-status');
      const imageReady = setup?.imageReady ?? setup?.image?.ready ?? setup?.capabilities?.imageGeneration;
      if (!imageReady) {
        throw new Error('Image runtime is not configured');
      }

      setGenerationStatus({ phase: 'working', message: `Rendering with ${setup.image?.model || setup.plugin || 'imager-ai'}...` });
      const upload = await requestStudioPlugin<ImagicUploadResult>('/uploads', {
        method: 'POST',
        body: {
          kind: 'image',
          filename: 'imagic-prompt-seed.png',
          dataUrl: createPromptSeedImage(currentPrompt),
        },
      });

      const result = await requestStudioPlugin<ImagicImageResult>('/generate/image', {
        method: 'POST',
        body: {
          assetId: upload.assetId,
          styleId: selectedStyleId,
          aspectRatio: selectedRatio,
          customPrompt: currentPrompt,
        },
      });

      let imageUrl = result.imageUrl || result.resultImageUrl;
      if (!imageUrl && result.taskId) {
        setGenerationStatus({ phase: 'working', message: 'Image queued. Waiting for the render...' });
        const task = await waitForStudioTask(result.taskId);
        if (task.status === 'failed') {
          throw new Error(task.error || 'Generation failed');
        }
        imageUrl = task.imageUrl || task.resultImageUrl;
      }

      if (!imageUrl) {
        throw new Error('Generation finished without an image URL');
      }

      setGenerationStatus({
        phase: 'success',
        message: `Image ready${result.styleLabel ? ` · ${result.styleLabel}` : ''}.`,
        imageUrl,
      });
    } catch (error) {
      setGenerationStatus({ phase: 'error', message: generationErrorMessage(error) });
    } finally {
      setIsGenerating(false);
    }
  }

  function handleImageModeClick() {
    if (!isUserAuthenticated(isAuthenticated)) {
      navigateToRegister(onNavigate, onNavigateToRegister);
      return;
    }

    setGenerationStatus({
      phase: 'info',
      message: 'Image mode is active. Describe what you want, choose a style or ratio, then press Generate.',
    });
  }

  return (
    <StudioPage activeNav="home">
      <StudioMain>
        <section className="imagic-desktop-hero" aria-label="AI image studio hero">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="imagic-hero-copy"
          >
            <p className="imagic-eyebrow">AI Image Platform</p>
            <h1 className="imagic-hero-title">
              {headline === defaultHeadline ? (
                <>
                  Create visuals
                  <br />
                  <span className="imagic-hero-title-line">
                    that bring ideas to <em>life.</em>
                  </span>
                </>
              ) : (
                headline
              )}
            </h1>
            <p className="imagic-hero-subtitle">{subheadline}</p>
            <p className="imagic-slogan">image + magic = imagic</p>
            <PromptComposer
              prompt={prompt}
              onPromptChange={setPrompt}
              onGenerate={handleGenerate}
              onImageModeClick={handleImageModeClick}
              selectedStyleId={selectedStyleId}
              onStyleChange={setSelectedStyleId}
              selectedRatio={selectedRatio}
              onRatioChange={setSelectedRatio}
              generationStatus={generationStatus}
              isGenerating={isGenerating}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.56, ease: 'easeOut', delay: 0.08 }}
            className="imagic-hero-gallery"
          >
            <ArtCard card={featuredCards[0]} variant="hero" priority />
            <div className="imagic-hero-stack">
              <ArtCard card={featuredCards[1]} variant="stack" />
              <ArtCard card={featuredCards[2]} variant="stack" />
            </div>
            <ArtCard card={featuredCards[3]} variant="poster" />
          </motion.div>
        </section>

        <section className="imagic-mobile-hero" aria-label="Mobile AI image studio hero">
          <h1>Create</h1>
          <p>Turn ideas into visuals.</p>
          <span>image + magic = imagic</span>
          <PromptComposer
            prompt={prompt}
            onPromptChange={setPrompt}
            onGenerate={handleGenerate}
            onImageModeClick={handleImageModeClick}
            selectedStyleId={selectedStyleId}
            onStyleChange={setSelectedStyleId}
            selectedRatio={selectedRatio}
            onRatioChange={setSelectedRatio}
            generationStatus={generationStatus}
            isGenerating={isGenerating}
            compact
          />
        </section>

        <section className="imagic-template-section" aria-label="Templates and quick inspiration">
          <div className="imagic-template-heading--mobile">
            <SectionHeading title="Quick inspiration" subtitle="Swipe through starter looks." />
          </div>
          <div className="imagic-template-heading--desktop">
            <SectionHeading title="Start with a template" subtitle="Beautiful templates to get you started." action="View all templates" />
          </div>

          <div className="imagic-mobile-chips">
            {mobileCategories.map((category, index) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={clsx('imagic-mobile-chip', (index === 0 || activeCategory === category.id) && 'is-active')}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="imagic-template-filters">
            {inspirationCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                className={clsx(activeCategory === category.id && 'is-active')}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="imagic-mobile-grid">
            {mobileQuickCards.map((card) => (
              <ArtCard key={card.id} card={card} mobile />
            ))}
          </div>

          <div className="imagic-template-grid">
            {activeCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => {
                  setPrompt(`Generate a ${card.title.toLowerCase()} with crisp composition and premium imagic.art polish.`);
                  if (ASPECT_RATIO_OPTIONS.includes(card.ratio)) {
                    setSelectedRatio(card.ratio);
                  }
                  navigate(onNavigate, '/#create');
                }}
                className="imagic-template-card"
              >
                <div className="imagic-template-image">
                  <img
                    src={card.image}
                    alt={card.title}
                    width={1024}
                    height={1024}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                  />
                </div>
                <h3>{card.title}</h3>
                <p>{card.subtitle}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="imagic-recent-section" aria-label="Recent creations">
          <SectionHeading title="Recent creations" subtitle="Your latest generated images." action="View all" />
          <div className="imagic-recent-grid">
            {recentCreations.map((item) => (
              <article key={item.id} className="imagic-recent-card">
                <img
                  src={item.image}
                  alt={item.title}
                  width={1024}
                  height={1024}
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                />
              </article>
            ))}
          </div>
        </section>
      </StudioMain>
    </StudioPage>
  );
}
