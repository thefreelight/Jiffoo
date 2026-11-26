import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThemeConfig } from 'shared/src/types/theme';
import { HomePage } from '@shop-themes/bokmoo/src/components/HomePage';
import { PromoFilm } from '@shop-themes/bokmoo/src/components/PromoFilm';
import { resolveBokmooSiteConfig } from '@shop-themes/bokmoo/src/site';

// The brand film sits on the home page between the hero and the app section. The owner's concern is slow
// networks: nothing may download until the band comes near the viewport, phones get the smaller file,
// and only a click loads the version with the narration.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const themeRoot = path.resolve(__dirname, '../../../../packages/shop-themes/bokmoo');
const FILM = '/extensions/media/promo/v3';

type IntersectionCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
let nearObservers: IntersectionCallback[] = [];
/** Every video the browser was asked to play. */
let played: HTMLMediaElement[] = [];

beforeEach(() => {
  nearObservers = [];
  played = [];
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private callback: IntersectionCallback) {
      nearObservers.push(callback);
    }
    observe() {}
    unobserve() {}
    disconnect() {
      nearObservers = nearObservers.filter((callback) => callback !== this.callback);
    }
  });
  const matching = new Set<string>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matching.has(query),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }));
  Object.defineProperty(navigator, 'connection', { value: { saveData: false }, configurable: true });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    played.push(this);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const askFor = (query: string) => vi.stubGlobal('matchMedia', (asked: string) => ({
  matches: asked === query,
  media: asked,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
}));

/** The band scrolls towards the viewport. */
const comeNear = async () => {
  await act(async () => {
    for (const callback of [...nearObservers]) callback([{ isIntersecting: true }]);
  });
};

const band = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-purpose="promo-film"]');
const videoOf = (container: HTMLElement) => band(container)?.querySelector('video') ?? null;
const posterOf = (container: HTMLElement) => band(container)?.querySelector('img') ?? null;
const buttonOf = (container: HTMLElement) => band(container)?.querySelector('button') ?? null;

describe('where the film sits', () => {
  it('is the band between the hero and the app section', () => {
    const { container } = render(<HomePage locale="en" />);

    const film = band(container);
    expect(film, 'the home page carries the film band').toBeTruthy();
    expect(film?.previousElementSibling?.querySelector('.sim-metallic-body'), 'the hero comes first').toBeTruthy();
    expect(film?.nextElementSibling?.id).toBe('products');
  });
});

describe('what downloads', () => {
  it('is nothing until the band comes near the viewport: a lazy poster and a video without a source', () => {
    const { container } = render(<PromoFilm locale="en" />);

    const video = videoOf(container);
    const poster = posterOf(container);
    expect(video?.getAttribute('src')).toBeNull();
    expect(video?.getAttribute('preload')).toBe('none');
    expect(poster?.getAttribute('loading')).toBe('lazy');
    expect(poster?.getAttribute('src')).toBe(`${FILM}/bokmoo-promo-poster-1280.jpg`);
    expect(poster?.getAttribute('srcset')).toContain(`${FILM}/bokmoo-promo-poster-1920.jpg 1920w`);
    expect(played).toHaveLength(0);
    expect(band(container)?.dataset.state).toBe('poster');
  });

  it('is the muted desktop loop, played at once, once the band is near', async () => {
    const { container } = render(<PromoFilm locale="en" />);

    await comeNear();

    const video = videoOf(container);
    expect(video?.getAttribute('src')).toBe(`${FILM}/bokmoo-promo-720p-muted.mp4`);
    expect(played).toEqual([video]);
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.hasAttribute('controls')).toBe(false);
    expect(band(container)?.dataset.state).toBe('loading');
  });

  it('is the smaller muted loop on a phone', async () => {
    askFor('(max-width: 768px)');
    const { container } = render(<PromoFilm locale="en" />);

    await comeNear();

    expect(videoOf(container)?.getAttribute('src')).toBe(`${FILM}/bokmoo-promo-540p-muted.mp4`);
  });

  it('is only the file: the poster steps aside when the film is playing', async () => {
    const { container } = render(<PromoFilm locale="en" />);
    await comeNear();

    await act(async () => {
      videoOf(container)?.dispatchEvent(new Event('playing'));
    });

    expect(band(container)?.dataset.state).toBe('playing');
    expect(posterOf(container)).toBeTruthy();
  });
});

