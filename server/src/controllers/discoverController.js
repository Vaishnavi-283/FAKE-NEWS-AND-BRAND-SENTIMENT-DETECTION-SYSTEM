import crypto from 'crypto';
import { enrichStoriesWithThumbnails, cleanAndValidateImageUrl } from '../services/thumbnailService.js';
import { fetchNewsApiArticles } from '../services/newsApiService.js';

// Supported Filters
export const SUPPORTED_REGIONS = ['Tamil Nadu', 'India', 'World'];
export const SUPPORTED_CATEGORIES = ['All', 'Tech & AI', 'Business', 'Science', 'Health', 'Politics'];

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache per (region, category)
const UPSTREAM_TIMEOUT_MS = 8000;    // 8 seconds upstream network timeout

// Cache map: key -> { stories, fetchedAt, cacheTime, region, category }
const cache = new Map();

// In-flight request deduplication map: key -> Promise
const inFlightRequests = new Map();

// Helper to reset cache (useful for automated testing)
export function resetDiscoverCache() {
  cache.clear();
  inFlightRequests.clear();
}

// Helper to manually set cache (useful for stale-feed testing)
export function setDiscoverCache(key, data) {
  cache.set(key, data);
}

// Google News RSS Feed Matrix
export const REGION_CATEGORY_FEEDS = {
  'Tamil Nadu': {
    'All': 'https://news.google.com/rss/search?q=Tamil+Nadu+OR+Chennai&hl=en-IN&gl=IN&ceid=IN:en',
    'Tech & AI': 'https://news.google.com/rss/search?q=(Tamil+Nadu+OR+Chennai)+(technology+OR+IT+OR+software+OR+AI+OR+startup)&hl=en-IN&gl=IN&ceid=IN:en',
    'Business': 'https://news.google.com/rss/search?q=(Tamil+Nadu+OR+Chennai)+(business+OR+economy+OR+industry+OR+manufacturing+OR+investments)&hl=en-IN&gl=IN&ceid=IN:en',
    'Science': 'https://news.google.com/rss/search?q=(Tamil+Nadu+OR+Chennai)+(science+OR+ISRO+OR+research+OR+space+OR+IIT+Madras)&hl=en-IN&gl=IN&ceid=IN:en',
    'Health': 'https://news.google.com/rss/search?q=(Tamil+Nadu+OR+Chennai)+(health+OR+hospital+OR+medical+OR+healthcare)&hl=en-IN&gl=IN&ceid=IN:en',
    'Politics': 'https://news.google.com/rss/search?q=(Tamil+Nadu+OR+Chennai)+(politics+OR+government+OR+DMK+OR+AIADMK+OR+Assembly)&hl=en-IN&gl=IN&ceid=IN:en',
  },
  'India': {
    'All': 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en',
    'Tech & AI': 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en',
    'Business': 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en',
    'Science': 'https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=en-IN&gl=IN&ceid=IN:en',
    'Health': 'https://news.google.com/rss/headlines/section/topic/HEALTH?hl=en-IN&gl=IN&ceid=IN:en',
    'Politics': 'https://news.google.com/rss/headlines/section/topic/NATION?hl=en-IN&gl=IN&ceid=IN:en',
  },
  'World': {
    'All': 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en',
    'Tech & AI': 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en',
    'Business': 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en',
    'Science': 'https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=en-US&gl=US&ceid=US:en',
    'Health': 'https://news.google.com/rss/headlines/section/topic/HEALTH?hl=en-US&gl=US&ceid=US:en',
    'Politics': 'https://news.google.com/rss/search?q=world+politics+OR+diplomacy+OR+geopolitics+OR+elections&hl=en-US&gl=US&ceid=US:en',
  },
};

/**
 * Normalizes input region or returns null if unsupported
 */
export function normalizeRegion(raw) {
  if (!raw) return 'Tamil Nadu';
  return SUPPORTED_REGIONS.find((r) => r.toLowerCase() === raw.trim().toLowerCase()) || null;
}

/**
 * Normalizes input category or returns null if unsupported
 */
export function normalizeCategory(raw) {
  if (!raw) return 'All';
  return SUPPORTED_CATEGORIES.find((c) => c.toLowerCase() === raw.trim().toLowerCase()) || null;
}

/**
 * Strips HTML tags and unescapes XML entities
 */
