import { useState, useSyncExternalStore, useCallback } from 'react';
import {
  defaultObservabilityBuffer,
  getObservabilityEvents,
  getObservabilitySummary,
  clearObservabilityEvents,
  exportObservabilityJson,
  type ObservabilityEventKind,
} from '@lib/observability';

export interface UseObservabilityOptions {
  kindFilter?: ObservabilityEventKind | 'all';
}

function subscribe(callback: () => void): () => void {
  return defaultObservabilityBuffer.subscribe(callback);
}

let version = 0;
defaultObservabilityBuffer.subscribe(() => {
  version += 1;
});

function getSnapshot(): number {
  return version;
}

export function useObservability(options: UseObservabilityOptions = {}) {
  const [kindFilter, setKindFilter] = useState<ObservabilityEventKind | 'all'>(
    options.kindFilter ?? 'all',
  );

  // Sync with ring buffer via useSyncExternalStore
  useSyncExternalStore(subscribe, getSnapshot, () => 0);

  const filter = kindFilter !== 'all' ? { kind: kindFilter } : undefined;
  const events = getObservabilityEvents(filter);
  const summary = getObservabilitySummary();

  const handleClear = useCallback(() => {
    clearObservabilityEvents();
    version += 1;
  }, []);

  const handleExport = useCallback(() => {
    const json = exportObservabilityJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goldtrackr-diagnostics-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return {
    events,
    summary,
    kindFilter,
    setKindFilter,
    clearEvents: handleClear,
    exportJson: handleExport,
  };
}
