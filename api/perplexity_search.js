// /api/perplexity_search.js
// Searches Perplexity for novel AI updates relevant to lawyers

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

  if (!PERPLEXITY_API_KEY) {
    return res.status(500).json({
      ok: false,
      error: 'Perplexity API key not configured. Please add PERPLEXITY_API_KEY to environment variables.'
    });
  }

  try {
    // Fixed prompt as requested
    const prompt = "Find me a diverse set of well-grounded novel updates on AI within the past two weeks that would be relevant to lawyers.";

    console.log('[Perplexity Search] Searching with prompt:', prompt);

    // Call Perplexity API
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online', // Perplexity's online model with web search
        messages: [
          {
            role: 'system',
            content: 'You are a legal tech research assistant specializing in AI developments relevant to the legal profession. Provide comprehensive, well-sourced updates with citations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000,
        return_citations: true,
        return_images: false
      })
    });

    if (!perplexityResponse.ok) {
      const errorText = await perplexityResponse.text();
      console.error('[Perplexity Search] API error:', perplexityResponse.status, errorText);

      return res.status(perplexityResponse.status).json({
        ok: false,
        error: `Perplexity API error: ${perplexityResponse.status} - ${errorText}`
      });
    }

    const data = await perplexityResponse.json();

    // Extract answer and citations
    const answer = data.choices?.[0]?.message?.content || 'No response from Perplexity';
    const citations = data.citations || [];

    console.log('[Perplexity Search] Success. Citations:', citations.length);

    return res.status(200).json({
      ok: true,
      answer,
      citations,
      model: data.model,
      usage: data.usage
    });

  } catch (error) {
    console.error('[Perplexity Search] Error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to search Perplexity'
    });
  }
}
