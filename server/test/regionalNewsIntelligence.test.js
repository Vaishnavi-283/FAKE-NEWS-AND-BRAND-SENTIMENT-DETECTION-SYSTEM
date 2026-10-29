process.env.NODE_ENV = 'test';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/server.js';
import {
  parseRssFeed,
  formatRelativeTime,
  deduplicateStories,
  sortStories,
  extractThumbnail,
  normalizeRegion,
  normalizeCategory,
  resetDiscoverCache,
  setDiscoverCache,
} from '../src/controllers/discoverController.js';

describe('Phase 2: Live Regional News Intelligence Test Suite', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Start ephemeral test server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    resetDiscoverCache();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      const mongoose = (await import('mongoose')).default;
      await mongoose.disconnect();
    } catch {}
  });

  // ── 1. REGIONAL FILTERS ──────────────────────────────────────────────────

  test('1.1: Fetch live Tamil Nadu news feed returns 200 and Tamil Nadu stories', async () => {
    const res = await fetch(`${baseUrl}/api/discover/trending?region=Tamil+Nadu&category=All`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.region, 'Tamil Nadu');
    assert.equal(data.category, 'All');
    assert.ok(Array.isArray(data.stories));
    assert.ok(data.stories.length > 0, 'Expected non-empty Tamil Nadu stories');
    for (const story of data.stories) {
      assert.equal(story.region, 'Tamil Nadu');
      assert.ok(story.headline, 'Story must have a headline');
      assert.ok(story.source, 'Story must have a publisher/source');
      assert.ok(story.fetchedAt, 'Story must track fetchedAt timestamp');
    }
  });

  test('1.2: Fetch live India news feed returns 200 and India stories', async () => {
    const res = await fetch(`${baseUrl}/api/discover/trending?region=India&category=All`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.region, 'India');
    assert.ok(Array.isArray(data.stories));
    assert.ok(data.stories.length > 0);
    assert.equal(data.stories[0].region, 'India');
  });

  test('1.3: Fetch live World news feed returns 200 and World stories', async () => {
    const res = await fetch(`${baseUrl}/api/discover/trending?region=World&category=All`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.region, 'World');
    assert.ok(Array.isArray(data.stories));
    assert.ok(data.stories.length > 0);
    assert.equal(data.stories[0].region, 'World');
  });

  // ── 2. REGION + CATEGORY COMBINATIONS ───────────────────────────────────

  test('2.1: Region plus Category (Tamil Nadu + Politics) returns targeted stories', async () => {
    const res = await fetch(`${baseUrl}/api/discover/trending?region=Tamil+Nadu&category=Politics`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.region, 'Tamil Nadu');
    assert.equal(data.category, 'Politics');
    assert.ok(data.stories.length > 0);
  });

  test('2.2: Region plus Category (India + Tech & AI) returns targeted stories', async () => {
    const res = await fetch(`${baseUrl}/api/discover/trending?region=India&category=Tech+%26+AI`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.region, 'India');
    assert.equal(data.category, 'Tech & AI');
    assert.ok(data.stories.length > 0);
  });

  test('2.3: Region plus Category (World + Business) returns targeted stories', async () => {
    const res = await fetch(`${baseUrl}/api/discover/trending?region=World&category=Business`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.region, 'World');
    assert.equal(data.category, 'Business');
    assert.ok(data.stories.length > 0);
  });

  // ── 3. INPUT VALIDATION ──────────────────────────────────────────────────

  test('3.1: Reject invalid region with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/discover/trending?region=Antarctica`);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.message, /invalid region/i);
    assert.match(data.message, /Tamil Nadu, India, World/i);
  });

  test('3.2: Reject invalid category with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/discover/trending?region=India&category=GamingGossip`);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.message, /invalid category/i);
  });

  test('3.3: normalizeRegion and normalizeCategory handle case-insensitivity and whitespace', () => {
    assert.equal(normalizeRegion('  tamil nadu '), 'Tamil Nadu');
    assert.equal(normalizeRegion('india'), 'India');
    assert.equal(normalizeRegion('WORLD'), 'World');
    assert.equal(normalizeRegion('Mars'), null);

    assert.equal(normalizeCategory('tech & ai'), 'Tech & AI');
    assert.equal(normalizeCategory('BUSINESS'), 'Business');
    assert.equal(normalizeCategory('InvalidCategory'), null);
  });

  // ── 4. PUBLISHED-TIME PRESERVATION & FRESHNESS ───────────────────────────

  test('4.1: formatRelativeTime handles recent, hours, days, and invalid dates honestly', () => {
    const now = 1700000000000;
    // 30 seconds ago
    assert.equal(formatRelativeTime(now - 30 * 1000, now), 'Just now');
    // 25 minutes ago
    assert.equal(formatRelativeTime(now - 25 * 60 * 1000, now), '25m ago');
    // 4 hours ago
    assert.equal(formatRelativeTime(now - 4 * 60 * 60 * 1000, now), '4h ago');
    // Yesterday (26 hours ago)
    assert.equal(formatRelativeTime(now - 26 * 60 * 60 * 1000, now), 'Yesterday');
    // 4 days ago
    assert.equal(formatRelativeTime(now - 4 * 24 * 60 * 60 * 1000, now), '4d ago');
    // Missing / invalid dates must NOT be replaced with current time
    assert.equal(formatRelativeTime(null, now), 'Date unavailable');
    assert.equal(formatRelativeTime(undefined, now), 'Date unavailable');
    assert.equal(formatRelativeTime('not-a-date', now), 'Date unavailable');
  });

  test('4.2: parseRssFeed preserves valid publisher pubDate and does not fake missing dates', () => {
    const sampleXml = `
      <rss version="2.0">
        <channel>
          <item>
            <title>Valid Date Story - The Hindu</title>
            <link>https://example.com/story-1</link>
            <pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate>
            <source url="https://thehindu.com">The Hindu</source>
          </item>
          <item>
            <title>Missing Date Story - NDTV</title>
            <link>https://example.com/story-2</link>
            <source url="https://ndtv.com">NDTV</source>
          </item>
        </channel>
      </rss>
    `;

    const fetchedTime = '2026-10-27T06:00:00.000Z';
    const stories = parseRssFeed(sampleXml, { region: 'Tamil Nadu', category: 'All', fetchedAt: fetchedTime });

    assert.equal(stories.length, 2);

    // Item 1: Valid date
    const item1 = stories.find((s) => s.headline === 'Valid Date Story');
    assert.ok(item1);
    assert.equal(item1.publishedAt, '2026-10-26T10:00:00.000Z');
    assert.notEqual(item1.publishedTimeLabel, 'Date unavailable');
    assert.equal(item1.fetchedAt, fetchedTime, 'Separately tracks fetchedAt');

    // Item 2: Missing date must remain null and NOT use fetched time or current time
    const item2 = stories.find((s) => s.headline === 'Missing Date Story');
    assert.ok(item2);
    assert.equal(item2.publishedAt, null, 'Must NOT replace missing publication date with current date');
    assert.equal(item2.publishedTimeLabel, 'Date unavailable');
    assert.equal(item2.fetchedAt, fetchedTime);
  });

  // ── 5. DEDUPLICATION AND SORTING ─────────────────────────────────────────

  test('5.1: deduplicateStories eliminates duplicate headlines from same/different links', () => {
    const duplicates = [
      { headline: 'Breaking: Metro Expansion Approved in Chennai', source: 'The Hindu', url: 'https://news.com/a' },
      { headline: 'Breaking: Metro Expansion Approved in Chennai!', source: 'The Hindu', url: 'https://news.com/a?ref=rss' },
      { headline: 'Unique Story About Clean Energy', source: 'The Hindu', url: 'https://news.com/b' },
    ];
    const clean = deduplicateStories(duplicates);
    assert.equal(clean.length, 2, 'Must deduplicate redundant headline');
    assert.equal(clean[0].headline, 'Breaking: Metro Expansion Approved in Chennai');
    assert.equal(clean[1].headline, 'Unique Story About Clean Energy');
  });

  test('5.2: sortStories places newest publication timestamps first and nulls at the end', () => {
    const unsorted = [
      { headline: 'Older Story', publishedAt: '2026-10-25T10:00:00.000Z' },
      { headline: 'No Date Story', publishedAt: null },
      { headline: 'Newest Story', publishedAt: '2026-10-26T18:00:00.000Z' },
    ];
    const sorted = sortStories(unsorted);
    assert.equal(sorted[0].headline, 'Newest Story');
    assert.equal(sorted[1].headline, 'Older Story');
    assert.equal(sorted[2].headline, 'No Date Story');
  });

  // ── 6. IMAGE AND ATTRIBUTION HONESTY ─────────────────────────────────────

  test('6.1: extractThumbnail returns real media URL when available and null otherwise', () => {
    const withMedia = '<item><title>A</title><media:content url="https://img.com/real.jpg" /></item>';
    assert.equal(extractThumbnail(withMedia), 'https://img.com/real.jpg');

    const withEnclosure = '<item><title>B</title><enclosure url="https://img.com/enc.png" type="image/png" /></item>';
    assert.equal(extractThumbnail(withEnclosure), 'https://img.com/enc.png');

    const withoutImage = '<item><title>C</title><description>Plain description text</description></item>';
    assert.equal(extractThumbnail(withoutImage), null, 'Must be null when no real thumbnail exists');
  });

  test('6.2: parseRssFeed does NOT assign random Unsplash stock photos', () => {
    const xmlNoImages = `
      <rss version="2.0">
        <channel>
          <item>
            <title>Text Only Article - PIB</title>
            <link>https://pib.gov.in/1</link>
            <pubDate>Mon, 26 Oct 2026 12:00:00 GMT</pubDate>
            <source url="https://pib.gov.in">PIB</source>
          </item>
        </channel>
      </rss>
    `;
    const stories = parseRssFeed(xmlNoImages, { region: 'India', category: 'Politics' });
    assert.equal(stories.length, 1);
    assert.equal(stories[0].image, null, 'Must NOT inject fake stock photos');
    assert.equal(stories[0].source, 'PIB');
    assert.equal(stories[0].sourceUrl, 'https://pib.gov.in');
  });

  // ── 7. REFRESH & STALE CACHE BEHAVIOUR ────────────────────────────────────

  test('7.1: Stale cache fallback returns warning when upstream fails', async () => {
    // Manually prime cache with a known story for a test key
    const testKey = 'Tamil Nadu:Health';
    setDiscoverCache(testKey, {
      stories: [
        {
          id: 'test-cached-1',
          headline: 'Previously Cached Health Advisory',
          source: 'Health Dept',
          region: 'Tamil Nadu',
          category: 'Health',
          publishedAt: '2026-10-26T08:00:00.000Z',
          publishedTimeLabel: 'Yesterday',
          fetchedAt: '2026-10-26T09:00:00.000Z',
          image: null,
          url: 'https://example.com/cached',
        },
      ],
      cacheTime: Date.now() - 60000,
      fetchedAt: '2026-10-26T09:00:00.000Z',
      region: 'Tamil Nadu',
      category: 'Health',
    });

    // Make request without refresh -> served from cache
    const res = await fetch(`${baseUrl}/api/discover/trending?region=Tamil+Nadu&category=Health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.stories.length, 1);
    assert.equal(data.stories[0].headline, 'Previously Cached Health Advisory');
  });
});
