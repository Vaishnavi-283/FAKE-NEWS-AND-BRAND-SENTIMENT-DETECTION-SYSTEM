import dns from 'dns/promises';
import net from 'net';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Two-Tier In-Memory Cache
const positiveCache = new Map(); // url -> { imageUrl: string, expiresAt: number }
const negativeCache = new Map(); // url -> { expiresAt: number }
const inFlightRequests = new Map(); // url -> Promise<string|null>

const POSITIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const NEGATIVE_CACHE_TTL_MS = 15 * 60 * 1000;       // 15 minutes
const REQUEST_TIMEOUT_MS = 2500;                    // Fast 2.5s timeout to prevent delays

// Circuit Breaker for Google 429
const googleCircuitBreaker = {
  isOpen: false,
  openUntil: 0,
  cooldownMs: 10 * 60 * 1000, // 10 minutes cooldown
  failureCount: 0,
};

/**
 * Checks if the Google 429 circuit breaker is active
 */
export function isGoogleCircuitOpen() {
  if (!googleCircuitBreaker.isOpen) return false;
  if (Date.now() >= googleCircuitBreaker.openUntil) {
    googleCircuitBreaker.isOpen = false;
    googleCircuitBreaker.failureCount = 0;
    return false;
  }
  return true;
}

/**
 * Trips the Google circuit breaker upon receiving HTTP 429
 */
export function tripGoogleCircuit(retryAfterSeconds = 600) {
  const sec = parseInt(retryAfterSeconds, 10);
  const durationMs = (!isNaN(sec) && sec > 0) ? Math.max(sec * 1000, 60 * 1000) : googleCircuitBreaker.cooldownMs;
  googleCircuitBreaker.isOpen = true;
  googleCircuitBreaker.openUntil = Date.now() + durationMs;
  googleCircuitBreaker.failureCount++;
}

/**
 * Resets the Google circuit breaker (primarily for tests)
 */
export function resetThumbnailCircuit() {
  googleCircuitBreaker.isOpen = false;
  googleCircuitBreaker.openUntil = 0;
  googleCircuitBreaker.failureCount = 0;
}

/**
 * Returns current circuit breaker status
 */
export function getCircuitBreakerStatus() {
  const open = isGoogleCircuitOpen();
  return {
    isOpen: open,
    remainingMs: open ? Math.max(0, googleCircuitBreaker.openUntil - Date.now()) : 0,
    failureCount: googleCircuitBreaker.failureCount,
  };
}

/**
 * Cleans and validates an image URL, filtering tracking pixels and logos
 */
export function cleanAndValidateImageUrl(rawUrl, baseUrl = null) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let url = rawUrl.trim().replace(/&amp;/g, '&');
  if (url.startsWith('//')) {
    url = 'https:' + url;
  }

  // Resolve relative URLs if baseUrl is provided
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (baseUrl) {
      try {
        url = new URL(url, baseUrl).toString();
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }

  const lower = url.toLowerCase();

  // Filter tracking pixels, spacers, and 1x1 gifs
  if (
    lower.includes('1x1') ||
    lower.includes('pixel') ||
    lower.includes('tracking') ||
    lower.includes('spacer') ||
    lower.includes('beacon') ||
    lower.includes('transparent.gif') ||
    lower.includes('blank.gif')
  ) {
    return null;
  }

  // Filter generic search engine / platform logos
  if (
    lower.includes('google.com/images') ||
    lower.includes('gstatic.com') ||
    lower.includes('favicon.ico') ||
    lower.includes('googlelogo')
  ) {
    return null;
  }

  return url;
}

/**
 * Checks if an IP address is private, loopback, link-local, or reserved
 */
