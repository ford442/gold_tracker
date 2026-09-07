import { describe, expect, it } from 'vitest';
import {
  buildKrakenFormBody,
  signKrakenPrivateRequest,
} from './krakenSign';

const KRAKEN_DOC_SECRET =
  'kQH5HW/8p1uGOVjbgWA7FunAmGO8lsSUXNsu3eow76sz84Q18fWxnyRzBHCd3pd5nE9qa99HAZtuZuj6F1huXg==';
const KRAKEN_DOC_NONCE = '1616492376594';
const KRAKEN_DOC_PATH = '/0/private/AddOrder';
const KRAKEN_DOC_POST_BODY =
  'nonce=1616492376594&ordertype=limit&pair=XBTUSD&price=37500&type=buy&volume=1.25';
const KRAKEN_DOC_API_SIGN =
  '4/dpxb3iT4tp/ZCVEwSnEsLxx0bqyhLpdfOpc6fn7OR8+UClSV5n9E6aSS8MPtnRfp32bAb0nmbRn6H8ndwLUQ==';

describe('buildKrakenFormBody', () => {
  it('encodes Balance nonce-only payload', () => {
    expect(buildKrakenFormBody({ nonce: '1234567890' })).toBe('nonce=1234567890');
  });

  it('matches Kraken AddOrder example field order when built from params', () => {
    const postBody = buildKrakenFormBody({
      nonce: KRAKEN_DOC_NONCE,
      ordertype: 'limit',
      pair: 'XBTUSD',
      price: '37500',
      type: 'buy',
      volume: '1.25',
    });
    expect(postBody).toBe(KRAKEN_DOC_POST_BODY);
  });
});

describe('signKrakenPrivateRequest', () => {
  it('matches Kraken official AddOrder example vector', async () => {
    const apiSign = await signKrakenPrivateRequest(
      KRAKEN_DOC_SECRET,
      KRAKEN_DOC_PATH,
      KRAKEN_DOC_NONCE,
      KRAKEN_DOC_POST_BODY,
    );
    expect(apiSign).toBe(KRAKEN_DOC_API_SIGN);
  });

  it('produces a different signature when the secret is wrong', async () => {
    const valid = await signKrakenPrivateRequest(
      KRAKEN_DOC_SECRET,
      KRAKEN_DOC_PATH,
      KRAKEN_DOC_NONCE,
      KRAKEN_DOC_POST_BODY,
    );
    const invalid = await signKrakenPrivateRequest(
      'aW52YWxpZCBzZWNyZXQ=',
      KRAKEN_DOC_PATH,
      KRAKEN_DOC_NONCE,
      KRAKEN_DOC_POST_BODY,
    );
    expect(invalid).not.toBe(valid);
    expect(invalid).not.toBe(KRAKEN_DOC_API_SIGN);
  });

  it('throws on invalid base64 secret', async () => {
    await expect(
      signKrakenPrivateRequest('not!!!base64', KRAKEN_DOC_PATH, KRAKEN_DOC_NONCE, KRAKEN_DOC_POST_BODY),
    ).rejects.toThrow(/Invalid Kraken API secret/);
  });
});
