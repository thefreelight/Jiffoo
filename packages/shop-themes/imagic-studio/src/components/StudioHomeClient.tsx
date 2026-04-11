'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clapperboard,
  Download,
  Film,
  ImagePlus,
  LoaderCircle,
  Sparkles,
  UploadCloud,
  WandSparkles,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import type { HomePageProps } from 'shared/src/types/theme';

import { imageStylePresets, samplePairs, videoStylePresets, type StudioMode } from '../site';

type SetupStatus = {
  image?: {
    ready?: boolean;
  };
  video?: {
    ready?: boolean;
    adapter?: string;
    note?: string;
  };
};

type UploadResponse = {
  data: {
    assetId: string;
    url: string;
  };
};

type ImageResult = {
  data: {
    imageUrl: string;
    styleLabel: string;
    prompt: string;
  };
};

type VideoTaskResult = {
  data: {
    taskId: string;
    status: string;
    videoUrl?: string | null;
  };
};

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Unable to read file'));
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
    reader.readAsDataURL(file);
  });
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error?.message || payload?.message || 'Request failed');
  }
  return payload as T;
}

function FilePill({
  icon,
  label,
  file,
  accept,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  file: File | null;
  accept: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-[1.6rem] border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-primary)]">
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-[color:var(--imagic-ink)]">{label}</p>
          <p className="text-xs text-[color:var(--imagic-muted)]">
            {file ? file.name : `Choose ${accept.includes('video') ? 'a short clip' : 'an image'} to continue`}
          </p>
        </div>
      </div>
      <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-[color:var(--imagic-muted)]">
        Replace
      </span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
    </label>
  );
}

