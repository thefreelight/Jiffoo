export type StudioMode = 'image' | 'video';

export const imageStylePresets = [
  {
    id: 'ghibli',
    label: 'Ghibli Light',
    caption: 'Soft painterly light, warm skies, and storybook foliage.',
  },
  {
    id: 'storybook',
    label: 'Storybook Poster',
    caption: 'Editorial poster polish with richer atmosphere and color depth.',
  },
  {
    id: 'watercolor',
    label: 'Watercolor Wash',
    caption: 'Paper texture, soft edges, and lighter pigment diffusion.',
  },
  {
    id: 'anime',
    label: 'Anime Scene',
    caption: 'Clean outlines, cel shading, and stronger cinematic contrast.',
  },
];

export const videoStylePresets = [
  {
    id: 'ghibli_motion',
    label: 'Ghibli Motion',
    caption: 'Short clips reinterpreted as gentle hand-painted animated scenes.',
  },
  {
    id: 'filmic_story',
    label: 'Filmic Story',
    caption: 'Painterly motion with steadier color rhythm and a more editorial finish.',
  },
];

export const samplePairs = [
  {
    title: 'Portrait Scene',
    before: 'https://ik.imagekit.io/q5bzu71h1/example/emily-lau-unsplash.jpg',
    after: 'https://ik.imagekit.io/q5bzu71h1/example/emily-lau-unsplash-ghibli.jpg',
  },
  {
    title: 'Mountain Walk',
    before: 'https://ik.imagekit.io/q5bzu71h1/example/1536_1024/20250330-130218.png',
    after: 'https://ik.imagekit.io/q5bzu71h1/example/1536_1024/20250330-130205.png',
  },
  {
    title: 'City Window',
    before: 'https://ik.imagekit.io/q5bzu71h1/example/1024_1024/20250330-130211.png',
    after: 'https://ik.imagekit.io/q5bzu71h1/example/1024_1024/20250330-130423.png',
  },
];

// ── Studio home showcase data ────────────────────────────────────────────────
// Restores the exports StudioHomeClient imports; imagery reuses the imagic.art
// example assets above. Placeholder demo content — swap freely.

export interface CreativeCard {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  ratio: string;
}

const EXAMPLE_IMAGES = {
  portrait: 'https://ik.imagekit.io/q5bzu71h1/example/emily-lau-unsplash-ghibli.jpg',
  mountain: 'https://ik.imagekit.io/q5bzu71h1/example/1536_1024/20250330-130205.png',
  city: 'https://ik.imagekit.io/q5bzu71h1/example/1024_1024/20250330-130423.png',
  cityAlt: 'https://ik.imagekit.io/q5bzu71h1/example/1024_1024/20250330-130211.png',
} as const;

export const featuredCards: CreativeCard[] = [
  { id: 'featured-portrait', title: 'Portrait Reverie', subtitle: 'Ghibli-style portrait pass', image: EXAMPLE_IMAGES.portrait, ratio: '3:4' },
  { id: 'featured-mountain', title: 'Mountain Walk', subtitle: 'Scenic wide render', image: EXAMPLE_IMAGES.mountain, ratio: '16:9' },
  { id: 'featured-city', title: 'City Window', subtitle: 'Urban light study', image: EXAMPLE_IMAGES.city, ratio: '1:1' },
  { id: 'featured-poster', title: 'Evening Poster', subtitle: 'Poster-ready composition', image: EXAMPLE_IMAGES.cityAlt, ratio: '4:5' },
];

export const templateCards: CreativeCard[] = [
  { id: 'template-poster-evening', title: 'Evening Poster', subtitle: 'Cinematic poster layout', image: EXAMPLE_IMAGES.cityAlt, ratio: '4:5' },
  { id: 'template-banner-skyline', title: 'Skyline Banner', subtitle: 'Wide hero banner', image: EXAMPLE_IMAGES.mountain, ratio: '16:9' },
  { id: 'template-product-still', title: 'Product Still', subtitle: 'Clean product shot', image: EXAMPLE_IMAGES.city, ratio: '1:1' },
  { id: 'template-brand-portrait', title: 'Brand Portrait', subtitle: 'Stylized brand visual', image: EXAMPLE_IMAGES.portrait, ratio: '3:4' },
  { id: 'template-ui-mock', title: 'UI Scene Mock', subtitle: 'Interface showcase frame', image: EXAMPLE_IMAGES.city, ratio: '1:1' },
];

export const inspirationCategories = [
  { id: 'all', label: 'All' },
  { id: 'poster', label: 'Posters' },
  { id: 'product', label: 'Product' },
  { id: 'ui', label: 'UI scenes' },
] as const;

export const mobileCategories = inspirationCategories;

export const mobileQuickCards: CreativeCard[] = featuredCards.slice(0, 3);

export const recentCreations = [
  { id: 'recent-portrait', title: 'Portrait Reverie', image: EXAMPLE_IMAGES.portrait },
  { id: 'recent-mountain', title: 'Mountain Walk', image: EXAMPLE_IMAGES.mountain },
  { id: 'recent-city', title: 'City Window', image: EXAMPLE_IMAGES.city },
];
