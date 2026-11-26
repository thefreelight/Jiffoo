import React from 'react';
import { Volume2 } from 'lucide-react';
import type { ThemeConfig } from 'shared/src/types/theme';
import { pickCopy, resolveBokmooSiteConfig } from '../site';

type FilmState = 'poster' | 'loading' | 'playing' | 'sound';

/** Plays when the browser lets it; otherwise the band falls back to the poster and the button. */
function attempt(video: HTMLVideoElement, refused: () => void): void {
  let playing: Promise<void> | undefined;
  try {
    playing = typeof video.play === 'function' ? video.play() : undefined;
  } catch {
    refused();
    return;
  }
  if (playing && typeof playing.catch === 'function') playing.catch(refused);
}

/**
 * The brand film on the home page. Nothing is fetched until the band comes near the viewport: the poster
 * is a lazy image and the video only gets its source then. It plays muted and loops — the one autoplay
 * every browser allows — and "Watch with sound" swaps in the version with the narration. A visitor who
 * asked for less motion or less data gets the poster and the button, and no autoplay.
 */
export const PromoFilm = React.memo(function PromoFilm({ locale, config }: { locale?: string; config?: ThemeConfig }) {
  const film = resolveBokmooSiteConfig(config, locale).promoFilm;
  const t = (copy: { en: string; hans?: string; hant?: string; ja?: string; ko?: string; fr?: string; de?: string }) => pickCopy(locale, copy);
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [state, setState] = React.useState<FilmState>('poster');
  // An instance that has no copy of the film in its bucket shows no band at all
  const [missing, setMissing] = React.useState(false);

  // Near the viewport: hand the video its source
  React.useEffect(() => {
    const frame = frameRef.current;
    if (!film || !frame) return;
    let cancelled = false;
    const arm = () => {
      if (!cancelled) setState('loading');
    };
    if (typeof IntersectionObserver === 'undefined') {
      arm();
      return () => {
        cancelled = true;
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        arm();
      },
      { rootMargin: '280px' },
    );
    observer.observe(frame);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [film]);

  // With the source set, start — unless the visitor asked for less motion or less data
  React.useEffect(() => {
    const video = videoRef.current;
    if (!film || !video || state !== 'loading') return;
    const narrow = window.matchMedia?.('(max-width: 768px)').matches ?? false;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    video.src = narrow ? film.mutedSmall : film.muted;
    video.load();
    if (reducedMotion || saveData) {
      setState('poster');
      return;
    }
    // A refused autoplay (or a browser without play()) leaves the poster and the button
    attempt(video, () => setState('poster'));
  }, [film, state]);

  if (!film || missing) return null;

  const watchWithSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.src = film.sound;
    setState('sound');
    video.load();
    attempt(video, () => setState('poster'));
  };

  return (
    <section className="bokmoo-film" data-purpose="promo-film" data-state={state} aria-labelledby="bokmoo-promo-film-heading">
      <h2 className="bokmoo-film-heading" id="bokmoo-promo-film-heading">
        {t({ en: 'Watch the BOKMOO film', hans: '观看 BOKMOO 宣传片', hant: '觀看 BOKMOO 宣傳片', ja: 'BOKMOO の紹介動画を見る', ko: 'BOKMOO 소개 영상 보기', fr: 'Voir le film BOKMOO', de: 'Den BOKMOO-Film ansehen' })}
      </h2>
      <div className="bokmoo-film-frame" ref={frameRef}>
        <video
          ref={videoRef}
          className="bokmoo-film-video"
          loop={state !== 'sound'}
          muted={state !== 'sound'}
          controls={state === 'sound'}
          playsInline
          preload="none"
          aria-label={t({
            en: 'BOKMOO — One Card, One World. A 50-second film with captions.',
            hans: 'BOKMOO——一张卡，连世界。50 秒宣传片，带字幕。',
            hant: 'BOKMOO——一張卡，連世界。50 秒宣傳片，帶字幕。',
            ja: 'BOKMOO — 一枚のカードで、世界をつなぐ。字幕付きの 50 秒の紹介動画。',
            ko: 'BOKMOO — 하나의 카드, 하나의 세계. 자막이 있는 50초 영상.',
            fr: 'BOKMOO — Une carte, un monde. Un film de 50 secondes, sous-titré.',
            de: 'BOKMOO — Eine Karte, eine Welt. Ein 50-Sekunden-Film mit Untertiteln.',
          })}
          onPlaying={() => setState((current) => (current === 'loading' ? 'playing' : current))}
          onError={() => setState('poster')}
        />
        <img
          className="bokmoo-film-poster"
          src={film.poster}
          srcSet={film.posterLarge ? `${film.poster} 1280w, ${film.posterLarge} 1920w` : undefined}
          sizes="(min-width: 1152px) 1104px, (min-width: 640px) calc(100vw - 3rem), calc(100vw - 2rem)"
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setMissing(true)}
        />
        {state === 'sound' ? null : (
          <button className="bokmoo-film-sound" type="button" onClick={watchWithSound}>
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            <span>{t({ en: 'Watch with sound', hans: '带声音观看', hant: '帶聲音觀看', ja: '音声ありで見る', ko: '소리 켜서 보기', fr: 'Voir avec le son', de: 'Mit Ton ansehen' })}</span>
          </button>
        )}
      </div>
    </section>
  );
});
