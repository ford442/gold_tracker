import { useConnectivityStatus } from '@/hooks/useConnectivityStatus';
import { formatTimeAgo } from '@lib/utils';

export function OfflineBanner() {
  const {
    isOnline,
    isFromCache,
    isStale,
    lastUpdated,
    error,
    showBanner,
    freshness,
  } = useConnectivityStatus();

  if (!showBanner || lastUpdated == null) return null;

  const timeLabel = new Date(lastUpdated).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const ago = formatTimeAgo(new Date(lastUpdated).toISOString());

  let message: string;
  let variant: 'offline' | 'stale' | 'cached';

  if (!isOnline) {
    message = `Offline — showing last saved prices from ${timeLabel} (${ago})`;
    variant = 'offline';
  } else if (isFromCache || freshness === 'cached') {
    message = `Using cached prices from ${timeLabel} (${ago}) — refresh when back online`;
    variant = 'cached';
  } else if (isStale) {
    message = `Stale data — last live update ${timeLabel} (${ago})`;
    variant = 'stale';
  } else if (error) {
    message = `Could not refresh — showing prices from ${timeLabel} (${ago})`;
    variant = 'stale';
  } else {
    return null;
  }

  return (
    <div
      className={`offline-banner offline-banner--${variant}`}
      role="status"
      aria-live="polite"
    >
      <span className="offline-banner-icon" aria-hidden="true">
        {!isOnline ? '📡' : isFromCache ? '💾' : '⏱'}
      </span>
      <span className="offline-banner-text">{message}</span>
    </div>
  );
}
