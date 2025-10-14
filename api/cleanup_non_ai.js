import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV1_REST_API_URL,
  token: process.env.KV1_REST_API_TOKEN,
});

const ZSET = "mentions:z";
const SEEN_LINK = "mentions:seen:canon";
const SEEN_ID = "mentions:seen";

// Check if title contains AI-related keywords
function hasAIKeywords(title) {
  const titleLower = (title || "").toLowerCase();
  return (
    titleLower.includes('artificial intelligence') ||
    titleLower.includes('generative ai') ||
    titleLower.includes(' ai ') ||
    titleLower.startsWith('ai ') ||
    titleLower.endsWith(' ai')
  );
}

export default async function handler(req, res) {
  try {
    // Get all articles from Redis
    const allArticles = await redis.zrange(ZSET, 0, -1);

    let scanned = 0;
    let removed = 0;
    const toRemove = [];
    const urlsToRemove = [];
    const idsToRemove = [];

    for (const articleStr of allArticles) {
      scanned++;
      let article;
      try {
        article = JSON.parse(articleStr);
      } catch {
        continue;
      }

      // Only filter Newsletter articles (newsletter RSS feeds have AI/legal keyword filtering)
      const origin = (article.origin || "").toLowerCase();
      if (origin !== "newsletter" && origin !== "newsletter_rss") {
        continue; // Skip non-newsletter articles (Google Alerts, Law360, Meltwater are already filtered)
      }

      // Check if title has AI keywords
      if (!hasAIKeywords(article.title)) {
        toRemove.push(articleStr);
        if (article.canon) urlsToRemove.push(article.canon);
        if (article.id) idsToRemove.push(article.id);
        removed++;
      }
    }

    // Remove articles from sorted set
    if (toRemove.length > 0) {
      // Process in batches of 100
      for (let i = 0; i < toRemove.length; i += 100) {
        const batch = toRemove.slice(i, i + 100);
        await redis.zrem(ZSET, ...batch);
      }
    }

    // Remove from seen sets
    if (urlsToRemove.length > 0) {
      for (let i = 0; i < urlsToRemove.length; i += 100) {
        const batch = urlsToRemove.slice(i, i + 100);
        await redis.srem(SEEN_LINK, ...batch);
      }
    }

    if (idsToRemove.length > 0) {
      for (let i = 0; i < idsToRemove.length; i += 100) {
        const batch = idsToRemove.slice(i, i + 100);
        await redis.srem(SEEN_ID, ...batch);
      }
    }

    res.status(200).json({
      ok: true,
      scanned,
      removed,
      kept: scanned - removed,
      message: `Cleaned up ${removed} non-AI articles from ${scanned} total articles`
    });

  } catch (e) {
    console.error('Cleanup error:', e);
    res.status(500).json({
      ok: false,
      error: e?.message || String(e)
    });
  }
}
