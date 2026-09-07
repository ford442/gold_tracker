import { describe, expect, it } from 'vitest';
import {
  APP_SECTIONS,
  adjacentSection,
  DEFAULT_SECTION,
  isAppSection,
  parseSectionFromHash,
  sectionIndex,
} from './appSections';

describe('appSections', () => {
  it('registers five sections with stable ids', () => {
    expect(APP_SECTIONS).toHaveLength(5);
    expect(APP_SECTIONS.map((s) => s.id)).toEqual([
      'overview',
      'analytics',
      'portfolio',
      'strategies',
      'markets',
    ]);
  });

  it('parses hash fragments and falls back to default', () => {
    expect(parseSectionFromHash('#portfolio')).toBe('portfolio');
    expect(parseSectionFromHash('#unknown')).toBe(DEFAULT_SECTION);
    expect(isAppSection('analytics')).toBe(true);
    expect(isAppSection('nope')).toBe(false);
  });

  it('walks adjacent sections in order', () => {
    expect(sectionIndex('overview')).toBe(0);
    expect(adjacentSection('markets', 1)).toBe('overview');
    expect(adjacentSection('overview', -1)).toBe('markets');
  });
});
