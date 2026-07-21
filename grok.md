# grok.md — Grok AI Assistant Guide for GoldTrackr

> Read this first. This complements the detailed [AGENTS.md](./AGENTS.md) — treat AGENTS.md as the authoritative technical reference.

## Project Snapshot

**GoldTrackr** is a real-time gold & crypto intelligence dashboard focused on tokenized gold (PAXG, XAUT) versus spot gold (XAU) and major cryptos (BTC, ETH, BCH).

It combines live market data, statistical analysis (short-term correlations + structural multi-horizon fidelity/regime analysis with Gold Fidelity Scores, rolling divergence, vol/DD lens), actionable signals (arb alerts, trade suggestions), portfolio tracking with live exchange sync, algorithmic backtesting, trade replay with projections, and optional **secure multi-exchange trading** (Coinbase CDP + Kraken) via Supabase.

The goal: feel like a premium personal trading terminal — delightful glass UI, trustworthy numbers, conservative safety defaults.

## Core Philosophy for Working Here

- **Dark-first, gold-accented glassmorphism**: The visual identity is defined by CSS custom properties in [src/index.css](./src/index.css). Dark mode is the primary experience; light is a well-supported variant. Never break the `--color-gold`, `--glass-*`, or reflection/sheen effects.
- **Trading safety is non-negotiable**: Dry-run mode is default everywhere. Every execution path (client JWT or Edge Function) must surface "this is a simulation" clearly. Do not weaken guards.
- **Two trading worlds, one UI**: Local mode (keys in Zustand/localStorage) vs Server-secure (Supabase + AES-GCM + Edge Functions). Code that touches trading/settings must handle both without duplication or drift.
- **Two exchanges, real fee math**: Coinbase (PAXG→USD→XAUT, ~1.2% round-trip) vs Kraken (direct PAXG/XAUT pair, ~0.26%). The arb math, suggestions, and execution routing must reflect this difference accurately.
- **Strategy engine is pure TypeScript**: [src/lib/strategyEngine.ts](./src/lib/strategyEngine.ts) imports nothing from React. It is the single source of truth for backtest logic (now includes rebalancer + hold + shock helpers + initialPositions seeding for Feature 3 Scenario Lab). Keep it that way.
- **Graceful degradation everywhere**: No API keys? The entire app must still look and feel excellent using the rich mock generators in [src/lib/api.ts](./src/lib/api.ts).
- **Zustand + persist for anything that should survive reload**: See priceStore, portfolioStore, settingsStore, strategyStore, themeStore.
- **Recharts with animations off**: All charts set `isAnimationActive={false}` for snappy feel and to avoid flash-of-wrong-data.
- **Regime awareness is educational core**: Gold vs crypto-gold fluctuations (fidelity scores, regime shifts) are framed strictly as historical/simulation for users (small stacks today). Always surface "Not financial advice" + "synthesized spot" in any new analysis UI.

## Important Technical Realities

- Price polling: 60s fixed interval (`useGoldPrices.ts`).
- Arbitrage alerts: deliberately debounced (once per 5 min per pair) to avoid notification spam.
- Coinbase balances: poll only when sync enabled (`useCoinbaseBalances.ts`); they flow into portfolio via `syncCoinbaseBalances`.
- News: currently returns curated mock data only (RSS path disabled for CORS reasons).
- Supabase: fully optional. When `VITE_SUPABASE_*` are absent, the app uses clean no-op fallbacks (see [src/lib/supabase.ts](./src/lib/supabase.ts) and [src/services/tradeService.ts](./src/services/tradeService.ts)).
- JWT for Coinbase: ES256 via Web Crypto (local) or `jose` (Edge Function). Keys never leave the secure path after upload.

## Grok Interaction Guidelines

- When the user asks for a change, first consider which layer it touches (UI component, hook, store, lib pure function, Supabase edge fn, or types).
- Prefer editing existing patterns over inventing new ones. The project already has strong conventions for cards, charts, modals (accordion style in Settings), and state.
- For any trading-related feature, explicitly call out impact on both Coinbase/Kraken and both local/server modes.
- Backtest or strategy changes: update the pure engine first, then the StrategyDashboard UI that consumes `BacktestResult`. (Scenario Lab is an internal mode of StrategyDashboard; seeding uses portfolio snapshots via initialPositions.)
- Regime/fidelity work: keep all math pure in `lib/regime.ts`; UI + disclaimers in RegimeLens (tab in GoldComparisonTools). Distinguish tactical (CorrelationMatrix) vs structural (Fidelity & Regimes). Always label synthesized spot history.
- Performance: this is a live dashboard. Avoid heavy work in render; use memo, debounced effects, and the existing loading skeleton components.
- Keep the "glass-card" / "section-heading" / "change-chip" visual language consistent.
- Test mentally with zero env vars. The mock path must never feel like a fallback — it is a first-class experience.

## High-Value Areas for Improvement (Typical Work)

- New backtest strategies or richer tick generation in the strategy engine (rebalancer, Scenario Lab shocks on seeded portfolios)
- Enhancements to TradeReplayChart (more realistic projections, confidence bands)
- Portfolio P&L over time (PnLOverTimeChart) or risk metrics
- GlobalArbitrageMonitor signal realism or additional synthetic pairs
- Settings UX (key validation, connection testing feedback, exchange comparison)
- Mobile / responsive refinements while preserving the dense terminal aesthetic
- Additional data sources or on-chain gold proof indicators (future-facing)
- RegimeLens enhancements, better spot history synthesis, or fidelity-weighted strategy ideas (keep pure in regime.ts)

## Quick Commands

```bash
npm run dev          # start dev server
npm run build        # typecheck + production build
npm run preview      # serve the dist build locally
npm run lint         # ESLint
```

Deployment (when relevant): `npm run build && python deploy.py` (SFTP to test.1ink.us/gold).

## Relationship to Other Docs

- **AGENTS.md**: Full technical spec — project structure, every component/hook/store/lib responsibility, CSS variable glossary, state patterns, security model, exact deployment steps. Read it when you need precision. (New: RegimeLens.tsx responsibility for fidelity UI + NFA framing; regime.ts for all pure math.)
- **README.md**: User-facing quick start and feature list.
- **code_plan.md**: Maintained OMS gap checklist (Done vs Remaining on `main`); see also [docs/ROADMAP.md](docs/ROADMAP.md) for a one-page summary.
- **supabase/**: Edge Functions, schema, and DEPLOY.md for the optional secure backend.

This project sits at the intersection of delightful personal tooling and real (simulated) financial operations. When in doubt, make the numbers trustworthy and the interface feel expensive.

Let's keep GoldTrackr sharp, safe, and beautiful. 🥇
