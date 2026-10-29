import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Live Web Search Retriever for Grounding AI Analyses
 * Returns real-world web snippets, titles, and authoritative URLs.
 */
export const fetchLiveWebSearchResults = async (query) => {
  if (!query || typeof query !== 'string' || !query.trim()) return [];
  try {
    const cleanQuery = query.trim().slice(0, 150);
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const htmlText = await response.text();
    const $ = cheerio.load(htmlText);
    const results = [];
    $('.result').each((i, el) => {
      if (results.length >= 6) return false;
      const title = $(el).find('.result__title a').text().trim();
      const snippet = $(el).find('.result__snippet').text().trim();
      const href = $(el).find('.result__title a').attr('href') || $(el).find('.result__url').attr('href');
      let cleanUrl = $(el).find('.result__url').text().trim();

      if (href && href.includes('uddg=')) {
        try {
          const match = href.match(/uddg=([^&]+)/);
          if (match) cleanUrl = decodeURIComponent(match[1]);
        } catch {}
      } else if (href && href.startsWith('http')) {
        cleanUrl = href;
      }

      if (title && (snippet || cleanUrl)) {
        results.push({
          title,
          snippet,
          url: cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`,
        });
      }
    });

    return results;
  } catch (err) {
    console.warn(`[LiveSearch] Fallback: web search failed for "${query}":`, err.message);
    return [];
  }
};

export const scrapeUrlContent = async (url) => {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname;

    // Special handler for YouTube URLs using YouTube's official keyless oEmbed API
    if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
      const oembedRes = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { timeout: 10000 });
      const { title, author_name, author_url } = oembedRes.data;
      return {
        title: title || 'YouTube Video',
        content: `YouTube Video Title: ${title}\nChannel: ${author_name} (${author_url})\nVideo URL: ${url}\nFact-check the claims or examine the brand perception associated with this video.`,
        url,
        domain: 'youtube.com',
      };
    }

    // Special handler for Instagram URLs (Bypasses Meta login gate via web footprint grounding)
    if (domain.includes('instagram.com')) {
      const segments = parsed.pathname.split('/').filter(Boolean);
      const isReel = segments[0] === 'reel' || segments[0] === 'p';
      const identifier = segments[1] || segments[0] || '';
      
      const searchQuery = isReel
        ? `site:instagram.com reel ${identifier}`
        : `instagram ${identifier} profile`;

      const searchHits = await fetchLiveWebSearchResults(searchQuery);
      const topHit = searchHits[0];
      const allSnippets = searchHits.map((h) => `• ${h.title}: ${h.snippet}`).join('\n\n');

      const title = topHit?.title || (isReel ? `Instagram Reel (${identifier})` : `Instagram Profile @${identifier}`);
      const content = `Instagram Public ${isReel ? 'Reel / Post' : 'Profile'} Inspection:\nTarget: ${identifier}\nURL: ${url}\n\nLive Web Footprint & Public Metadata:\n${allSnippets || 'Public Instagram content circulating on social media. Perform fact-checking and authenticity inspection.'}\n\nPlease analyze this Instagram claim, examine whether it represents synthetic/manipulated media, and provide a verified fact-check.`;

      return {
        title,
        content: content.slice(0, 8000),
        url,
        domain: 'instagram.com',
      };
    }

    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = response.data;
    const $ = cheerio.load(html);

    // Remove script, style, nav, footer, header tags
    $('script, style, nav, footer, header, aside, .advertisement, .ad, noscript').remove();

    // Extract title
    const title = $('meta[property="og:title"]').attr('content') ||
                  $('h1').first().text().trim() ||
                  $('title').text().trim() ||
                  'Untitled Article';

    // Extract main text
    let content = '';
    const article = $('article');
    if (article.length > 0) {
      content = article.find('p').map((_, el) => $(el).text().trim()).get().join('\n\n');
    }

    if (!content || content.length < 100) {
      content = $('main').find('p').map((_, el) => $(el).text().trim()).get().join('\n\n');
    }

    if (!content || content.length < 100) {
      content = $('p').map((_, el) => $(el).text().trim()).get().join('\n\n');
    }

    return {
      title,
      content: content.slice(0, 8000), // Cap length for AI context
      url,
      domain,
    };
  } catch (error) {
    throw new Error(`Failed to extract content from ${url}: ${error.message}`);
  }
};

