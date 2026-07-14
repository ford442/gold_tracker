export type AppSection = 'overview' | 'analytics' | 'portfolio' | 'strategies' | 'markets';

export interface AppSectionDef {
  id: AppSection;
  label: string;
  shortLabel: string;
  icon: string;
  shortcut: string;
}

export const APP_SECTIONS: AppSectionDef[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'Home', icon: '📡', shortcut: '1' },
  { id: 'analytics', label: 'Analytics', shortLabel: 'Charts', icon: '📊', shortcut: '2' },
  { id: 'portfolio', label: 'Portfolio', shortLabel: 'Holdings', icon: '💼', shortcut: '3' },
  { id: 'strategies', label: 'Strategies', shortLabel: 'Lab', icon: '🧪', shortcut: '4' },
  { id: 'markets', label: 'Markets', shortLabel: 'News', icon: '🌐', shortcut: '5' },
];

export const DEFAULT_SECTION: AppSection = 'overview';

export function isAppSection(value: string): value is AppSection {
  return APP_SECTIONS.some((s) => s.id === value);
}

export function parseSectionFromHash(hash: string): AppSection {
  const id = hash.replace(/^#/, '').toLowerCase();
  return isAppSection(id) ? id : DEFAULT_SECTION;
}

export function sectionIndex(section: AppSection): number {
  return APP_SECTIONS.findIndex((s) => s.id === section);
}

export function adjacentSection(section: AppSection, direction: -1 | 1): AppSection {
  const idx = sectionIndex(section);
  const next = (idx + direction + APP_SECTIONS.length) % APP_SECTIONS.length;
  return APP_SECTIONS[next].id;
}
