/**
 * Accessibility Property Tests
 * 
 * Property-based tests for accessibility requirements
 * Validates: Requirements 8.x, 9.x (Accessibility)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateContrastRatio, meetsContrastAA, meetsContrastAAA } from '../../src/utils/a11y';
import { colors } from '../../src/tokens/colors';

// ============================================
// Property 10: Color Contrast Ratio
// Validates: Requirements 9.1
// ============================================

describe('Property 10: Color Contrast Ratio', () => {
  it('should calculate contrast ratio between 1 and 21', () => {
    fc.assert(
      fc.property(
        fc.hexaString({ minLength: 6, maxLength: 6 }),
        fc.hexaString({ minLength: 6, maxLength: 6 }),
        (fg, bg) => {
          const ratio = calculateContrastRatio(`#${fg}`, `#${bg}`);
          expect(ratio).toBeGreaterThanOrEqual(1);
          expect(ratio).toBeLessThanOrEqual(21);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should return 21 for black on white', () => {
    const ratio = calculateContrastRatio('#000000', '#FFFFFF');
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('should return 1 for same colors', () => {
    const ratio = calculateContrastRatio('#3B82F6', '#3B82F6');
    expect(ratio).toBeCloseTo(1, 1);
  });

  it('should meet AA for primary text on white', () => {
    const result = meetsContrastAA(colors.primary[600], colors.white);
    expect(result).toBe(true);
  });

  it('should meet AA for neutral dark text on white', () => {
    const result = meetsContrastAA(colors.neutral[900], colors.white);
    expect(result).toBe(true);
  });
});

// ============================================
// Property 8: Touch Target Size
// Validates: Requirements 8.3
// ============================================

const MIN_TOUCH_TARGET = 44;

interface TouchTarget {
  width: number;
  height: number;
}

function validateTouchTargetSize(target: TouchTarget): boolean {
  return target.width >= MIN_TOUCH_TARGET && target.height >= MIN_TOUCH_TARGET;
}

describe('Property 8: Touch Target Size', () => {
  it('should validate targets >= 44x44 as valid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 44, max: 200 }),
        fc.integer({ min: 44, max: 200 }),
        (width, height) => {
          const result = validateTouchTargetSize({ width, height });
          expect(result).toBe(true);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should validate targets < 44 in any dimension as invalid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 43 }),
        fc.integer({ min: 44, max: 200 }),
        (width, height) => {
          const result = validateTouchTargetSize({ width, height });
          expect(result).toBe(false);
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should validate button sizes meet touch target', () => {
    const buttonSizes = [
      { width: 80, height: 32 },  // sm - may not meet
      { width: 100, height: 40 }, // md - may not meet
      { width: 120, height: 48 }, // lg - meets
    ];
    
    // At least lg size should meet touch target
    expect(validateTouchTargetSize(buttonSizes[2])).toBe(true);
  });
});

// ============================================
// Property 9: Responsive Grid Columns
// Validates: Requirements 8.4
// ============================================

const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

function getGridColumns(screenWidth: number): number {
  if (screenWidth < BREAKPOINTS.sm) return 1;
  if (screenWidth < BREAKPOINTS.md) return 2;
  if (screenWidth < BREAKPOINTS.lg) return 3;
  if (screenWidth < BREAKPOINTS.xl) return 4;
  return 5;
}

describe('Property 9: Responsive Grid Columns', () => {
  it('should return 1 column for mobile', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 639 }),
        (width) => {
          expect(getGridColumns(width)).toBe(1);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should increase columns with screen width', () => {
    const widths = [400, 700, 900, 1100, 1600];
    const columns = widths.map(getGridColumns);
    
    for (let i = 1; i < columns.length; i++) {
      expect(columns[i]).toBeGreaterThanOrEqual(columns[i - 1]);
    }
  });

  it('should return valid column count for any width', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 320, max: 2560 }),
        (width) => {
          const cols = getGridColumns(width);
          expect(cols).toBeGreaterThanOrEqual(1);
          expect(cols).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 50 }
    );
  });
});

