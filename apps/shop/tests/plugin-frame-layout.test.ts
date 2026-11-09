// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { availableFrameHeight, frameViewportHeight } from '../../../packages/shared/src/plugin-pages/frame-layout';

it('returns usable viewport space while keeping the existing frame bounds', () => {
  expect(availableFrameHeight(900, 120)).toBe(756);
  expect(availableFrameHeight(500, 400)).toBe(240);
  expect(availableFrameHeight(5000, 0)).toBe(2000);
  expect(availableFrameHeight(800, -120)).toBe(776);
  expect(availableFrameHeight(800.9, 100.1)).toBe(676);
});

it('accounts for host padding and prior scroll without creating an outer overflow loop', () => {
  const main=document.createElement('main'),wrapper=document.createElement('div'),frame=document.createElement('iframe');
  main.style.overflowY='auto';wrapper.style.paddingBottom='32px';main.append(wrapper);wrapper.append(frame);document.body.append(main);main.scrollTop=15;
  vi.spyOn(main,'getBoundingClientRect').mockReturnValue({bottom:900} as DOMRect);
  vi.spyOn(frame,'getBoundingClientRect').mockReturnValue({top:80} as DOMRect);
  expect(frameViewportHeight(frame,900)).toBe(765);
  main.remove();
});