export function isPrivateOrBlockedIP(ip) {
  if (!ip || typeof ip !== 'string') return true;

  const cleanIp = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  const version = net.isIP(cleanIp);
  if (version === 0) return true;

  if (version === 4) {
    const parts = cleanIp.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;

    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 169.254.0.0/16 (Link-local & Cloud Metadata 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.0.0.0/24, 192.0.2.0/24 (Documentation / Test-net)
    if (parts[0] === 192 && parts[1] === 0 && (parts[2] === 0 || parts[2] === 2)) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 198.51.100.0/24, 203.0.113.0/24 (Test-net)
    if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
    if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (parts[0] >= 224) return true;

    return false;
  }

  if (version === 6) {
    const lower = cleanIp.toLowerCase();
    if (lower === '::1' || lower === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
    if (lower === '::' || lower === '0000:0000:0000:0000:0000:0000:0000:0000') return true;
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    return false;
  }

  return true;
}

/**
 * Validates that a URL is a valid, public HTTP/HTTPS URL with safe DNS
 */
export async function validateSafeUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    throw new Error('Invalid URL provided');
  }

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error('Malformed URL syntax');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.`);
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new Error(`Access to internal/private domain '${hostname}' is prohibited.`);
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrBlockedIP(hostname)) {
      throw new Error(`Access to private/internal IP address '${hostname}' is prohibited.`);
    }
    return { url: parsed.toString(), ip: hostname };
  }

  try {
    const lookupResult = await dns.lookup(hostname);
    if (isPrivateOrBlockedIP(lookupResult.address)) {
      throw new Error(`Host '${hostname}' resolves to private/internal IP '${lookupResult.address}', request blocked.`);
    }
    return { url: parsed.toString(), ip: lookupResult.address };
  } catch (err) {
    if (err.message.includes('prohibited') || err.message.includes('blocked')) {
      throw err;
    }
    throw new Error(`DNS resolution failed for host '${hostname}': ${err.message}`);
  }
}

/**
 * Decodes Google News RSS article URLs using batchexecute RPC with 429 protection
 */
export async function decodeGoogleNewsUrl(articleUrl) {
  if (isGoogleCircuitOpen()) {
    return { success: false, circuitOpen: true, message: 'Google circuit breaker is active' };
  }

  try {
    const matches = articleUrl.match(/\/articles\/([a-zA-Z0-9\-_]+)/);
    const gnArtId = matches ? matches[1] : null;

    if (!gnArtId) {
      return { success: false, message: 'Not a recognized Google News article URL' };
    }

    const gUrl = `https://news.google.com/rss/articles/${gnArtId}?hl=en-IN&gl=IN&ceid=IN:en`;
    await validateSafeUrl(gUrl);

    let res;
    try {
      res = await axios.get(gUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: (status) => status >= 200 && status < 500,
      });
    } catch (netErr) {
      if (netErr.response?.status === 429) {
        tripGoogleCircuit(netErr.response.headers?.['retry-after']);
        return { success: false, rateLimited: true, message: 'Google rate limit (429)' };
      }
      return { success: false, message: netErr.message };
    }

    if (res.status === 429) {
      tripGoogleCircuit(res.headers?.['retry-after']);
      return { success: false, rateLimited: true, message: 'Google rate limit (429)' };
    }

    if (res.status !== 200 || !res.data) {
      return { success: false, message: `Google returned HTTP ${res.status}` };
    }

    const html = typeof res.data === 'string' ? res.data : '';
    const $ = cheerio.load(html);
    const div = $('c-wiz > div');
    const signature = div.attr('data-n-a-sg');
    const timestamp = div.attr('data-n-a-ts');

    if (!signature || !timestamp) {
      return { success: false, message: 'Signature or timestamp not found in article page' };
    }

    const rpcPayload = [
      'Fbv4je',
      JSON.stringify([
        'garturlreq',
        [
          ['X', 'X', ['X', 'X'], null, null, 1, 1, 'IN:en', null, 1, null, null, null, null, null, 0, 1],
          'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0,
        ],
        gnArtId,
        timestamp,
        signature,
      ]),
    ];

    const body = new URLSearchParams({
      'f.req': JSON.stringify([[rpcPayload]]),
    });

    let batchRes;
    try {
      batchRes = await axios.post(
        'https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je',
        body.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          timeout: REQUEST_TIMEOUT_MS,
          validateStatus: (status) => status >= 200 && status < 500,
        }
      );
    } catch (batchErr) {
      if (batchErr.response?.status === 429) {
        tripGoogleCircuit(batchErr.response.headers?.['retry-after']);
        return { success: false, rateLimited: true, message: 'Google batch 429' };
      }
      return { success: false, message: batchErr.message };
    }

    if (batchRes.status === 429) {
      tripGoogleCircuit(batchRes.headers?.['retry-after']);
      return { success: false, rateLimited: true, message: 'Google batch 429' };
    }

    const rawText = batchRes.data;
    const lines = typeof rawText === 'string' ? rawText.split('\n') : [];
    const jsonLine = lines.find((line) => line.includes('wrb.fr'));
    if (!jsonLine) {
      return { success: false, message: 'Invalid batchexecute response' };
    }

    const parsedResponse = JSON.parse(jsonLine);
    const innerArray = JSON.parse(parsedResponse[0][2]);
    const decodedUrl = innerArray[1];

    if (decodedUrl && (decodedUrl.startsWith('http://') || decodedUrl.startsWith('https://'))) {
      return { success: true, decodedUrl };
    }

    return { success: false, message: 'Decoded URL was invalid or empty' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Extracts OpenGraph / Twitter thumbnail image from a publisher article URL
 * Includes in-flight deduplication, two-tier caching, and circuit-breaker protection
 */
export async function extractArticleThumbnail(articleUrl) {
  if (!articleUrl || typeof articleUrl !== 'string') return null;

  const now = Date.now();

  // 1. Positive cache check
  const pos = positiveCache.get(articleUrl);
  if (pos && now < pos.expiresAt) {
    return pos.imageUrl;
  }

  // 2. Negative cache check
  const neg = negativeCache.get(articleUrl);
  if (neg && now < neg.expiresAt) {
    return null;
  }

  // 3. In-flight coalescing check
  if (inFlightRequests.has(articleUrl)) {
    return await inFlightRequests.get(articleUrl);
  }

  const fetchPromise = (async () => {
    let targetUrl = articleUrl;

    try {
      await validateSafeUrl(targetUrl);

      // Decode Google News URLs if circuit breaker is not open
      if (targetUrl.includes('news.google.com/rss/articles/') || targetUrl.includes('news.google.com/articles/')) {
        if (isGoogleCircuitOpen()) {
          negativeCache.set(articleUrl, { expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS });
          return null;
        }

        const decoded = await decodeGoogleNewsUrl(targetUrl);
        if (decoded.success && decoded.decodedUrl) {
          targetUrl = decoded.decodedUrl;
          await validateSafeUrl(targetUrl);
        } else {
          negativeCache.set(articleUrl, { expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS });
          return null;
        }
      }

      // Fetch publisher HTML metadata (cap at 64KB, fast timeout)
      const res = await axios.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: REQUEST_TIMEOUT_MS,
        maxContentLength: 64 * 1024,
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const contentType = res.headers['content-type'] || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        negativeCache.set(articleUrl, { expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS });
        return null;
      }

      const html = typeof res.data === 'string' ? res.data : '';
      const $ = cheerio.load(html);

      // Priority: og:image -> twitter:image
      let img = $('meta[property="og:image"]').attr('content') ||
                $('meta[name="og:image"]').attr('content');

      if (!img) {
        img = $('meta[name="twitter:image"]').attr('content') ||
              $('meta[property="twitter:image"]').attr('content') ||
              $('meta[name="twitter:image:src"]').attr('content');
      }

      const validImg = cleanAndValidateImageUrl(img, targetUrl);
      if (validImg) {
        positiveCache.set(articleUrl, { imageUrl: validImg, expiresAt: Date.now() + POSITIVE_CACHE_TTL_MS });
        return validImg;
      }

      negativeCache.set(articleUrl, { expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS });
      return null;
    } catch {
      negativeCache.set(articleUrl, { expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS });
      return null;
    }
  })();

  inFlightRequests.set(articleUrl, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightRequests.delete(articleUrl);
  }
}

