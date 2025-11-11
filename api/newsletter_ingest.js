// /api/newsletter_ingest.js
// Webhook endpoint to receive AI newsletters from n8n
// Stores newsletters with 30-day TTL for monthly analysis

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV1_REST_API_URL,
  token: process.env.KV1_REST_API_TOKEN,
});

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

    // Generate unique ID for this newsletter
    const newsletterId = `newsletter:${timestamp}:${newsletterName.replace(/\s+/g, '_')}`;

    // Store newsletter in Redis with 30-day TTL (2592000 seconds)
    await redis.setex(newsletterId, 2592000, JSON.stringify({
      fullText,
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
    const newsletterList = existingNewsletters ? JSON.parse(existingNewsletters) : [];
    newsletterList.push(newsletterId);

    // Store date index with same 30-day TTL
    await redis.setex(dateKey, 2592000, JSON.stringify(newsletterList));

    console.log('[Newsletter Ingest] Successfully stored:', {
      id: newsletterId,
      name: newsletterName,
      date,
      textLength: fullText.length
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