export function StudioHomeClient({ config }: HomePageProps) {
  const [mode, setMode] = useState<StudioMode>('image');
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreset, setImagePreset] = useState(imageStylePresets[0].id);
  const [videoPreset, setVideoPreset] = useState(videoStylePresets[0].id);
  const [customPrompt, setCustomPrompt] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<ImageResult['data'] | null>(null);
  const [videoTask, setVideoTask] = useState<VideoTaskResult['data'] | null>(null);

  useEffect(() => {
    requestJson<{ data: SetupStatus }>('/api/extensions/plugin/imagic-core/api/api/setup-status?installation=default')
      .then((payload) => setSetupStatus(payload.data))
      .catch(() => setSetupStatus(null));
  }, []);

  useEffect(() => {
    if (!videoTask?.taskId || videoTask.status === 'completed' || videoTask.status === 'failed') {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const payload = await requestJson<VideoTaskResult>(
          `/api/extensions/plugin/imagic-core/api/api/generate/video/${encodeURIComponent(videoTask.taskId)}?installation=default`,
        );
        setVideoTask(payload.data);
        if (payload.data.status === 'completed' || payload.data.status === 'failed') {
          window.clearInterval(timer);
        }
      } catch (pollError) {
        setError(pollError instanceof Error ? pollError.message : 'Video polling failed');
        window.clearInterval(timer);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [videoTask?.taskId, videoTask?.status]);

  const imagePreviewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : ''), [imageFile]);
  const videoPreviewUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : ''), [videoFile]);

  useEffect(() => () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
  }, [imagePreviewUrl, videoPreviewUrl]);

  const headline =
    config?.site?.headline
    || 'Turn stills and short clips into painterly worlds that feel ready to publish.';
  const subheadline =
    config?.site?.subheadline
    || 'Rebuilt for imagic.art with a cleaner image pipeline, async video transformation, and a more cinematic storefront surface.';

  async function uploadAsset(file: File, kind: 'image' | 'video') {
    const dataUrl = await readFileAsDataUrl(file);
    const payload = await requestJson<UploadResponse>('/api/extensions/plugin/imagic-core/api/api/uploads?installation=default', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        kind,
        filename: file.name,
        dataUrl,
      }),
    });
    return payload.data;
  }

  async function handleGenerate() {
    setError(null);
    setWorking(true);

    try {
      if (mode === 'image') {
        if (!imageFile) {
          throw new Error('Select an image before generating.');
        }

        const uploaded = await uploadAsset(imageFile, 'image');
        const payload = await requestJson<ImageResult>('/api/extensions/plugin/imagic-core/api/api/generate/image?installation=default', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            assetId: uploaded.assetId,
            styleId: imagePreset,
            customPrompt,
          }),
        });
        setImageResult(payload.data);
      } else {
        if (!videoFile) {
          throw new Error('Select a short video before transforming.');
        }

        const uploaded = await uploadAsset(videoFile, 'video');
        const payload = await requestJson<VideoTaskResult>('/api/extensions/plugin/imagic-core/api/api/generate/video?installation=default', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            assetId: uploaded.assetId,
            styleId: videoPreset,
            customPrompt,
            duration: 5,
            resolution: '720p',
          }),
        });
        setVideoTask(payload.data);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Generation failed');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="bg-[color:var(--imagic-bg)] text-[color:var(--imagic-ink)]">
      <section className="imagic-grid imagic-noise overflow-hidden">
        <div className="mx-auto grid max-w-[1320px] gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--imagic-muted)] shadow-sm">
              <Sparkles className="h-4 w-4 text-[color:var(--imagic-warm)]" />
              {config?.site?.eyebrow || 'Creator-grade AI film lab'}
            </div>
            <h1 className="max-w-3xl text-balance text-5xl font-semibold tracking-tight text-[color:var(--imagic-ink)] sm:text-6xl lg:text-7xl">
              {headline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--imagic-muted)]">
              {subheadline}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#studio"
                className="inline-flex items-center gap-2 rounded-full bg-[color:var(--imagic-primary)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--imagic-shadow)] transition hover:-translate-y-0.5"
              >
                Start in Studio
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#samples"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-[color:var(--imagic-ink)] shadow-sm transition hover:-translate-y-0.5"
              >
                Browse Samples
              </a>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Image pass', value: 'Photo -> stylized still', icon: <ImagePlus className="h-5 w-5" /> },
                { label: 'Video pass', value: 'Clip -> illustrated reel', icon: <Film className="h-5 w-5" /> },
                { label: 'Download', value: 'Ready for social or pitch decks', icon: <Download className="h-5 w-5" /> },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 shadow-sm">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--imagic-primary-soft)] text-[color:var(--imagic-primary)]">
                    {item.icon}
                  </div>
                  <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--imagic-muted)]">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-[color:var(--imagic-ink)]">{item.value}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            id="studio"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            className="imagic-film-edge rounded-[2rem] border border-slate-200 bg-[color:var(--imagic-surface)] p-5 shadow-[var(--imagic-card-shadow)]"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--imagic-muted)]">Studio Control</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">Run the next pass</h2>
              </div>
              <div className="rounded-full bg-[color:var(--imagic-primary-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--imagic-primary)]">
                {mode === 'image' ? 'Still Frame' : 'Motion Reel'}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {([
                { id: 'image', label: 'Image Studio', icon: <WandSparkles className="h-4 w-4" /> },
                { id: 'video', label: 'Video Studio', icon: <Clapperboard className="h-4 w-4" /> },
              ] as const).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMode(item.id)}
                  className={`flex items-center justify-between rounded-[1.4rem] border px-4 py-4 text-left transition ${
                    mode === item.id
                      ? 'border-[color:var(--imagic-primary)] bg-[color:var(--imagic-primary)] text-white shadow-[var(--imagic-shadow)]'
                      : 'border-slate-200 bg-white text-[color:var(--imagic-ink)] hover:-translate-y-0.5'
                  }`}
                >
                  <span className="flex items-center gap-3 text-sm font-semibold">
                    {item.icon}
                    {item.label}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3">
              {mode === 'image' ? (
                <>
                  <FilePill icon={<UploadCloud className="h-5 w-5" />} label="Source image" file={imageFile} accept="image/*" onChange={setImageFile} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {imageStylePresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setImagePreset(preset.id)}
                        className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${
                          imagePreset === preset.id
                            ? 'border-[color:var(--imagic-primary)] bg-[color:var(--imagic-primary-soft)]'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <p className="text-sm font-semibold">{preset.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[color:var(--imagic-muted)]">{preset.caption}</p>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <FilePill icon={<Film className="h-5 w-5" />} label="Source clip" file={videoFile} accept="video/mp4,video/quicktime,video/webm" onChange={setVideoFile} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {videoStylePresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setVideoPreset(preset.id)}
                        className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${
                          videoPreset === preset.id
                            ? 'border-[color:var(--imagic-primary)] bg-[color:var(--imagic-primary-soft)]'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <p className="text-sm font-semibold">{preset.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[color:var(--imagic-muted)]">{preset.caption}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <label className="rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4">
                <p className="text-sm font-semibold">Direction note</p>
                <textarea
                  value={customPrompt}
                  onChange={(event) => setCustomPrompt(event.target.value)}
                  rows={4}
                  placeholder="Optional: keep the sky warmer, preserve camera rhythm, enrich foliage, soften contrast..."
                  className="mt-3 w-full resize-none bg-transparent text-sm text-[color:var(--imagic-ink)] outline-none placeholder:text-slate-400"
                />
              </label>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={working}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--imagic-primary)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--imagic-shadow)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {working ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                {working ? 'Processing…' : mode === 'image' ? 'Generate Image' : 'Transform Video'}
              </button>

              {error ? (
                <div className="flex items-start gap-3 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              {setupStatus?.video?.note ? (
                <div className="rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                  {setupStatus.video.note}
                </div>
              ) : null}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1320px] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-14">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--imagic-muted)]">Live result</p>
          <AnimatePresence mode="wait">
            {mode === 'image' ? (
              <motion.div key="image" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-[color:var(--imagic-surface-strong)]">
                    {imagePreviewUrl ? (
                      <div className="relative aspect-[4/5]">
                        <img src={imagePreviewUrl} alt="Source preview" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex aspect-[4/5] items-center justify-center text-sm text-[color:var(--imagic-muted)]">
                        Drop in a source image to preview the input frame.
                      </div>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-[color:var(--imagic-surface-strong)]">
                    {imageResult?.imageUrl ? (
                      <div className="relative aspect-[4/5]">
                        <img src={imageResult.imageUrl} alt="Generated result" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex aspect-[4/5] items-center justify-center text-sm text-[color:var(--imagic-muted)]">
                        The transformed frame will land here after the plugin finishes the image pass.
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {imageResult?.imageUrl ? (
                    <>
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        {imageResult.styleLabel}
                      </span>
                      <a
                        href={imageResult.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-[color:var(--imagic-ink)]"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    </>
                  ) : null}
                </div>
              </motion.div>
            ) : (
              <motion.div key="video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-[color:var(--imagic-surface-strong)]">
                    {videoPreviewUrl ? (
                      <video src={videoPreviewUrl} controls className="aspect-[4/5] h-full w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[4/5] items-center justify-center text-sm text-[color:var(--imagic-muted)]">
                        Add a short clip to preview the source reel.
                      </div>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-[color:var(--imagic-surface-strong)]">
                    {videoTask?.videoUrl ? (
                      <video src={videoTask.videoUrl} controls className="aspect-[4/5] h-full w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[4/5] flex-col items-center justify-center gap-3 text-center text-sm text-[color:var(--imagic-muted)]">
                        {videoTask?.taskId ? <LoaderCircle className="h-5 w-5 animate-spin text-[color:var(--imagic-primary)]" /> : <Film className="h-5 w-5" />}
                        <span>
                          {videoTask?.taskId
                            ? `Task ${videoTask.taskId.slice(0, 8)} is ${videoTask.status}. We keep polling until the reel is ready.`
                            : 'The transformed reel will appear here once VideoPilot finishes.'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {videoTask?.videoUrl ? (
                  <a
                    href={videoTask.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-[color:var(--imagic-ink)]"
                  >
                    <Download className="h-4 w-4" />
                    Download Reel
                  </a>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div id="samples" className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--imagic-muted)]">Sample strip</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {samplePairs.map((pair, index) => (
              <motion.div
                key={pair.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-[color:var(--imagic-surface)]"
              >
                <div className="relative aspect-[4/5]">
                  <img src={pair.after} alt={pair.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-x-3 top-3 flex items-center justify-between rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--imagic-ink)]">
                    <span>{pair.title}</span>
                    <span>after</span>
                  </div>
                </div>
                <div className="border-t border-slate-200 px-4 py-3 text-xs text-[color:var(--imagic-muted)]">
                  Prompt discipline matters more than noisy styling. Keep the semantic action stable, then restyle.
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-[1320px] px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            {
              step: '01',
              title: 'Upload a clean frame or short clip',
              body: 'Use stills for fast image restyling. Use short video clips when you need motion preserved through an async transformation task.',
            },
            {
              step: '02',
              title: 'Pick a preset, then tighten direction',
              body: 'Start from a curated style preset so the output stays predictable. Add only the extra art direction you actually need.',
            },
            {
              step: '03',
              title: 'Review, export, and publish',
              body: 'The storefront keeps the output loop short: inspect the result, download immediately, and move into promo or content production.',
            },
          ].map((item) => (
            <div key={item.step} className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--imagic-muted)]">{item.step}</p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-[color:var(--imagic-ink)]">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[color:var(--imagic-muted)]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