describe('who gets autoplay', () => {
  it('not a visitor who asked for less motion: poster and button, the film waits', async () => {
    askFor('(prefers-reduced-motion: reduce)');
    const { container } = render(<PromoFilm locale="en" />);

    await comeNear();

    expect(played).toHaveLength(0);
    expect(band(container)?.dataset.state).toBe('poster');
    expect(buttonOf(container)?.textContent).toBe('Watch with sound');
    expect(videoOf(container)?.getAttribute('src'), 'no source, so no file is fetched').toBeNull();
  });

  it('not a visitor who asked to save data', async () => {
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
    const { container } = render(<PromoFilm locale="en" />);

    await comeNear();

    expect(played).toHaveLength(0);
    expect(band(container)?.dataset.state).toBe('poster');
    expect(videoOf(container)?.getAttribute('src'), 'no source, so no file is fetched').toBeNull();
  });

  it('nobody when the browser refuses: the band goes back to the poster', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.reject(new Error('NotAllowedError')));
    const { container } = render(<PromoFilm locale="en" />);

    await comeNear();

    expect(band(container)?.dataset.state).toBe('poster');
    expect(buttonOf(container)).toBeTruthy();
  });
});

describe('watch with sound', () => {
  it('swaps in the narrated film, with sound, controls and no loop', async () => {
    const { container } = render(<PromoFilm locale="en" />);
    await comeNear();

    await act(async () => {
      fireEvent.click(buttonOf(container)!);
    });

    const video = videoOf(container);
    expect(video?.getAttribute('src')).toBe(`${FILM}/bokmoo-promo-720p.mp4`);
    expect(video?.muted).toBe(false);
    expect(video?.loop).toBe(false);
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(played.at(-1)).toBe(video);
    expect(band(container)?.dataset.state).toBe('sound');
    expect(buttonOf(container), 'the native controls take over').toBeNull();
  });
});

describe('an instance without a copy of the film', () => {
  it('shows no band when the poster is not there', async () => {
    const { container } = render(<PromoFilm locale="en" />);

    await act(async () => {
      fireEvent.error(posterOf(container)!);
    });

    expect(band(container)).toBeNull();
  });
});

describe('a page that keeps re-rendering', () => {
  // The store hands the theme a new config object on every render. Taking that for a new film made the
  // band give the video its source again and again: each reload cut off the one before, so on the live
  // store the film never buffered enough to start.
  it('hands the video its source once, and plays it once', async () => {
    let rerender = () => undefined as void;
    const Host = () => {
      const [, update] = React.useState(0);
      rerender = () => update((count) => count + 1);
      return <PromoFilm locale="en" config={{ site: {} } as unknown as ThemeConfig} />;
    };
    const { container } = render(<Host />);

    await comeNear();
    for (let render_ = 0; render_ < 5; render_ += 1) {
      await act(async () => {
        rerender();
      });
    }

    expect(videoOf(container)?.getAttribute('src')).toBe(`${FILM}/bokmoo-promo-720p-muted.mp4`);
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
    expect(played).toHaveLength(1);
  });
});

