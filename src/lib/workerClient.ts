import { dispatchRunBacktest, dispatchRollingCorrelations } from './analyticsDispatch';
import type {
  AnalyticsWorkerRequestType,
  AnalyticsWorkerResultMap,
  RunBacktestPayload,
  RollingCorrelationsPayload,
} from './analyticsWorkerProtocol';

const DEFAULT_TIMEOUT_MS = 30_000;

export interface WorkerClientOptions {
  /** Skip worker and run on main thread (tests / SSR). */
  forceMainThread?: boolean;
  timeoutMs?: number;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
  fallback: () => unknown;
}

let worker: Worker | null = null;
let workerFailed = false;
const pending = new Map<string, PendingRequest>();

function rejectAllPending(_reason: string) {
  for (const [id, entry] of pending) {
    clearTimeout(entry.timer);
    entry.resolve(entry.fallback());
    pending.delete(id);
  }
  workerFailed = true;
  worker?.terminate();
  worker = null;
}

function ensureWorker(): Worker | null {
  if (workerFailed || typeof Worker === 'undefined') return null;

  if (!worker) {
    try {
      worker = new Worker(
        new URL('../workers/analyticsWorker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.onmessage = (event) => {
        const msg = event.data as { id: string; ok: boolean; result?: unknown; error?: string };
        const entry = pending.get(msg.id);
        if (!entry) return;
        clearTimeout(entry.timer);
        pending.delete(msg.id);
        if (msg.ok) {
          entry.resolve(msg.result);
        } else {
          entry.resolve(entry.fallback());
        }
      };
      worker.onerror = () => {
        rejectAllPending('worker error');
      };
    } catch {
      workerFailed = true;
      return null;
    }
  }

  return worker;
}

function nextRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function invokeWorker<T extends AnalyticsWorkerRequestType>(
  type: T,
  payload: T extends 'runBacktest' ? RunBacktestPayload : RollingCorrelationsPayload,
  fallback: () => AnalyticsWorkerResultMap[T],
  opts?: WorkerClientOptions,
): Promise<AnalyticsWorkerResultMap[T]> {
  if (opts?.forceMainThread) {
    return fallback();
  }

  const w = ensureWorker();
  if (!w) {
    return fallback();
  }

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<AnalyticsWorkerResultMap[T]>((resolve) => {
    const id = nextRequestId();
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve(fallback());
    }, timeoutMs);

    pending.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject: () => resolve(fallback()),
      timer,
      fallback: fallback as () => unknown,
    });

    w.postMessage({ id, type, payload });
  });
}

export function runBacktestAsync(
  payload: RunBacktestPayload,
  opts?: WorkerClientOptions,
) {
  return invokeWorker('runBacktest', payload, () => dispatchRunBacktest(payload), opts);
}

export function rollingCorrelationsAsync(
  payload: RollingCorrelationsPayload,
  opts?: WorkerClientOptions,
) {
  return invokeWorker(
    'rollingCorrelations',
    payload,
    () => dispatchRollingCorrelations(payload),
    opts,
  );
}

/** @internal Test helper — reset singleton worker state between tests. */
export function _resetWorkerClientForTests() {
  worker?.terminate();
  worker = null;
  workerFailed = false;
  for (const [id, entry] of pending) {
    clearTimeout(entry.timer);
    pending.delete(id);
  }
}
