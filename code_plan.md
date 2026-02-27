# Code Plan for GoldTrackr

This document captures an architectural review of the existing `gold_tracker` application along with gaps compared to a **professional/business-grade trading system**.  It also outlines what would be required in order to turn the dashboard into a platform capable of executing trades proficiently.

---

## 1. Current Application Summary

- React + TypeScript single‑page client running in the browser.
- Displays live spot prices for XAU, PAXG, XAUT, BTC, ETH using CoinGecko and MetalPrice APIs.
- Computes simple statistics: correlation matrix, sparkline charts.
- Emits desktop notifications when spread between PAXG/XAUT exceeds 0.5 %.
- Tracks a manual portfolio with unrealized P&L and exposure percentages.
- Fetches gold‑related news via Kitco RSS.
- Dark/light theming persisted in localStorage.
- No server component; all logic runs client‑side with occasional API calls.

> **Disclaimer** in README states this is informational and not financial advice.

## 2. Professional/Business Software Characteristics (Not Present)

| Area | GoldTrackr (current) | Typical Business/Trading Suite |
|------|----------------------|--------------------------------|
| **Order Execution** | None – read‑only price dashboard | Integration with brokers/exchanges (REST/WebSocket), order placement, cancellation, status tracking |
| **User Management** | No auth; single user stored locally | Multi‑user accounts, authentication, role‑based access, KYC/AML compliance |
| **Backend Services** | Entirely client‑side | Server or cloud services for data aggregation, order routing, persistence, compute-intensive analytics |
| **Risk & OMS** | Manual portfolio entry only | Automated risk checks, position limits, margin calculations, order management system (OMS) |
| **Data & Feeds** | Two public APIs + RSS; 60‑s refresh | Professional quotes/multiplexer feeds (FIX, proprietary), tick‑level data, historical DB for backtesting |
| **Security** | No encryption; API keys in `.env` if used | Secure storage, encrypted transport, audit logs, intrusion detection |
| **Reliability & Scaling** | Single browser, no resilience | Redundancy, horizontal scaling, 99.x % SLAs, monitoring/alerting |
| **Compliance & Logging** | None | Trade surveillance, audit trail, regulatory reporting (MiFID II, SEC, etc.) |
| **Testing & CI** | Likely minimal/no tests | Extensive unit/integration tests, simulation environments, CI/CD pipelines |
| **Performance** | 60 s interval refresh; descriptive UI | Sub‑second latencies, high‑frequency handling, optimized GPU/compute pipelines |

### Missing Functionalities
- **Back‑testing engine** for evaluating strategies on historical data.
- **Algorithmic trading framework** (EMA crossover, mean‑reversion, arbitrage bots). 
- **Connectivity to payment/settlement systems** or cold‑storage for custody.
- **Compliance features** such as user consent screens or risk disclosures.

## 3. Trading Proficiency Assessment

As implemented, **GoldTrackr cannot place or manage live trades**.  It is essentially a monitoring/alerting dashboard.  For proficiency in executing trades you would need:

1. **Broker/exchange API integration.**  Support for limit/market orders, order types, error handling, and rate‑limits.
2. **Order management layer.**  Track each order's lifecycle, handle partial fills, slippage, cancellations.
3. **Algorithmic engines.**  Back‑tests, simulation, and production strategies that generate signals automatically.
4. **Risk management.**  Position and exposure limits, stop‑loss/take‑profit automation, real‑time P&L and margin.
5. **Persistent trade/history storage.**  Database to record executed trades, performance metrics, tax reports.
6. **Monitoring/alerting.**  Health checks on connectivity, trade failures, latency spikes.
7. **Robust error recovery.**  Re‑send lost orders, reconcile positions after outages.
8. **Security/credentials.**  Safely store API keys, implement 2FA, encrypt sensitive data.

Without these components, the app is unsuitable for professional or business use.  It could, however, serve as a **prototype or educational tool** showing price relationships and manual arbitrage opportunities.

## 4. Next Steps to Evolve the Project

1. **Spin up a backend service** (e.g. Node/Express, Python FastAPI) hosted separately.  This allows secure storage of keys and server‑side logic.
2. **Choose target brokers/exchanges** and implement SDK wrappers (Binance, Coinbase, gold‑specific liquidity providers).  Abstract interfaces for order placement.
3. **Implement user authentication and data persistence.**  Use PostgreSQL or Supabase (already present) for portfolio/trade records.
4. **Develop an OMS/Risk module.**  Real‑time position tracking, margin calculation, risk rule engine.
5. **Add a strategy engine** for simple automated trades, with a back‑testing UI and simulation mode.
6. **Harden security & compliance.**  Encrypt secrets, add logging, prepare for regulatory requirements.
7. **Expand data feeds.**  Subscribe to professional price feeds with sub‑second updates.
8. **Write comprehensive tests** and set up CI/CD pipelines.

---

### Conclusion
GoldTrackr is a neat, small‑scale dashboard useful for tracking and visualizing gold/crypto markets.  It **is not yet professional or business software**, particularly because it lacks any trading execution capability and necessary infrastructure for reliability, security, and compliance. Turning it into a proficient trading product would require substantial architectural additions described above.

*This plan can live in the repository as a reference for future development.*
