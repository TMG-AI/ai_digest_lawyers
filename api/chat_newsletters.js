// /api/chat_newsletters.js
// AI Assistant for analyzing AI newsletters with focus on legal insights

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV1_REST_API_URL,
  token: process.env.KV1_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  try {
    const { question, specificDate } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Fetch newsletters - either for specific date or all from past month
    let newsletters = [];

    if (specificDate) {
      // Get newsletters for specific date
      const dateKey = `newsletter:date:${specificDate}`;
      const dateData = await redis.get(dateKey);

      let newsletterIds = [];
      if (dateData) {
        // Check if already an array (Upstash auto-deserializes)
        if (Array.isArray(dateData)) {
          newsletterIds = dateData;
        } else if (typeof dateData === 'string') {
          try {
            newsletterIds = JSON.parse(dateData);
            if (!Array.isArray(newsletterIds)) {
              newsletterIds = [];
            }
          } catch (parseError) {
            console.error(`[Chat Newsletters] Failed to parse ${dateKey}:`, parseError.message);
            newsletterIds = [];
          }
        }
      }

      const fetchedNewsletters = await Promise.all(
        newsletterIds.map(async (id) => {
          try {
            const data = await redis.get(id);
            if (!data) return null;
            // Upstash auto-deserializes, so data might already be an object
            const newsletter = typeof data === 'string' ? JSON.parse(data) : data;
            return { id, ...newsletter };
          } catch (error) {
            console.error(`[Chat Newsletters] Failed to parse newsletter ${id}:`, error.message);
            return null;
          }
        })
      );

      newsletters = fetchedNewsletters.filter(n => n !== null);

    } else {
      // Get all newsletters from past month
      const allKeys = await redis.keys('newsletter:date:*');

      // Fetch all newsletters
      for (const dateKey of allKeys) {
        try {
          const dateData = await redis.get(dateKey);

          let newsletterIds = [];
          if (dateData) {
            // Check if already an array (Upstash auto-deserializes)
            if (Array.isArray(dateData)) {
              newsletterIds = dateData;
            } else if (typeof dateData === 'string') {
              try {
                newsletterIds = JSON.parse(dateData);
                if (!Array.isArray(newsletterIds)) {
                  newsletterIds = [];
                }
              } catch (parseError) {
                console.error(`[Chat Newsletters] Failed to parse ${dateKey}:`, parseError.message);
                newsletterIds = [];
              }
            }
          }

          const fetchedNewsletters = await Promise.all(
            newsletterIds.map(async (id) => {
              try {
                const data = await redis.get(id);
                if (!data) return null;
                // Upstash auto-deserializes, so data might already be an object
                const newsletter = typeof data === 'string' ? JSON.parse(data) : data;
                return { id, ...newsletter };
              } catch (error) {
                console.error(`[Chat Newsletters] Failed to parse newsletter ${id}:`, error.message);
                return null;
              }
            })
          );

          newsletters.push(...fetchedNewsletters.filter(n => n !== null));
        } catch (error) {
          console.error(`[Chat Newsletters] Error processing ${dateKey}:`, error.message);
        }
      }
    }

    // Sort by timestamp descending (most recent first)
    newsletters.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    console.log(`Chat Newsletters: Loaded ${newsletters.length} newsletters for analysis`);

    if (newsletters.length === 0) {
      return res.status(200).json({
        ok: true,
        question,
        answer: 'No newsletters found for the specified time period.',
        newsletters_analyzed: 0,
        sources: [],
        timestamp: new Date().toISOString()
      });
    }

    // Prepare newsletter context with numbered citations
    const newsletterContext = newsletters.map((n, idx) => ({
      id: idx + 1, // Citation number [1], [2], [3], etc.
      newsletterName: n.newsletterName,
      subject: n.subject,
      date: n.date,
      from: n.from,
      // Include first 1500 characters of full text for context
      excerpt: n.fullText?.substring(0, 1500) + (n.fullText?.length > 1500 ? '...' : '')
    }));

    // Count newsletters by name
    const nameCounts = newsletters.reduce((acc, n) => {
      const name = n.newsletterName || 'unknown';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});

    const sourceBreakdown = Object.entries(nameCounts)
      .map(([name, count]) => `- ${name}: ${count} newsletters`)
      .join('\n');

    // Create OpenAI chat completion
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert legal technology analyst helping lawyers and law firms stay informed about AI developments. You have access to ${newsletters.length} AI newsletters from the past month.

Newsletter breakdown:
${sourceBreakdown}

Your primary focus is to extract and highlight information relevant to legal practice:
- **AI regulations and compliance** that impact law firms or lawyers
- **Legal ethics** considerations with AI tools
- **AI applications** in legal practice (research, document review, contract analysis, etc.)
- **Case law** or precedents involving AI
- **Data privacy and security** concerns for law firms
- **Client communication** and AI transparency issues
- **Risk management** for law firms using AI tools
- **Professional responsibility** and AI usage
- **Market developments** in legal tech AI products
- **Competitive intelligence** - what other firms are doing with AI

When answering questions:
- Prioritize content that's directly applicable to lawyers and law firms
- If asked for a summary, focus on legal implications even if newsletters aren't law-focused
- Extract regulatory updates, compliance requirements, and ethical considerations
- Identify risks and opportunities for legal practice

CITATION REQUIREMENTS:
- Use inline citations [1], [2], [3] to reference specific newsletters
- Place citations immediately after statements from that newsletter
- Use the newsletter's "id" field from the context as the citation number
- Multiple newsletters can be cited: [1][2][3]
- Every significant claim should have at least one citation

FORMATTING REQUIREMENTS:
- Do NOT include title headers - start directly with the content
- Use **bold text** for key terms and important points
- Use bullet points (- ) for lists when listing 3+ related items
- Keep paragraphs concise (2-3 sentences max)
- Write in a flowing narrative style
- Prioritize readability and natural flow

Available newsletters:
${JSON.stringify(newsletterContext, null, 2)}`
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0.7,
        max_tokens: 2500
      })
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, error);
      return res.status(500).json({
        error: `OpenAI API error: ${openaiResponse.status}`,
        details: error
      });
    }

    const data = await openaiResponse.json();
    const answer = data.choices[0]?.message?.content || 'No response generated';

    res.status(200).json({
      ok: true,
      question,
      answer,
      newsletters_analyzed: newsletters.length,
      sources: newsletterContext, // Return sources for citation rendering
      specificDate: specificDate || null,
      timestamp: new Date().toISOString()
    });

  } catch (e) {
    console.error('Chat newsletters error:', e);
    res.status(500).json({
      ok: false,
      error: e?.message || String(e)
    });
  }
}
