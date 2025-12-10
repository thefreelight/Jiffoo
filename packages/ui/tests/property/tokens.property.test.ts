/**
 * Design Token Property Tests
 * 
 * Property-based tests for design token requirements
 * Validates: Requirements 1.x, 2.x (Design Tokens)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { spacing, spacingValues } from '../../src/tokens/spacing';
import { colors } from '../../src/tokens/colors';
import { typography } from '../../src/tokens/typography';
import { animation } from '../../src/tokens/animation';
import { shadows } from '../../src/tokens/shadows';

// ============================================
// Property 1: Spacing Scale Consistency
// Validates: Requirements 1.4
// ============================================

describe('Property 1: Spacing Scale Consistency', () => {
  it('should have all spacing values as multiples of 4px', () => {
    const spacingKeys = Object.keys(spacingValues) as Array<keyof typeof spacingValues>;
    
    for (const key of spacingKeys) {
      const value = spacingValues[key];
      expect(value % 4).toBe(0);
    }
  });

  it('should have matching string and numeric values', () => {
    const spacingKeys = Object.keys(spacing) as Array<keyof typeof spacing>;
    
    for (const key of spacingKeys) {
      const stringValue = spacing[key];
      const numericValue = spacingValues[key];
      expect(stringValue).toBe(`${numericValue}px`);
    }
  });

  it('should have increasing values for increasing keys', () => {
    const keys = Object.keys(spacingValues)
      .map(Number)
      .filter(k => !isNaN(k))
      .sort((a, b) => a - b);
    
    for (let i = 1; i < keys.length; i++) {
      const prevKey = keys[i - 1] as keyof typeof spacingValues;
      const currKey = keys[i] as keyof typeof spacingValues;
      expect(spacingValues[currKey]).toBeGreaterThan(spacingValues[prevKey]);
    }
  });
});

// ============================================
// Property 2: Color Token Completeness
// Validates: Requirements 1.1, 1.2, 1.3
// ============================================

describe('Property 2: Color Token Completeness', () => {
  it('should have primary color scale with all required shades', () => {
    const requiredShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    
    for (const shade of requiredShades) {
      expect(colors.primary[shade as keyof typeof colors.primary]).toBeDefined();
    }
  });

  it('should have neutral color scale with all required shades', () => {
    const requiredShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    
    for (const shade of requiredShades) {
      expect(colors.neutral[shade as keyof typeof colors.neutral]).toBeDefined();
    }
  });

  it('should have semantic colors with light, DEFAULT, and dark variants', () => {
    const semanticColors = ['success', 'warning', 'error', 'info'] as const;
    
    for (const color of semanticColors) {
      expect(colors[color].light).toBeDefined();
      expect(colors[color].DEFAULT).toBeDefined();
      expect(colors[color].dark).toBeDefined();
    }
  });

  it('should have valid hex color format for all colors', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    
    // Check primary colors
    for (const shade of Object.values(colors.primary)) {
      expect(shade).toMatch(hexRegex);
    }
    
    // Check neutral colors
    for (const shade of Object.values(colors.neutral)) {
      expect(shade).toMatch(hexRegex);
    }
  });
});

// ============================================
// Property 3: Typography Token Completeness
// Validates: Requirements 2.1-2.5
// ============================================

describe('Property 3: Typography Token Completeness', () => {
  it('should have font family definitions', () => {
    expect(typography.fontFamily).toBeDefined();
    expect(typography.fontFamily.sans).toBeDefined();
    expect(typography.fontFamily.mono).toBeDefined();
  });

  it('should have font size scale', () => {
    expect(typography.fontSize).toBeDefined();
    expect(Object.keys(typography.fontSize).length).toBeGreaterThan(0);
  });

  it('should have font weight definitions', () => {
    expect(typography.fontWeight).toBeDefined();
    const requiredWeights = ['normal', 'medium', 'semibold', 'bold'];
    
    for (const weight of requiredWeights) {
      expect(typography.fontWeight[weight as keyof typeof typography.fontWeight]).toBeDefined();
    }
  });

  it('should have line height definitions', () => {
    expect(typography.lineHeight).toBeDefined();
    expect(Object.keys(typography.lineHeight).length).toBeGreaterThan(0);
  });
});

// ============================================
// Property 4: Animation Token Completeness
// Validates: Requirements 7.2, 7.3, 7.4
// ============================================

describe('Property 4: Animation Token Completeness', () => {
  it('should have duration definitions', () => {
    expect(animation.duration).toBeDefined();
    expect(animation.duration.fast).toBeDefined();
    expect(animation.duration.normal).toBeDefined();
    expect(animation.duration.slow).toBeDefined();
  });

  it('should have easing definitions', () => {
    expect(animation.easing).toBeDefined();
    expect(animation.easing.easeOut).toBeDefined();
    expect(animation.easing.easeInOut).toBeDefined();
  });

  it('should have numeric duration values', () => {
    for (const [, value] of Object.entries(animation.duration)) {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    }
  });
});

