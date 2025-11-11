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

    // Prepare newsletter context with descriptive citations
    // Send full text for comprehensive analysis (truncate only if extremely long)
    const newsletterContext = newsletters.map((n, idx) => {
      const fullText = n.fullText || '';
      // Only truncate if over 15000 characters (most newsletters are much shorter)
      const content = fullText.length > 15000 ? fullText.substring(0, 15000) + '... [truncated]' : fullText;

      // Create a descriptive citation format: "Newsletter Name, Date"
      const citationId = `${n.newsletterName}, ${n.date}`;

      return {
        id: idx + 1, // For ordering
        citationId: citationId, // Descriptive citation to use
        newsletterName: n.newsletterName,
        subject: n.subject,
        date: n.date,
        from: n.from,
        fullContent: content
      };
    });

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

YOUR MISSION: Think like a legal technology advisor. Extract insights from general AI news that lawyers need to know.

What lawyers care about in AI newsletters:
1. **New AI capabilities** that could transform legal work (document analysis, research, contract review)
2. **Major AI company developments** (funding, valuations, new products) - shows market direction
3. **Enterprise AI tools** that law firms might adopt (productivity, automation, data analysis)
4. **AI accuracy/reliability issues** - affects professional responsibility
5. **Competitive intelligence** - what tools are gaining traction
6. **Technology trends** that will impact legal services delivery
7. **AI regulations, ethics, privacy** (direct legal relevance)
8. **Legal tech company news** - shows ecosystem health

HOW TO ANALYZE:
- For each AI tool/development mentioned, ask: "Could this help lawyers? How?"
- Extract market trends that signal where legal tech is heading
- Highlight tools lawyers could actually use (even if not legal-specific)
- Note funding/valuations of legal tech companies - shows investor confidence
- Explain WHY each item matters to law firms

CRITICAL CITATION RULES:
- EVERY fact MUST cite the source newsletter using the "citationId" field in square brackets
- Citation format: [Newsletter Name, Date]
- Example: "Company raised $500M [The Neuron, November 11, 2025]"
- Place citation immediately after the fact
- Multiple sources: "Tool launched [The Rundown, November 10, 2025][AI Tech In, November 11, 2025]"
- Do NOT state any fact without a citation
- Use the exact "citationId" provided for each newsletter

ACCURACY RULES:
- Only use facts explicitly stated in the newsletters
- Do not invent details not in the source
- If uncertain, omit the detail rather than guess

CITATION REQUIREMENTS (MANDATORY):
- EVERY factual claim MUST have a citation to a specific newsletter
- Use format: [Newsletter Name, Date]
- Place citations immediately after statements
- Multiple newsletters can be cited: [The Neuron, Nov 11][The Rundown, Nov 11]
- If you cannot cite a specific newsletter for a claim, DO NOT make that claim

FORMATTING REQUIREMENTS:
- Start directly with content (no title headers)
- Use **bold text** for company names, tool names, and key concepts
- Structure by themes/categories when doing summaries
- For each item: State the fact [Newsletter Name, Date], then explain why lawyers care
- Example: "**Microsoft Copilot** can now analyze spreadsheets hands-free [The Neuron, November 11, 2025]. This enables lawyers to query financial data in discovery or damages calculations without Excel formulas."
- Keep explanations concise but actionable
- Use bullet points for lists of 3+ items

Available newsletters:
${JSON.stringify(newsletterContext, null, 2)}`
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0.3,  // Lower temperature to reduce hallucination
        max_tokens: 3000
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
