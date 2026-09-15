/// <reference lib="webworker" />

import { initWasm, runBacktestFromPayload, rollingCorrelationsNative } from '@/lib/nativeAnalytics';
import type { AnalyticsWorkerRequest, AnalyticsWorkerResponse } from '@/lib/analyticsWorkerProtocol';

const wasmReady = initWasm();

self.onmessage = (event: MessageEvent<AnalyticsWorkerRequest>) => {
  const msg = event.data;

  void (async () => {
    try {
      await wasmReady;
      switch (msg.type) {
        case 'runBacktest': {
          const result = runBacktestFromPayload(msg.payload);
          const response: AnalyticsWorkerResponse = { id: msg.id, ok: true, result };
          self.postMessage(response);
          break;
        }
        case 'rollingCorrelations': {
          const result = rollingCorrelationsNative(msg.payload);
          const response: AnalyticsWorkerResponse = { id: msg.id, ok: true, result };
          self.postMessage(response);
          break;
        }
      }
    } catch (err) {
      const response: AnalyticsWorkerResponse = {
        id: msg.id,
        ok: false,
        error: err instanceof Error ? err.message : 'Worker error',
      };
      self.postMessage(response);
    }
  })();
};

export {};