describe('the settings', () => {
  const site = (values: Record<string, string>) => ({ site: values }) as unknown as ThemeConfig;

  it('carry the defaults when nothing is set', () => {
    expect(resolveBokmooSiteConfig(undefined, 'en').promoFilm).toEqual({
      poster: `${FILM}/bokmoo-promo-poster-1280.jpg`,
      posterLarge: `${FILM}/bokmoo-promo-poster-1920.jpg`,
      muted: `${FILM}/bokmoo-promo-720p-muted.mp4`,
      mutedSmall: `${FILM}/bokmoo-promo-540p-muted.mp4`,
      sound: `${FILM}/bokmoo-promo-720p.mp4`,
    });
  });

  it('let the owner point at another cut, or turn the film off', () => {
    const own = resolveBokmooSiteConfig(site({ promoPoster: 'https://cdn.example/film.jpg', promoSoundVideo: 'https://cdn.example/film.mp4' }), 'en').promoFilm;
    expect(own).toMatchObject({ poster: 'https://cdn.example/film.jpg', posterLarge: 'https://cdn.example/film.jpg', muted: `${FILM}/bokmoo-promo-720p-muted.mp4`, sound: 'https://cdn.example/film.mp4' });

    expect(resolveBokmooSiteConfig(site({ promoPoster: ' none ' }), 'en').promoFilm).toBeNull();
    const { container } = render(<PromoFilm locale="en" config={site({ promoPoster: 'none' })} />);
    expect(band(container)).toBeNull();
  });

  it('are offered by the settings schema, with the same defaults', () => {
    const schema = JSON.parse(readFileSync(path.join(themeRoot, 'theme-pack/schemas/settings.schema.json'), 'utf8'));
    const properties = schema.properties.site.properties;
    expect(properties.promoPoster.default).toBe(`${FILM}/bokmoo-promo-poster-1280.jpg`);
    expect(properties.promoMutedVideo.default).toBe(`${FILM}/bokmoo-promo-720p-muted.mp4`);
    expect(properties.promoMutedVideoSmall.default).toBe(`${FILM}/bokmoo-promo-540p-muted.mp4`);
    expect(properties.promoSoundVideo.default).toBe(`${FILM}/bokmoo-promo-720p.mp4`);
  });
});

describe('the words on the band', () => {
  it('speak the seven storefront languages', () => {
    const expected: Record<string, string> = {
      en: 'Watch with sound', 'zh-Hans': '带声音观看', 'zh-Hant': '帶聲音觀看', ja: '音声ありで見る', ko: '소리 켜서 보기', fr: 'Voir avec le son', de: 'Mit Ton ansehen',
    };
    const englishName = 'BOKMOO — One Card, One World. A 50-second film with captions.';
    for (const [locale, label] of Object.entries(expected)) {
      const { container, unmount } = render(<PromoFilm locale={locale} />);
      expect(buttonOf(container)?.textContent, locale).toBe(label);
      expect(band(container)?.querySelector('h2')?.textContent, `${locale} heading for screen readers`).toBeTruthy();
      const name = videoOf(container)?.getAttribute('aria-label');
      if (locale === 'en') expect(name).toBe(englishName);
      else expect(name, `${locale} film name`).not.toBe(englishName);
      unmount();
    }
  });
});

describe('the band’s stylesheet', () => {
  const start = '/* >>> Promo film';
  const end = '/* <<< Promo film end */\n';
  const block = (file: string) => {
    const source = readFileSync(path.join(themeRoot, file), 'utf8');
    const at = source.indexOf(start);
    const until = source.indexOf(end, at);
    return source.slice(at, until + end.length);
  };

  it('is the same block in both stylesheets', () => {
    expect(block('src/tokens.css')).toBe(block('theme-pack/tokens.css'));
  });

  it('styles every class the band uses', () => {
    const component = readFileSync(path.join(themeRoot, 'src/components/PromoFilm.tsx'), 'utf8');
    const css = block('src/tokens.css');
    const classes = new Set([...component.matchAll(/\bbokmoo-film[a-z-]*\b/g)].map((match) => match[0]));
    expect(classes.size).toBeGreaterThan(4);
    for (const className of classes) {
      expect(css, className).toContain(`.${className}`);
    }
    // no rule is declared twice
    const selectors = [...css.matchAll(/^(\.[^{]+?)[\s{]/gm)].map((match) => match[1].replace(/\s+/g, ' '));
    expect(new Set(selectors).size).toBe(selectors.length);
  });
});
