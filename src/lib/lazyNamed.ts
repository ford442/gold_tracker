import { lazy, type ComponentType } from 'react';

/** Lazy-load a named export as React.lazy default. */
export function lazyNamed<P extends object>(
  loader: () => Promise<Record<string, ComponentType<P>>>,
  exportName: string,
) {
  return lazy(() =>
    loader().then((module) => {
      const component = module[exportName];
      if (!component) {
        throw new Error(`lazyNamed: export "${exportName}" not found`);
      }
      return { default: component };
    }),
  );
}