export function cleanHtml(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats a relative published time without claiming missing dates are current
 */
export function formatRelativeTime(dateInput, now = Date.now()) {
  if (!dateInput) return 'Date unavailable';
  const time = typeof dateInput === 'number' ? dateInput : new Date(dateInput).getTime();
  if (isNaN(time)) return 'Date unavailable';
  const diffMs = now - time;
  if (diffMs < 0) return 'Just now'; // Future clock skew
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Extracts a verified thumbnail from RSS XML block, or returns null (never fake stock photos)
 */
export function extractThumbnail(xmlBlock) {
  if (!xmlBlock || typeof xmlBlock !== 'string') return null;

  // 1. <media:content> or <media:thumbnail> (url attribute in any position)
  const mediaMatch = xmlBlock.match(/<media:(?:content|thumbnail)[^>]*\surl=["']([^"']+)["'][^>]*>/i);
  if (mediaMatch && mediaMatch[1]) {
    const valid = cleanAndValidateImageUrl(mediaMatch[1]);
    if (valid) return valid;
  }

  // 2. <enclosure> with image type or image file extension
  const enclosureMatch = xmlBlock.match(/<enclosure[^>]*\surl=["']([^"']+)["'][^>]*>/i);
  if (enclosureMatch && enclosureMatch[1]) {
    const isImage = /type=["']image\/[^"']+["']/i.test(enclosureMatch[0]) ||
                    /\.(?:jpe?g|png|webp|avif)(?:\?|$)/i.test(enclosureMatch[1]);
    if (isImage) {
      const valid = cleanAndValidateImageUrl(enclosureMatch[1]);
      if (valid) return valid;
    }
  }

  // 3. <img> tag in description or content:encoded (supports both raw <img and XML-escaped &lt;img)
  const rawDecoded = xmlBlock
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const imgMatches = rawDecoded.matchAll(/<img[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi);
  for (const match of imgMatches) {
    if (match[1]) {
      const valid = cleanAndValidateImageUrl(match[1]);
      if (valid) return valid;
    }
  }

  return null;
}

/**
 * Deduplicates stories using source + normalized alphanumeric headline
 */
export function deduplicateStories(stories) {
  if (!Array.isArray(stories)) return [];
  const seen = new Set();
  const result = [];

  for (const s of stories) {
    const norm = (s.headline || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const sourceKey = (s.source || '').toLowerCase().trim();
    const key = `${sourceKey}:${norm}`;
    const urlKey = s.url ? s.url.split('?')[0].trim() : '';

    if (!norm) continue;
    if (seen.has(key) || (urlKey && seen.has(urlKey))) {
      continue;
    }

    seen.add(key);
    if (urlKey) seen.add(urlKey);
    result.push(s);
  }

  return result;
}

/**
 * Sorts stories by published timestamp descending (newest first).
 * Stories with missing/invalid timestamps are placed at the end honestly.
 */
export function sortStories(stories) {
  if (!Array.isArray(stories)) return [];
  return [...stories].sort((a, b) => {
    if (a.publishedAt && b.publishedAt) {
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    }
    if (a.publishedAt) return -1;
    if (b.publishedAt) return 1;
    return 0;
  });
}

/**
 * Parses RSS XML into structured, verified news items
 */
export function parseRssFeed(xmlText, { region, category, fetchedAt = new Date().toISOString() }) {
  if (!xmlText || typeof xmlText !== 'string') return [];
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const block = match[1];
    const rawTitle = cleanHtml(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
    const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim();
    const rawPubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
    const sourceNode = block.match(/<source([^>]*)>([\s\S]*?)<\/source>/i);
    const sourceName = cleanHtml(sourceNode?.[2]);
    const sourceUrlAttr = sourceNode?.[1]?.match(/url=["']([^"']+)["']/i)?.[1] || '';

    let headline = rawTitle;
    let source = sourceName || 'News Wire';
    let sourceUrl = sourceUrlAttr;

    const lastDash = rawTitle.lastIndexOf(' - ');
    if (lastDash > 0) {
      headline = rawTitle.slice(0, lastDash).trim();
      if (!sourceName) {
        source = rawTitle.slice(lastDash + 3).trim();
      }
    }

    if (!headline) continue;

    // Published timestamp verification
    let publishedAt = null;
    let publishedTimeLabel = 'Date unavailable';
    if (rawPubDate) {
      const parsedTime = new Date(rawPubDate).getTime();
      if (!isNaN(parsedTime)) {
        publishedAt = new Date(parsedTime).toISOString();
        publishedTimeLabel = formatRelativeTime(parsedTime);
      }
    }

    // Extract real thumbnail or null (NO deceptive stock images)
    const image = extractThumbnail(block);

    const hash = crypto.createHash('md5').update(`${region}-${headline}-${source}`).digest('hex').slice(0, 10);
    const id = `news-${region.toLowerCase().replace(/[^a-z]/g, '')}-${hash}`;

    const summary = `Coverage from ${source} for ${region} (${category}): ${headline}. Click to verify claims with Meiora AI or read the original article.`;

    items.push({
      id,
      headline,
      category,
      region,
      source,
      sourceUrl,
      publishedAt,
      publishedTimeLabel,
      fetchedAt,
      image,
      summary,
      url: link,
    });
  }

  const deduplicated = deduplicateStories(items);
  return sortStories(deduplicated);
}

/**
 * Fetches RSS feed from upstream Google News with timeout
 */
export async function fetchStoriesFromRss(region, category) {
  const feedUrl = REGION_CATEGORY_FEEDS[region]?.[category];
  if (!feedUrl) {
    throw new Error(`No feed URL configured for ${region} - ${category}`);
  }

  const fetchedAt = new Date().toISOString();
  const res = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MeioraAI/2.0 NewsIntelligence',
      'Accept': 'application/rss+xml, application/xml, text/xml',
    },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Upstream feed HTTP error ${res.status}`);
  }

  const xml = await res.text();
  const rawStories = parseRssFeed(xml, { region, category, fetchedAt });
  const stories = await enrichStoriesWithThumbnails(rawStories, 6);
  return { stories, fetchedAt, provider: 'GoogleNewsRSS' };
}

/**
 * Primary Upstream Fetcher: Tries NewsAPI.org first (real images!),
 * and seamlessly falls back to Google News RSS if NewsAPI is unconfigured, rate-limited, empty, or fails.
 */
export async function fetchStoriesFromUpstream(region, category) {
  // 1. Try NewsAPI.org if API key is configured
  if (process.env.NEWS_API_KEY && process.env.NEWS_API_KEY.trim()) {
    try {
      const newsApiRes = await fetchNewsApiArticles({ region, category });
      if (newsApiRes.success && Array.isArray(newsApiRes.stories) && newsApiRes.stories.length > 0) {
        return {
          stories: newsApiRes.stories,
          fetchedAt: newsApiRes.fetchedAt,
          provider: 'NewsAPI',
        };
      }
      console.info(`[Discover] NewsAPI bypassed (${newsApiRes.reason}), falling back to Google News RSS`);
    } catch (err) {
      console.warn(`[Discover] NewsAPI error (${err.message}), falling back to Google News RSS`);
    }
  }

  // 2. Fallback to Google News RSS
  return await fetchStoriesFromRss(region, category);
}

/**
 * Express Controller: GET /api/discover/trending
 * Supports ?region=...&category=...&refresh=true
 */
export const getTrendingDiscoveries = async (req, res) => {
  try {
    const rawRegion = req.query.region;
    const rawCategory = req.query.category;
    const forceRefresh = req.query.refresh === 'true' || req.query.refresh === true;

    // Validate region
    const region = normalizeRegion(rawRegion);
    if (!region) {
      return res.status(400).json({
        message: `Invalid region '${rawRegion}'. Supported regions: ${SUPPORTED_REGIONS.join(', ')}`,
      });
    }

    // Validate category
    const category = normalizeCategory(rawCategory);
    if (!category) {
      return res.status(400).json({
        message: `Invalid category '${rawCategory}'. Supported categories: ${SUPPORTED_CATEGORIES.join(', ')}`,
      });
    }

    const cacheKey = `${region}:${category}`;
    const now = Date.now();
    const cached = cache.get(cacheKey);

    const isCacheFresh = !forceRefresh && cached && (now - cached.cacheTime < CACHE_TTL_MS) && cached.stories?.length > 0;

    if (isCacheFresh) {
      return res.json({
        total: cached.stories.length,
        region,
        category,
        provider: cached.provider || 'LiveNews',
        isLive: true,
        isStale: false,
        updatedAt: new Date(cached.cacheTime).toISOString(),
        fetchedAt: cached.fetchedAt,
        stories: cached.stories,
      });
    }

    // Handle concurrent in-flight requests safely to prevent thundering herd
    let fetchPromise = inFlightRequests.get(cacheKey);
    if (!fetchPromise) {
      fetchPromise = fetchStoriesFromUpstream(region, category)
        .then(({ stories, fetchedAt, provider }) => {
          const entry = {
            stories,
            fetchedAt,
            provider: provider || 'LiveNews',
            cacheTime: Date.now(),
            region,
            category,
          };
          cache.set(cacheKey, entry);
          return { entry, error: null };
        })
        .catch((err) => {
          console.warn(`[Discover Feed Error] ${region} - ${category}: ${err.message}`);
          return { entry: null, error: err.message };
        })
        .finally(() => {
          inFlightRequests.delete(cacheKey);
        });

      inFlightRequests.set(cacheKey, fetchPromise);
    }

    const { entry, error } = await fetchPromise;

    if (entry && entry.stories.length > 0) {
      return res.json({
        total: entry.stories.length,
        region,
        category,
        provider: entry.provider || 'LiveNews',
        isLive: true,
        isStale: false,
        updatedAt: new Date(entry.cacheTime).toISOString(),
        fetchedAt: entry.fetchedAt,
        stories: entry.stories,
      });
    }

    // If upstream fetch failed or returned no stories, check if stale cached data exists
    if (cached && cached.stories?.length > 0) {
      return res.json({
        total: cached.stories.length,
        region,
        category,
        provider: cached.provider || 'LiveNews',
        isLive: false,
        isStale: true,
        warning: `Live feed refresh timed out or failed (${error || 'network error'}). Showing previously fetched stories.`,
        updatedAt: new Date(cached.cacheTime).toISOString(),
        fetchedAt: cached.fetchedAt,
        stories: cached.stories,
      });
    }

    // No cache available and upstream failed
    return res.status(503).json({
      message: `Live news feed for ${region} (${category}) is temporarily unavailable. Please try again in a few moments.`,
      region,
      category,
      isLive: false,
      stories: [],
    });
  } catch (error) {
    console.error('Discover controller error:', error);
    return res.status(500).json({
      message: 'Failed to retrieve live news discoveries',
      error: error.message,
    });
  }
};
