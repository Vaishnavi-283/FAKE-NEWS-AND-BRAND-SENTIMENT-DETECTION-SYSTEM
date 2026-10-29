import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPrivateOrBlockedIP,
  validateSafeUrl,
  extractArticleThumbnail,
  enrichStoriesWithThumbnails,
  resetThumbnailCache,
  cleanAndValidateImageUrl,
  isGoogleCircuitOpen,
  tripGoogleCircuit,
  resetThumbnailCircuit,
  getCircuitBreakerStatus,
  decodeGoogleNewsUrl,
} from '../src/services/thumbnailService.js';
import { extractThumbnail } from '../src/controllers/discoverController.js';

describe('Phase 2.1: Real News Thumbnails & Zero-Cost Pipeline Test Suite', () => {
  beforeEach(() => {
    resetThumbnailCache();
  });

  describe('1. SSRF & Private IP Protection (isPrivateOrBlockedIP)', () => {
    it('1.1: Blocks loopback IPv4 addresses', () => {
      assert.equal(isPrivateOrBlockedIP('127.0.0.1'), true);
      assert.equal(isPrivateOrBlockedIP('127.0.1.1'), true);
      assert.equal(isPrivateOrBlockedIP('127.255.255.254'), true);
    });

    it('1.2: Blocks RFC1918 private IPv4 networks (10/8, 172.16/12, 192.168/16)', () => {
      assert.equal(isPrivateOrBlockedIP('10.0.0.1'), true);
      assert.equal(isPrivateOrBlockedIP('10.254.0.1'), true);
      assert.equal(isPrivateOrBlockedIP('172.16.0.1'), true);
      assert.equal(isPrivateOrBlockedIP('172.31.255.254'), true);
      assert.equal(isPrivateOrBlockedIP('192.168.0.1'), true);
      assert.equal(isPrivateOrBlockedIP('192.168.100.50'), true);
    });

    it('1.3: Blocks cloud metadata and link-local IPv4 (169.254.0.0/16)', () => {
      assert.equal(isPrivateOrBlockedIP('169.254.169.254'), true);
      assert.equal(isPrivateOrBlockedIP('169.254.1.1'), true);
    });

    it('1.4: Blocks loopback and link-local IPv6 addresses', () => {
      assert.equal(isPrivateOrBlockedIP('::1'), true);
      assert.equal(isPrivateOrBlockedIP('::'), true);
      assert.equal(isPrivateOrBlockedIP('fe80::1'), true);
      assert.equal(isPrivateOrBlockedIP('fc00::1'), true);
      assert.equal(isPrivateOrBlockedIP('fd12:3456:789a::1'), true);
    });

    it('1.5: Allows legitimate public IPv4 addresses', () => {
      assert.equal(isPrivateOrBlockedIP('8.8.8.8'), false);
      assert.equal(isPrivateOrBlockedIP('1.1.1.1'), false);
      assert.equal(isPrivateOrBlockedIP('93.184.216.34'), false);
    });
  });

  describe('2. Safe URL Validation (validateSafeUrl)', () => {
    it('2.1: Rejects non-HTTP/HTTPS protocols', async () => {
      await assert.rejects(async () => validateSafeUrl('ftp://example.com/file.jpg'), /Unsupported protocol/);
      await assert.rejects(async () => validateSafeUrl('file:///etc/passwd'), /Unsupported protocol/);
      await assert.rejects(async () => validateSafeUrl('javascript:alert(1)'), /Unsupported protocol/);
    });

    it('2.2: Rejects localhost and internal hostnames', async () => {
      await assert.rejects(async () => validateSafeUrl('http://localhost:5000/api'), /prohibited/);
      await assert.rejects(async () => validateSafeUrl('http://metadata.google.internal/computeMetadata/v1'), /prohibited/);
    });

    it('2.3: Rejects direct loopback and private IP URLs', async () => {
      await assert.rejects(async () => validateSafeUrl('http://127.0.0.1:8080/data'), /prohibited/);
      await assert.rejects(async () => validateSafeUrl('https://192.168.1.1/admin'), /prohibited/);
      await assert.rejects(async () => validateSafeUrl('http://169.254.169.254/latest/meta-data'), /prohibited/);
    });

    it('2.4: Accepts valid public URLs and resolves destination safely', async () => {
      const pub = await validateSafeUrl('https://example.com/index.html');
      assert.ok(pub.url);
      assert.ok(pub.ip);
      assert.equal(isPrivateOrBlockedIP(pub.ip), false);
    });
  });

  describe('3. Image URL Sanitization & Filtering (cleanAndValidateImageUrl)', () => {
    it('3.1: Validates legitimate image URLs and normalizes protocol-relative URLs', () => {
      assert.equal(
        cleanAndValidateImageUrl('https://media.thehindu.com/photo.jpg'),
        'https://media.thehindu.com/photo.jpg'
      );
      assert.equal(
        cleanAndValidateImageUrl('//cdn.ndtv.com/news/pic.png'),
        'https://cdn.ndtv.com/news/pic.png'
      );
    });

    it('3.2: Resolves relative paths against article baseUrl', () => {
      assert.equal(
        cleanAndValidateImageUrl('/static/img/cover.webp', 'https://www.thehindu.com/news/national/article.html'),
        'https://www.thehindu.com/static/img/cover.webp'
      );
    });

    it('3.3: Filters out 1x1 tracking pixels, spacers, and beacons', () => {
      assert.equal(cleanAndValidateImageUrl('https://analytics.tracker.com/1x1.png'), null);
      assert.equal(cleanAndValidateImageUrl('https://news.com/pixel.gif?track=1'), null);
      assert.equal(cleanAndValidateImageUrl('https://pub.org/spacer.gif'), null);
      assert.equal(cleanAndValidateImageUrl('https://pub.org/transparent.gif'), null);
    });

    it('3.4: Filters out Google aggregator logos and favicons', () => {
      assert.equal(cleanAndValidateImageUrl('https://www.google.com/images/branding/googlelogo.png'), null);
      assert.equal(cleanAndValidateImageUrl('https://gstatic.com/images/icons/logo.png'), null);
      assert.equal(cleanAndValidateImageUrl('https://thehindu.com/favicon.ico'), null);
    });
  });

  describe('4. RSS-Level Metadata Extraction (extractThumbnail)', () => {
    it('4.1: Extracts image from <media:content> or <media:thumbnail>', () => {
      const xml1 = '<item><media:content url="https://images.indianexpress.com/metro.jpg" medium="image" /></item>';
      assert.equal(extractThumbnail(xml1), 'https://images.indianexpress.com/metro.jpg');

      const xml2 = '<item><media:thumbnail url="https://img.dtnext.in/tn-scheme.jpg" /></item>';
      assert.equal(extractThumbnail(xml2), 'https://img.dtnext.in/tn-scheme.jpg');
    });

    it('4.2: Extracts image from <enclosure> tag with image type or extension', () => {
      const xml = '<item><enclosure url="https://static.theprint.in/politics.jpg" type="image/jpeg" length="12345" /></item>';
      assert.equal(extractThumbnail(xml), 'https://static.theprint.in/politics.jpg');
    });

    it('4.3: Extracts image from <img> in description', () => {
      const xml = '<item><description>&lt;img src="https://assets.thehindu.com/chennai.jpg" /&gt; Breaking news...</description></item>';
      assert.equal(extractThumbnail(xml), 'https://assets.thehindu.com/chennai.jpg');
    });

    it('4.4: Rejects tracking pixels and returns null when no real image exists', () => {
      const xml = '<item><description>&lt;img src="https://tracking.com/1x1.gif" /&gt; No real image here</description></item>';
      assert.equal(extractThumbnail(xml), null);
    });
  });

  describe('5. Google 429 Circuit Breaker & Rate-Limit Protection', () => {
    it('5.1: Starts closed and trips when tripGoogleCircuit is called', () => {
      resetThumbnailCircuit();
      assert.equal(isGoogleCircuitOpen(), false);

      tripGoogleCircuit(300); // 5 minutes
      assert.equal(isGoogleCircuitOpen(), true);

      const status = getCircuitBreakerStatus();
      assert.equal(status.isOpen, true);
      assert.ok(status.remainingMs > 0);
      assert.equal(status.failureCount, 1);
    });

    it('5.2: Skips Google News resolution immediately without network calls when circuit is open', async () => {
      tripGoogleCircuit(600);
      const res = await decodeGoogleNewsUrl('https://news.google.com/rss/articles/CBMi123456');
      assert.equal(res.success, false);
      assert.equal(res.circuitOpen, true);
    });

    it('5.3: Resets circuit breaker cleanly', () => {
      tripGoogleCircuit(600);
      assert.equal(isGoogleCircuitOpen(), true);

      resetThumbnailCircuit();
      assert.equal(isGoogleCircuitOpen(), false);
    });
  });

  describe('6. Caching & In-Flight Request Coalescing', () => {
    it('6.1: Returns immediately from negative cache for failed URLs', async () => {
      const testUrl = 'https://invalid-dummy-site-404.org/article';
      const t1 = await extractArticleThumbnail(testUrl);
      assert.equal(t1, null);

      // Second call returns immediately from negative cache
      const t2 = await extractArticleThumbnail(testUrl);
      assert.equal(t2, null);
    });

    it('6.2: Coalesces parallel in-flight requests for identical URL', async () => {
      const testUrl = 'https://dummy-in-flight-test.org/news-item';
      const [res1, res2] = await Promise.all([
        extractArticleThumbnail(testUrl),
        extractArticleThumbnail(testUrl),
      ]);
      assert.equal(res1, null);
      assert.equal(res2, null);
    });
  });

  describe('7. enrichStoriesWithThumbnails Batch Execution', () => {
    it('7.1: Preserves existing valid thumbnail on stories', async () => {
      const stories = [
        {
          id: 'story-1',
          headline: 'TN Metro extension announced',
          image: 'https://images.thehindu.com/real-metro.jpg',
          url: 'https://news.google.com/rss/articles/CBMi123',
        },
      ];

      const enriched = await enrichStoriesWithThumbnails(stories, 3);
      assert.equal(enriched[0].image, 'https://images.thehindu.com/real-metro.jpg');
    });

    it('7.2: Safely handles empty or missing stories array', async () => {
      assert.deepEqual(await enrichStoriesWithThumbnails([]), []);
      assert.deepEqual(await enrichStoriesWithThumbnails(null), []);
      assert.deepEqual(await enrichStoriesWithThumbnails(undefined), []);
    });

    it('7.3: Leaves story image as null if extraction cannot find image', async () => {
      const stories = [
        {
          id: 'story-2',
          headline: 'Local Municipal Election Updates',
          image: null,
          url: 'https://invalid-non-existent-domain-999.org/article',
        },
      ];

      const enriched = await enrichStoriesWithThumbnails(stories, 1);
      assert.equal(enriched[0].image, null);
    });
  });
});
