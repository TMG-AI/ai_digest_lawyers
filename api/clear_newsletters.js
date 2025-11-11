// /api/clear_newsletters.js
// Clear all newsletter data from Redis

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV1_REST_API_URL,
  token: process.env.KV1_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    // Get all newsletter keys
    const allKeys = await redis.keys('newsletter:*');

    console.log(`[Clear Newsletters] Found ${allKeys.length} newsletter keys to delete`);

    if (allKeys.length === 0) {
      return res.status(200).json({
        ok: true,
        message: 'No newsletter keys found',
        deleted: 0
      });
    }

    // Delete all newsletter keys
    for (const key of allKeys) {
      await redis.del(key);
    }

    console.log(`[Clear Newsletters] Deleted ${allKeys.length} keys`);

    return res.status(200).json({
      ok: true,
      message: 'All newsletter data cleared',
      deleted: allKeys.length
    });

  } catch (error) {
    console.error('[Clear Newsletters] Error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to clear newsletters'
    });
  }
}
