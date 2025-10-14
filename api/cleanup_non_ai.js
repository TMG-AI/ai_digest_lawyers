import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV1_REST_API_URL,
  token: process.env.KV1_REST_API_TOKEN,
});

const ZSET = "mentions:z";
const SEEN_LINK = "mentions:seen:canon";
const SEEN_ID = "mentions:seen";

// Check if title/content contains AI keywords
const AI_KEYWORDS = [
  "artificial intelligence",
  "generative ai",
  "ai",
  "chatgpt",
  "claude",
  "microsoft copilot",
  "copilot",
  "harvey",
  "harvey ai",
  "cocounsel",
  "lexis+ ai",
  "westlaw precision ai",
  "machine learning",
  "large language model",
  "llm"
];

function hasAIKeywords(text) {
  const textLower = (text || "").toLowerCase();

  for (const keyword of AI_KEYWORDS) {
    // Use word boundary regex to avoid false positives like "China" matching "ai"
    // Escape special regex characters in the keyword
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');

    if (regex.test(text)) {
      return true;
    }
  }

  return false;
}

export default async function handler(req, res) {
  try {
    // Get articles from last 14 days (matching RETENTION_DAYS)
    const now = Math.floor(Date.now() / 1000);
    const fourteenDaysAgo = now - (14 * 24 * 60 * 60);

    const allArticles = await redis.zrange(ZSET, fourteenDaysAgo, now, { byScore: true });

    let scanned = 0;
    let removed = 0;
    let newsletterCount = 0;
    const toRemove = [];
    const urlsToRemove = [];
    const idsToRemove = [];
    const debugInfo = [];

    for (const articleStr of allArticles) {
      scanned++;
      let article;
      try {
        article = JSON.parse(articleStr);
      } catch {
        continue;
      }

      // Debug: Check what origins we're actually seeing
      const rawOrigin = article.origin || "";
      const origin = rawOrigin.toLowerCase();

      // Log first 5 articles to see what origins exist
      if (scanned <= 5) {
        console.log(`Article ${scanned}: origin="${rawOrigin}" (lowercase="${origin}")`);
      }

      // Only filter Newsletter articles (newsletter RSS feeds have AI/legal keyword filtering)
      if (origin !== "newsletter" && origin !== "newsletter_rss") {
        continue; // Skip non-newsletter articles (Google Alerts, Law360, Meltwater are already filtered)
      }

      newsletterCount++;

      // Check if title or summary has AI keywords
      const titleAndSummary = `${article.title || ""} ${article.summary || ""}`;
      const hasKeywords = hasAIKeywords(titleAndSummary);

      // Debug: log first 10 newsletter articles
      if (newsletterCount <= 10) {
        const matchedKeywords = [];
        for (const keyword of AI_KEYWORDS) {
          const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
          if (regex.test(titleAndSummary)) {
            matchedKeywords.push(keyword);
          }
        }

        debugInfo.push({
          title: article.title,
          origin: article.origin,
          hasKeywords,
          matchedKeywords: matchedKeywords.length > 0 ? matchedKeywords : "NONE",
          titlePreview: (article.title || "").substring(0, 100),
          summaryPreview: (article.summary || "").substring(0, 150)
        });
      }

      if (!hasKeywords) {
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
      newsletterCount,
      removed,
      kept: scanned - removed,
      message: `Cleaned up ${removed} non-AI articles from ${scanned} total articles (${newsletterCount} newsletter articles)`,
      debugInfo
    });

  } catch (e) {
    console.error('Cleanup error:', e);
    res.status(500).json({
      ok: false,
      error: e?.message || String(e)
    });
  }
}
