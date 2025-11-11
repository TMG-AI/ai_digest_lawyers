// /api/newsletter_ingest.js
// Webhook endpoint to receive AI newsletters from n8n
// Stores newsletters with 30-day TTL for monthly analysis

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV1_REST_API_URL,
  token: process.env.KV1_REST_API_TOKEN,
});

// Clean newsletter text by removing image URLs and markup
function cleanNewsletterText(text) {
  if (!text) return text;

  let cleaned = text;

  // Remove "View image:" lines with URLs
  cleaned = cleaned.replace(/View image:\s*\(https?:\/\/[^\)]+\)/gi, '');

  // Remove "Follow image link:" lines with URLs
  cleaned = cleaned.replace(/Follow image link:\s*\(https?:\/\/[^\)]+\)/gi, '');

  // Remove "Caption:" lines (usually empty or just whitespace after)
  cleaned = cleaned.replace(/Caption:\s*$/gmi, '');

  // Clean up multiple consecutive newlines (more than 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Trim leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { fullText, newsletterName, subject, from, timestamp, date } = req.body;

    // Validate required fields
    if (!fullText || !newsletterName || !timestamp || !date) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: fullText, newsletterName, timestamp, and date are required'
      });
    }

    // Clean the newsletter text before storing
    const cleanedText = cleanNewsletterText(fullText);

    // Generate unique ID for this newsletter
    const newsletterId = `newsletter:${timestamp}:${newsletterName.replace(/\s+/g, '_')}`;

    // Store newsletter in Redis with 30-day TTL (2592000 seconds)
    await redis.setex(newsletterId, 2592000, JSON.stringify({
      fullText: cleanedText,
      newsletterName,
      subject: subject || '',
      from: from || '',
      timestamp,
      date,
      ingested: new Date().toISOString()
    }));

    // Also maintain a date index for efficient querying
    const dateKey = `newsletter:date:${date}`;
    const existingNewsletters = await redis.get(dateKey);

    console.log('[Newsletter Ingest] Date key data:', {
      dateKey,
      existingType: typeof existingNewsletters,
      existingValue: existingNewsletters
    });

    let newsletterList = [];
    if (existingNewsletters) {
      // Check if it's already an array (shouldn't happen with redis.get, but just in case)
      if (Array.isArray(existingNewsletters)) {
        newsletterList = existingNewsletters;
      } else if (typeof existingNewsletters === 'string') {
        try {
          newsletterList = JSON.parse(existingNewsletters);
          if (!Array.isArray(newsletterList)) {
            console.error('[Newsletter Ingest] Parsed data is not an array, resetting to empty array');
            newsletterList = [];
          }
        } catch (parseError) {
          console.error('[Newsletter Ingest] Failed to parse existing newsletters:', parseError.message);
          console.error('[Newsletter Ingest] Raw value:', existingNewsletters);
          // Start fresh with empty array if data is corrupted
          newsletterList = [];
        }
      }
    }

    newsletterList.push(newsletterId);

    // Store date index with same 30-day TTL
    const jsonToStore = JSON.stringify(newsletterList);
    console.log('[Newsletter Ingest] Storing date index:', {
      dateKey,
      count: newsletterList.length,
      jsonLength: jsonToStore.length
    });

    await redis.setex(dateKey, 2592000, jsonToStore);

    console.log('[Newsletter Ingest] Successfully stored:', {
      id: newsletterId,
      name: newsletterName,
      date,
      originalLength: fullText.length,
      cleanedLength: cleanedText.length,
      removed: fullText.length - cleanedText.length
    });

    return res.status(200).json({
      ok: true,
      message: 'Newsletter ingested successfully',
      id: newsletterId,
      date
    });

  } catch (error) {
    console.error('[Newsletter Ingest] Error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to ingest newsletter'
    });
  }
}
