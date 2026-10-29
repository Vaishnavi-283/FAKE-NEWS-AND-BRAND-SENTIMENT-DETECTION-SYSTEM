import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  buildNewsApiQuery,
  fetchNewsApiArticles,
  NEWS_API_QUERIES,
} from '../src/services/newsApiService.js';
import {
  fetchStoriesFromUpstream,
  resetDiscoverCache,
} from '../src/controllers/discoverController.js';

describe('NewsAPI.org Integration & Fallback Test Suite', () => {
  beforeEach(() => {
    resetDiscoverCache();
  });

  describe('1. Query Formulation (buildNewsApiQuery)', () => {
    it('1.1: Generates targeted query for Tamil Nadu across categories', () => {
      const qAll = buildNewsApiQuery('Tamil Nadu', 'All');
      assert.ok(qAll.includes('Tamil Nadu'));
      assert.ok(qAll.includes('Chennai'));

      const qTech = buildNewsApiQuery('Tamil Nadu', 'Tech & AI');
      assert.ok(qTech.includes('technology') || qTech.includes('AI'));

      const qPol = buildNewsApiQuery('Tamil Nadu', 'Politics');
      assert.ok(qPol.includes('DMK') || qPol.includes('AIADMK') || qPol.includes('politics'));
    });

    it('1.2: Generates targeted query for India across categories', () => {
      const qAll = buildNewsApiQuery('India', 'All');
      assert.equal(qAll, 'India');

      const qBiz = buildNewsApiQuery('India', 'Business');
      assert.ok(qBiz.includes('economy') || qBiz.includes('business'));
    });

    it('1.3: Generates targeted query for World across categories', () => {
      const qAll = buildNewsApiQuery('World', 'All');
      assert.ok(qAll.includes('world') || qAll.includes('international'));

      const qSci = buildNewsApiQuery('World', 'Science');
      assert.ok(qSci.includes('science') || qSci.includes('space'));
    });
  });

  describe('2. Authentication & Missing API Key Handling', () => {
    it('2.1: Gracefully returns NO_API_KEY when key is empty or missing without crashing', async () => {
      const res = await fetchNewsApiArticles({
        region: 'Tamil Nadu',
        category: 'All',
        apiKey: '',
      });

      assert.equal(res.success, false);
      assert.equal(res.reason, 'NO_API_KEY');
      assert.deepEqual(res.stories, []);
    });

    it('2.2: Rejects whitespace-only API keys', async () => {
      const res = await fetchNewsApiArticles({
        region: 'India',
        category: 'Tech & AI',
        apiKey: '   ',
      });

      assert.equal(res.success, false);
      assert.equal(res.reason, 'NO_API_KEY');
    });
  });

  describe('3. NewsAPI Response Parsing & Image Normalization (Mock Server)', () => {
    let mockServer;
    let mockPort;
    let mockBaseUrl;
    let mockResponse = {};
    let mockStatusCode = 200;
    let lastReceivedHeaders = {};

    beforeEach(async () => {
      if (mockServer) {
        mockServer.close();
      }

      mockServer = http.createServer((req, res) => {
        lastReceivedHeaders = req.headers;
        res.writeHead(mockStatusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockResponse));
      });

      await new Promise((resolve) => {
        mockServer.listen(0, '127.0.0.1', () => {
          mockPort = mockServer.address().port;
          mockBaseUrl = `http://127.0.0.1:${mockPort}`;
          resolve();
        });
      });
    });

    it('3.1: Normalizes valid articles and sets urlToImage to story.image', async () => {
      mockStatusCode = 200;
      mockResponse = {
        status: 'ok',
        totalResults: 2,
        articles: [
          {
            source: { id: 'the-hindu', name: 'The Hindu' },
            author: 'Staff Reporter',
            title: 'Chennai Metro Phase 2 tunneling reaches milestone - The Hindu',
            description: 'Major progress reported on Chennai metro line.',
            url: 'https://www.thehindu.com/news/cities/chennai/metro-tbm.html',
            urlToImage: 'https://media.thehindu.com/news/metro-photo.jpg',
            publishedAt: '2026-10-27T10:00:00Z',
            content: 'Full story content here...',
          },
          {
            source: { id: null, name: 'DT Next' },
            title: 'Tamil Nadu solar energy capacity increases',
            description: 'State achieves new solar output record.',
            url: 'https://www.dtnext.in/news/solar.html',
            urlToImage: 'https://img.dtnext.in/solar-park.png',
            publishedAt: '2026-10-27T08:30:00Z',
          },
        ],
      };

      // Mock fetch in global scope for testing
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, opts) => {
        if (url.includes('newsapi.org')) {
          const localUrl = url.replace('https://newsapi.org', mockBaseUrl);
          return originalFetch(localUrl, opts);
        }
        return originalFetch(url, opts);
      };

      try {
        const res = await fetchNewsApiArticles({
          region: 'Tamil Nadu',
          category: 'Tech & AI',
          apiKey: 'test-valid-newsapi-key',
        });

        assert.equal(res.success, true);
        assert.equal(res.provider, 'NewsAPI');
        assert.equal(res.stories.length, 2);

        // Check image normalization
        assert.equal(res.stories[0].image, 'https://media.thehindu.com/news/metro-photo.jpg');
        assert.equal(res.stories[1].image, 'https://img.dtnext.in/solar-park.png');

        // Check headline clean up
        assert.equal(res.stories[0].headline, 'Chennai Metro Phase 2 tunneling reaches milestone');
        assert.equal(res.stories[0].source, 'The Hindu');

        // Check authentication header X-Api-Key used
        assert.equal(lastReceivedHeaders['x-api-key'], 'test-valid-newsapi-key');
      } finally {
        globalThis.fetch = originalFetch;
        mockServer.close();
      }
    });

    it('3.2: Filters out removed articles and invalid image URLs', async () => {
      mockStatusCode = 200;
      mockResponse = {
        status: 'ok',
        articles: [
          {
            title: '[Removed]',
            description: '[Removed]',
            url: 'https://removed.com',
          },
          {
            source: { name: 'Indian Express' },
            title: 'New AI research institute launched in Chennai',
            url: 'https://indianexpress.com/article/ai.html',
            urlToImage: 'https://tracking.com/1x1.png', // Tracking pixel filtered
            publishedAt: '2026-10-27T09:00:00Z',
          },
        ],
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, opts) => {
        if (url.includes('newsapi.org')) {
          return originalFetch(url.replace('https://newsapi.org', mockBaseUrl), opts);
        }
        return originalFetch(url, opts);
      };

      try {
        const res = await fetchNewsApiArticles({
          region: 'Tamil Nadu',
          category: 'Science',
          apiKey: 'test-valid-newsapi-key',
        });

        assert.equal(res.success, true);
        assert.equal(res.stories.length, 1);
        assert.equal(res.stories[0].headline, 'New AI research institute launched in Chennai');
        // Tracking pixel sanitized to null so fallback banner renders cleanly
        assert.equal(res.stories[0].image, null);
      } finally {
        globalThis.fetch = originalFetch;
        mockServer.close();
      }
    });

    it('3.3: Handles zero articles gracefully', async () => {
      mockStatusCode = 200;
      mockResponse = {
        status: 'ok',
        totalResults: 0,
        articles: [],
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, opts) => {
        if (url.includes('newsapi.org')) {
          return originalFetch(url.replace('https://newsapi.org', mockBaseUrl), opts);
        }
        return originalFetch(url, opts);
      };

      try {
        const res = await fetchNewsApiArticles({
          region: 'India',
          category: 'Health',
          apiKey: 'test-valid-newsapi-key',
        });

        assert.equal(res.success, false);
        assert.equal(res.reason, 'ZERO_ARTICLES');
      } finally {
        globalThis.fetch = originalFetch;
        mockServer.close();
      }
    });

    it('3.4: Handles 401 Unauthorized (Invalid API Key) without throwing', async () => {
      mockStatusCode = 401;
      mockResponse = {
        status: 'error',
        code: 'apiKeyInvalid',
        message: 'Your API key is invalid or incorrect.',
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, opts) => {
        if (url.includes('newsapi.org')) {
          return originalFetch(url.replace('https://newsapi.org', mockBaseUrl), opts);
        }
        return originalFetch(url, opts);
      };

      try {
        const res = await fetchNewsApiArticles({
          region: 'World',
          category: 'Politics',
          apiKey: 'bad-key',
        });

        assert.equal(res.success, false);
        assert.equal(res.status, 401);
        assert.equal(res.reason, 'INVALID_API_KEY');
      } finally {
        globalThis.fetch = originalFetch;
        mockServer.close();
      }
    });

    it('3.5: Handles 429 Rate Limited (Quota Exhausted) gracefully', async () => {
      mockStatusCode = 429;
      mockResponse = {
        status: 'error',
        code: 'rateLimited',
        message: 'You have made too many requests in a given amount of time.',
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, opts) => {
        if (url.includes('newsapi.org')) {
          return originalFetch(url.replace('https://newsapi.org', mockBaseUrl), opts);
        }
        return originalFetch(url, opts);
      };

      try {
        const res = await fetchNewsApiArticles({
          region: 'India',
          category: 'Business',
          apiKey: 'quota-exceeded-key',
        });

        assert.equal(res.success, false);
        assert.equal(res.status, 429);
        assert.equal(res.reason, 'RATE_LIMITED');
      } finally {
        globalThis.fetch = originalFetch;
        mockServer.close();
      }
    });
  });

  describe('4. Upstream Fallback to Google News RSS', () => {
    it('4.1: Automatically falls back to Google News RSS when NEWS_API_KEY is not set', async () => {
      const prevKey = process.env.NEWS_API_KEY;
      delete process.env.NEWS_API_KEY;

      try {
        const result = await fetchStoriesFromUpstream('Tamil Nadu', 'All');
        assert.ok(result.stories);
        assert.ok(result.stories.length > 0);
        assert.equal(result.provider, 'GoogleNewsRSS');
      } finally {
        if (prevKey) process.env.NEWS_API_KEY = prevKey;
      }
    });
  });
});
