/** Minimal Coinbase CDP brokerage API response shapes (client-side parsing). */

export interface CoinbaseApiErrorBody {
  message?: string;
  error?: string;
}

export interface CoinbaseOrderConfiguration {
  market_market_ioc?: {
    base_size?: string;
  };
}

export interface CoinbaseOrderPayload {
  status?: string;
  filled_size?: string;
  filled_value?: string;
  average_filled_price?: string;
  order_configuration?: CoinbaseOrderConfiguration;
}

export interface CoinbaseOrderStatusResponse extends CoinbaseApiErrorBody {
  order?: CoinbaseOrderPayload;
}

export interface CoinbasePlaceOrderResponse extends CoinbaseApiErrorBody {
  order_id?: string;
}

export interface CoinbaseAccountsResponse {
  accounts?: Array<{
    id: string;
    name: string;
    currency: { code: string; name: string };
    balance: { amount: string; currency: string };
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseCoinbaseOrderStatusResponse(raw: unknown): CoinbaseOrderStatusResponse {
  if (!isRecord(raw)) return {};
  return raw as CoinbaseOrderStatusResponse;
}

export function parseCoinbaseApiErrorBody(raw: unknown): CoinbaseApiErrorBody {
  if (!isRecord(raw)) return {};
  return raw as CoinbaseApiErrorBody;
}

export function parseCoinbasePlaceOrderResponse(raw: unknown): CoinbasePlaceOrderResponse {
  if (!isRecord(raw)) return {};
  return raw as CoinbasePlaceOrderResponse;
}

export function parseCoinbaseAccountsResponse(raw: unknown): CoinbaseAccountsResponse {
  if (!isRecord(raw)) return {};
  return raw as CoinbaseAccountsResponse;
}

export function resolveCoinbaseOrder(data: CoinbaseOrderStatusResponse): CoinbaseOrderPayload {
  if (data.order) return data.order;
  return data as CoinbaseOrderPayload;
}
