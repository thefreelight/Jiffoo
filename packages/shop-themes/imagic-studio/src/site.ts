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
