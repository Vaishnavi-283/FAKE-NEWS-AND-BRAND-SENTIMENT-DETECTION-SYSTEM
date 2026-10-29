import crypto from 'crypto';
import { cleanAndValidateImageUrl } from './thumbnailService.js';

// Query mappings for NewsAPI /v2/everything
export const NEWS_API_QUERIES = {
  'Tamil Nadu': {
    'All': '"Tamil Nadu" OR Chennai',
    'Tech & AI': '("Tamil Nadu" OR Chennai) AND (technology OR AI OR IT OR startup OR software)',
    'Business': '("Tamil Nadu" OR Chennai) AND (business OR economy OR investment OR industry OR manufacturing)',
    'Science': '("Tamil Nadu" OR Chennai) AND (science OR ISRO OR research OR "IIT Madras")',
    'Health': '("Tamil Nadu" OR Chennai) AND (health OR hospital OR medical OR healthcare)',
    'Politics': '("Tamil Nadu" OR Chennai) AND (politics OR government OR DMK OR AIADMK OR assembly)',
  },
  'India': {
    'All': 'India',
    'Tech & AI': 'India AND (technology OR "artificial intelligence" OR AI OR IT OR startup)',
    'Business': 'India AND (business OR economy OR market OR finance OR commerce)',
    'Science': 'India AND (science OR space OR ISRO OR research)',
    'Health': 'India AND (health OR healthcare OR medical OR hospital)',
    'Politics': 'India AND (politics OR government OR parliament OR election OR policy)',
  },
  'World': {
    'All': 'world OR international OR global',
    'Tech & AI': 'technology OR "artificial intelligence" OR tech OR computing',
    'Business': 'business OR "global economy" OR markets OR finance',
    'Science': 'science OR space OR NASA OR research OR climate',
    'Health': 'health OR medicine OR healthcare OR "medical research" OR WHO',
    'Politics': '"world politics" OR geopolitics OR diplomacy OR elections',
  },
};

/**
 * Strips HTML tags and unescapes entities safely
 */
function cleanText(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Computes human-readable relative time
 */
function formatTime(dateInput, now = Date.now()) {
  if (!dateInput) return 'Date unavailable';
  const time = typeof dateInput === 'number' ? dateInput : new Date(dateInput).getTime();
  if (isNaN(time)) return 'Date unavailable';
  const diffMs = now - time;
  if (diffMs < 0) return 'Just now';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Builds the search query for NewsAPI /v2/everything
 */
export function buildNewsApiQuery(region, category) {
  const query = NEWS_API_QUERIES[region]?.[category];
  if (query) return query;
  return `${region || 'India'} ${category && category !== 'All' ? category : ''}`.trim();
}

/**
 * Fetches news stories from NewsAPI.org with timeout, validation, and response normalization
 */
export async function fetchNewsApiArticles({
  region = 'Tamil Nadu',
  category = 'All',
  apiKey = process.env.NEWS_API_KEY,
  pageSize = 15,
  timeoutMs = 4000,
} = {}) {
  const key = (apiKey || '').trim();
  if (!key) {
    return {
      success: false,
      reason: 'NO_API_KEY',
      message: 'NEWS_API_KEY is not configured in backend environment',
      stories: [],
    };
  }

  const query = buildNewsApiQuery(region, category);
  const params = new URLSearchParams({
    q: query,
    language: 'en',
    sortBy: 'publishedAt',
    pageSize: String(Math.min(pageSize, 30)),
  });

  const url = `https://newsapi.org/v2/everything?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': key,
        'User-Agent': 'MeioraAI/2.0 NewsIntelligence',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status === 401) {
      return { success: false, reason: 'INVALID_API_KEY', status: 401, stories: [] };
    }
    if (res.status === 429) {
      return { success: false, reason: 'RATE_LIMITED', status: 429, stories: [] };
    }
    if (!res.ok) {
      return { success: false, reason: `HTTP_${res.status}`, status: res.status, stories: [] };
    }

    const data = await res.json();
    if (data.status !== 'ok' || !Array.isArray(data.articles)) {
      return {
        success: false,
        reason: data.code || 'API_ERROR',
        message: data.message || 'Unexpected response format from NewsAPI',
        stories: [],
      };
    }

    if (data.articles.length === 0) {
      return {
        success: false,
        reason: 'ZERO_ARTICLES',
        message: 'NewsAPI returned 0 articles for query',
        stories: [],
      };
    }

    const fetchedAt = new Date().toISOString();
    const stories = [];

    for (const art of data.articles) {
      if (!art || !art.title || art.title.includes('[Removed]')) continue;

      let headline = cleanText(art.title);
      // Strip trailing publisher name if present e.g. "Headline - Source Name"
      const dashIdx = headline.lastIndexOf(' - ');
      if (dashIdx > 0 && dashIdx > headline.length - 40) {
        headline = headline.slice(0, dashIdx).trim();
      }
      if (!headline) continue;

      const source = cleanText(art.source?.name) || 'News Source';
      const sourceUrl = art.url || '';
      const publishedAt = art.publishedAt ? new Date(art.publishedAt).toISOString() : null;
      const publishedTimeLabel = formatTime(art.publishedAt);
      const image = cleanAndValidateImageUrl(art.urlToImage);

      let summary = cleanText(art.description || art.content || '');
      if (!summary || summary.includes('[Removed]')) {
        summary = `Live reporting from ${source} for ${region} (${category}): ${headline}.`;
      }

      const hash = crypto.createHash('md5').update(`newsapi-${region}-${headline}-${source}`).digest('hex').slice(0, 10);
      const id = `newsapi-${region.toLowerCase().replace(/[^a-z]/g, '')}-${hash}`;

      stories.push({
        id,
        headline,
        category,
        region,
        source,
        sourceUrl,
        publishedAt,
        publishedTimeLabel,
        fetchedAt,
        image, // Genuine urlToImage from NewsAPI!
        summary,
        url: art.url,
      });
    }

    if (stories.length === 0) {
      return { success: false, reason: 'ZERO_VALID_ARTICLES', stories: [] };
    }

    return {
      success: true,
      provider: 'NewsAPI',
      totalResults: data.totalResults || stories.length,
      fetchedAt,
      stories,
    };
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout') || err.name === 'AbortError';
    return {
      success: false,
      reason: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: err.message,
      stories: [],
    };
  }
}
