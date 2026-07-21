/// <reference lib="webworker" />

import { dispatchRunBacktest, dispatchRollingCorrelations } from '@/lib/analyticsDispatch';
import type { AnalyticsWorkerRequest, AnalyticsWorkerResponse } from '@/lib/analyticsWorkerProtocol';

self.onmessage = (event: MessageEvent<AnalyticsWorkerRequest>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case 'runBacktest': {
        const result = dispatchRunBacktest(msg.payload);
        const response: AnalyticsWorkerResponse = { id: msg.id, ok: true, result };
        self.postMessage(response);
        break;
      }
      case 'rollingCorrelations': {
        const result = dispatchRollingCorrelations(msg.payload);
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
};

export {};
