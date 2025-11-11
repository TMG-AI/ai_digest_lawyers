// /api/get_newsletters.js
// Fetch AI newsletters by date or all from past month

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { date } = req.query;

    if (date) {
      // Fetch newsletters for specific date
      const dateKey = `newsletter:date:${date}`;
      const newsletterIds = await kv.get(dateKey) || [];

      if (newsletterIds.length === 0) {
        return res.status(200).json({
          ok: true,
          date,
          newsletters: [],
          count: 0
        });
      }

      // Fetch all newsletters for this date
      const newsletters = await Promise.all(
        newsletterIds.map(async (id) => {
          const newsletter = await kv.get(id);
          return newsletter ? { id, ...newsletter } : null;
        })
      );

      // Filter out any null values (deleted newsletters)
      const validNewsletters = newsletters.filter(n => n !== null);

      return res.status(200).json({
        ok: true,
        date,
        newsletters: validNewsletters,
        count: validNewsletters.length
      });

    } else {
      // Fetch all newsletters from past month, grouped by date
      // Scan for all newsletter date keys
      const allKeys = [];
      let cursor = 0;

      do {
        const result = await kv.scan(cursor, {
          match: 'newsletter:date:*',
          count: 100
        });
        cursor = result[0];
        allKeys.push(...result[1]);
      } while (cursor !== 0);

      if (allKeys.length === 0) {
        return res.status(200).json({
          ok: true,
          dates: [],
          totalCount: 0
        });
      }

      // Fetch newsletters for each date
      const dateGroups = await Promise.all(
        allKeys.map(async (dateKey) => {
          const date = dateKey.replace('newsletter:date:', '');
          const newsletterIds = await kv.get(dateKey) || [];

          const newsletters = await Promise.all(
            newsletterIds.map(async (id) => {
              const newsletter = await kv.get(id);
              return newsletter ? { id, ...newsletter } : null;
            })
          );

          return {
            date,
            newsletters: newsletters.filter(n => n !== null)
          };
        })
      );

      // Sort by date descending (most recent first)
      dateGroups.sort((a, b) => {
        const dateA = new Date(a.newsletters[0]?.timestamp || 0);
        const dateB = new Date(b.newsletters[0]?.timestamp || 0);
        return dateB - dateA;
      });

      const totalCount = dateGroups.reduce((sum, group) => sum + group.newsletters.length, 0);

      return res.status(200).json({
        ok: true,
        dates: dateGroups,
        totalCount
      });
    }

  } catch (error) {
    console.error('[Get Newsletters] Error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to fetch newsletters'
    });
  }
}
