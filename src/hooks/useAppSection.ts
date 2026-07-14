import { useCallback, useEffect, useState } from 'react';
import {
  type AppSection,
  DEFAULT_SECTION,
  parseSectionFromHash,
} from '@lib/appSections';

export function useAppSection() {
  const [section, setSectionState] = useState<AppSection>(() => {
    const parsed = parseSectionFromHash(window.location.hash);
    if (!window.location.hash) {
      window.history.replaceState(null, '', `#${DEFAULT_SECTION}`);
    }
    return parsed;
  });

  const setSection = useCallback((next: AppSection) => {
    if (window.location.hash !== `#${next}`) {
      window.location.hash = next;
    }
    setSectionState(next);
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      setSectionState(parseSectionFromHash(window.location.hash));
    };
    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, []);

  return { section, setSection };
}
