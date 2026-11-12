import Parser from 'rss-parser';
import axios from 'axios';
import type { NewsItem } from '../types';

const rssParser = new Parser();

const RSS_FEEDS = [
  { url: 'https://www.forexlive.com/feed/news', name: 'ForexLive' },
  { url: 'https://www.investing.com/rss/news_14.rss', name: 'Investing.com' },
  { url: 'https://feeds.marketwatch.com/marketwatch/marketpulse/', name: 'MarketWatch' },
];

// Forex-relevant keywords — only fetch full article for these
const FOREX_KEYWORDS = /\b(USD|EUR|GBP|JPY|AUD|NZD|CHF|CAD|Fed|ECB|BOJ|BOE|RBA|RBNZ|SNB|dollar|euro|pound|yen|forex|rate hike|rate cut|inflation|CPI|NFP|GDP|central bank|interest rate|yield|tariff|trade war|oil|gold|VIX|risk|geopolit)/i;

function detectCurrencies(text: string): string[] {
  const regex = /(USD|EUR|GBP|JPY|AUD|NZD|CHF|CAD|Fed|ECB|BOJ|BoJ|BOE|RBA|RBNZ|SNB|dollar|euro|pound|yen)/gi;
  const matches = text.match(regex) || [];
  const unique = new Set(matches.map(m => m.toUpperCase()));
  return Array.from(unique);
}

// Extract readable text from HTML — strip tags, collapse whitespace, trim to limit
function extractText(html: string, maxChars = 1500): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

async function fetchArticleContent(url: string, headline: string): Promise<string | null> {
  // Only fetch if headline looks forex-relevant
  if (!FOREX_KEYWORDS.test(headline)) return null;

  try {
    const { data } = await axios.get(url, {
      timeout: 6000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      maxRedirects: 3,
    });
    const text = extractText(data);
    return text.length > 100 ? text : null;
  } catch {
    return null;
  }
}

export async function fetchNews(): Promise<NewsItem[]> {
  const allItems: NewsItem[] = [];

  const feedResults = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const rss = await rssParser.parseURL(feed.url);
        return {
          feed: feed.name,
          items: (rss.items || []).slice(0, 5).map((item) => ({
            headline: item.title || 'Untitled',
            source: feed.name,
            publishedAt: item.pubDate || new Date().toISOString(),
            url: item.link || '',
            // RSS content field often contains the article body already
            rssContent: item.content || item['content:encoded'] || item.summary || '',
            relevantCurrencies: detectCurrencies(
              `${item.title || ''} ${item.content || ''}`
            ),
          })),
        };
      } catch (error) {
        console.warn(`Failed to fetch ${feed.name}:`, (error as any).message);
        return { feed: feed.name, items: [] };
      }
    })
  );

  for (const result of feedResults) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value.items as any[]);
    }
  }

  // Remove duplicates by headline
  const seen = new Set<string>();
  const unique = (allItems as any[]).filter((item) => {
    if (seen.has(item.headline)) return false;
    seen.add(item.headline);
    return true;
  });

  // Sort by date, take top 10
  const top = unique
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 10);

  // Enrich with full article content (parallel, non-blocking per item)
  const enriched = await Promise.all(
    top.map(async (item): Promise<NewsItem> => {
      // Use RSS content if substantial enough, otherwise fetch the page
      const rssText = item.rssContent ? extractText(item.rssContent, 1500) : '';
      const articleContent = rssText.length > 200
        ? rssText
        : await fetchArticleContent(item.url, item.headline);

      return {
        headline: item.headline,
        source: item.source,
        publishedAt: item.publishedAt,
        url: item.url,
        relevantCurrencies: item.relevantCurrencies,
        articleContent: articleContent ?? undefined,
      };
    })
  );

  return enriched;
}
