import { describe, expect, it } from 'vitest';
import { listFigure, sampleChange } from '../../lib/list-figures';

describe('list page figures', () => {
  it('a real store shows the number that was read, zero included', () => {
    expect(listFigure(1842, 1256, false)).toBe('1,842');
    expect(listFigure(0, 1256, false)).toBe('0');
    expect(listFigure(7, 1256, false)).toBe('7');
  });

  it('a real store shows a dash, not a fixed number, when nothing was read', () => {
    expect(listFigure(undefined, 89, false)).toBe('\u2014');
    expect(listFigure(null, 89, false)).toBe('\u2014');
    expect(listFigure(Number.NaN, 89, false)).toBe('\u2014');
  });

  it('the demonstration instance shows the sample figure, whatever was or was not read', () => {
    expect(listFigure(undefined, 1256, true)).toBe('1,256');
    expect(listFigure(0, 1256, true)).toBe('1,256');
    expect(listFigure(1842, 1256, true)).toBe('1,256');
  });

  it('a change under a figure is shown with the samples only', () => {
    expect(sampleChange('12.5%', true)).toBe('12.5%');
    expect(sampleChange('12.5%', false)).toBeUndefined();
  });
});
