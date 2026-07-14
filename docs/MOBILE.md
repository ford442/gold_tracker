# GoldTrackr — Mobile & PWA Guide

GoldTrackr is designed for **mobile-first** gold tracking: section-based navigation loads one panel at a time, touch targets meet 44×44px guidelines, and an optional PWA caches the app shell plus the last price snapshot for offline viewing.

## Layout

- **Section shell** — Bottom tab bar on viewports &lt; 900px; desktop pills in the header at ≥ 900px. Only the active section’s JS chunk loads (code-split).
- **Single-column panels** — Overview, Analytics, Portfolio, Strategies, and Markets stack vertically on all breakpoints. Multi-column grids collapse to one column below 640px.
- **Price dashboard** — One card per row on phones; two columns from `sm` (640px) upward.
- **Settings modal** — Full-screen sheet on phones with large accordion tap targets.

## Touch targets

| Control | Minimum size |
|---------|----------------|
| Bottom nav items | 48px tap area |
| Range pills / tab pills | 44×44px |
| Settings accordion headers | 48px height |
| Primary buttons | 44px min-height |

Global `touch-action: manipulation` on interactive elements reduces 300ms tap delay on older mobile browsers.

## PWA (optional install)

After `npm run build`, the production bundle includes:

- **Web manifest** — `manifest.webmanifest` (standalone display, theme colors)
- **Service worker** — Precaches JS/CSS/HTML/shell assets via Workbox
- **Price snapshot** — Last successful fetch persisted to `localStorage` (`goldtrackr-price-snapshot`); restored when offline or when live fetch fails

Install: open the deployed site in Chrome/Safari → “Add to Home Screen” / “Install app”.

Dev mode does not register the service worker (`devOptions.enabled: false` in Vite PWA config). Test PWA with `npm run build && npm run preview`.

## Offline / stale banner

A banner appears when:

- The device is **offline** (cached snapshot shown)
- Data is **stale** (&gt; 120s since last successful refresh)
- A **fetch error** occurred but cached prices are available

The banner shows both absolute time and relative “time ago”.

## Lighthouse mobile performance targets

Run Lighthouse in Chrome DevTools → Mobile, throttled 4G, on the **production** build (`npm run preview`).

| Category | Target | Notes |
|----------|--------|-------|
| **Performance** | ≥ 85 | Section code-split keeps initial JS small; Recharts loads only in Analytics/Overview lazy panels |
| **Accessibility** | ≥ 90 | Focus rings, `aria-*` on nav/tabs, banner `role="status"` |
| **Best Practices** | ≥ 90 | HTTPS in production; no mixed content |
| **SEO** | ≥ 80 | Meta description, viewport, semantic landmarks |
| **PWA** | Installable | Manifest + SW + icons when built for production |

### Tips to hit targets

1. **Test production builds** — Dev bundles are unminified and include HMR overhead.
2. **Stay in one section** — First paint after install is fastest on Overview; Analytics pulls Recharts.
3. **Avoid font flash** — Fonts are preconnected; consider `font-display: swap` if FCP regresses.
4. **Monitor LCP** — Hero price cards should be LCP; keep dashboard first in Overview section.

### CI note

Lighthouse is not run in CI (requires headless Chrome + built assets). Run locally before releases or add a optional `lighthouse-ci` job if needed.

## Keyboard shortcuts (desktop)

Section keys `1`–`5`, `←`/`→` navigate, `D` theme, `R` refresh, `S` settings. Shortcuts are disabled when focus is in form fields.