/**
 * Enriches a list of news stories with verified thumbnails
 * Runs bounded concurrency and respects circuit breaker
 */
export async function enrichStoriesWithThumbnails(stories, maxToEnrich = 6) {
  if (!Array.isArray(stories) || stories.length === 0) return [];

  // Filter items that don't already have an image
  const targetIndices = [];
  for (let i = 0; i < stories.length && targetIndices.length < maxToEnrich; i++) {
    if (!stories[i].image && stories[i].url) {
      targetIndices.push(i);
    }
  }

  if (targetIndices.length === 0) return stories;

  // Process in small chunks (concurrency: 2) to maintain responsiveness
  const CHUNK_SIZE = 2;
  for (let i = 0; i < targetIndices.length; i += CHUNK_SIZE) {
    const chunk = targetIndices.slice(i, i + CHUNK_SIZE);
    await Promise.allSettled(
      chunk.map(async (idx) => {
        const story = stories[idx];
        const thumb = await extractArticleThumbnail(story.url);
        if (thumb) {
          story.image = thumb;
        }
      })
    );

    // If circuit breaker tripped during this chunk, stop hammering for the rest of the batch
    if (isGoogleCircuitOpen()) {
      break;
    }
  }

  return stories;
}

/**
 * Resets all caches and circuit breaker (useful for testing)
 */
export function resetThumbnailCache() {
  positiveCache.clear();
  negativeCache.clear();
  inFlightRequests.clear();
  resetThumbnailCircuit();
}
