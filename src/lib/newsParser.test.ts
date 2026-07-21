import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseRssItems, mergeNewsFeeds, stripHtml } from './newsParser';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const kitcoXml = readFileSync(join(fixtureDir, '__fixtures__/kitco-rss.xml'), 'utf-8');

describe('stripHtml', () => {
  it('removes tags and entities', () => {
    expect(stripHtml('<p>Gold <strong>rallies</strong> &amp; rises</p>')).toBe('Gold rallies & rises');
  });
});

describe('parseRssItems', () => {
  it('parses Kitco RSS fixture into NewsItem shape', () => {
    const items = parseRssItems(kitcoXml, 'Kitco');
    expect(items).toHaveLength(3);

    expect(items[0]).toMatchObject({
      title: 'Gold rallies as Fed signals rate cut pause',
      url: 'https://www.kitco.com/news/article/gold-rallies-fed',
      source: 'Kitco',
    });
    expect(items[0].snippet).toContain('Gold prices surged past');
    expect(items[0].snippet).not.toContain('<p>');
    expect(items[0].publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(items[0].id).toBeTruthy();

    expect(items[1].title).toBe('China increases gold reserves for third month');
    expect(items[2].title).toBe('PAXG vs XAUT spread widens on exchanges');
    expect(new Date(items[2].publishedAt).toISOString()).toBe('2025-07-19T08:15:00.000Z');
  });

  it('returns empty array for invalid XML', () => {
    expect(parseRssItems('not xml', 'Kitco')).toEqual([]);
  });
});

describe('mergeNewsFeeds', () => {
  it('dedupes by URL and sorts newest first', () => {
    const feedA = parseRssItems(kitcoXml, 'Kitco');
    const feedB = [
      {
        ...feedA[0],
        source: 'MINING.com',
        title: 'Duplicate headline',
      },
      {
        id: 'extra-1',
        title: 'Brand new story',
        url: 'https://www.mining.com/brand-new-story',
        source: 'MINING.com',
        publishedAt: '2025-07-22T12:00:00.000Z',
        snippet: 'Fresh mining news',
      },
    ];

    const merged = mergeNewsFeeds([feedA, feedB]);
    const urls = merged.map((i) => i.url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(merged[0].title).toBe('Brand new story');
    expect(merged.some((i) => i.url === feedA[0].url)).toBe(true);
    expect(merged.filter((i) => i.url === feedA[0].url)).toHaveLength(1);
  });
});
