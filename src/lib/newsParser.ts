import type { NewsItem } from '@/types';

const MAX_ITEMS = 20;

/** Strip HTML tags and collapse whitespace for snippet text. */
export function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function unwrapCdata(value: string): string {
  const match = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return match ? match[1].trim() : value.trim();
}

function extractTag(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = block.match(re);
  if (!match) return undefined;
  return unwrapCdata(match[1].trim());
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.href.replace(/\/$/, '');
  } catch {
    return url.trim().toLowerCase();
  }
}

function stableIdFromUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0;
  }
  return `news-${Math.abs(hash).toString(36)}`;
}

function parsePubDate(block: string): string {
  const pubDate = extractTag(block, 'pubDate');
  const dcDate = extractTag(block, 'dc:date');
  const raw = pubDate ?? dcDate;
  if (!raw) return new Date().toISOString();
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}

/** Parse RSS 2.0 XML into normalized news items. */
export function parseRssItems(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];

  for (const block of itemBlocks) {
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const guid = extractTag(block, 'guid');
    const url = link ?? guid;
    if (!title || !url) continue;

    const description = extractTag(block, 'description');
    const snippet = description ? stripHtml(description) : undefined;
    const publishedAt = parsePubDate(block);

    items.push({
      id: stableIdFromUrl(url),
      title: stripHtml(title),
      url,
      source,
      publishedAt,
      snippet: snippet && snippet.length > 0 ? snippet : undefined,
    });
  }

  return items;
}

/** Merge multiple feed results: dedupe by URL, sort newest first, cap at MAX_ITEMS. */
export function mergeNewsFeeds(feeds: NewsItem[][]): NewsItem[] {
  const seen = new Set<string>();
  const merged: NewsItem[] = [];

  const all = feeds.flat().sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  for (const item of all) {
    const key = normalizeUrl(item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= MAX_ITEMS) break;
  }

  return merged;
}
