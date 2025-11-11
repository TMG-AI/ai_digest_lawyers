# AI Newsletters Feature - Setup Guide

## Overview
This feature allows you to collect AI newsletters via n8n webhook, store them for 30 days, and analyze them with an AI assistant focused on legal insights.

## What Was Built

### 1. **Webhook Endpoint** (`/api/newsletter_ingest.js`)
- Receives newsletters from n8n
- Stores in Vercel KV with 30-day TTL
- Indexes by date for efficient retrieval

**Endpoint:** `POST /api/newsletter_ingest`

**Expected Payload:**
```json
{
  "fullText": "Complete newsletter text...",
  "newsletterName": "The Neuron",
  "subject": "Today's AI News",
  "from": "theneuron@newsletter.theneurondaily.com",
  "timestamp": "2025-11-11T18:30:00.000Z",
  "date": "November 11, 2025"
}
```

### 2. **Data Retrieval API** (`/api/get_newsletters.js`)
- Fetches all newsletters from past month
- Can filter by specific date
- Returns newsletters grouped by date

**Endpoints:**
- `GET /api/get_newsletters` - All newsletters
- `GET /api/get_newsletters?date=November 11, 2025` - Specific date

### 3. **AI Assistant API** (`/api/chat_newsletters.js`)
- Analyzes newsletters with OpenAI GPT-4o-mini
- Focuses on legal relevance:
  - AI regulations & compliance
  - Legal ethics considerations
  - AI tools for legal practice
  - Data privacy & security
  - Case law involving AI
- Supports citations
- Can analyze all newsletters or specific date

**Endpoint:** `POST /api/chat_newsletters`

**Request Body:**
```json
{
  "question": "Summarize AI regulations relevant to law firms",
  "specificDate": "November 11, 2025"  // optional
}
```

### 4. **UI Page** (`/ai-newsletters.html`)
- View newsletters by date
- Expandable/collapsible cards
- AI Assistant with pre-built prompts
- "Monthly Legal Summary" button for comprehensive analysis

### 5. **Navigation Update**
- Replaced "Meltwater Dashboard" with "AI Newsletters" in homepage navigation
- AI Newsletters appears first in navigation

## n8n Webhook Setup

### Step 1: Create n8n Workflow

1. **Trigger Node:** Email trigger or RSS feed
2. **Data Processing Node:** Extract newsletter data
3. **HTTP Request Node:**
   - Method: POST
   - URL: `https://[your-domain].vercel.app/api/newsletter_ingest`
   - Headers: `Content-Type: application/json`
   - Body:
     ```json
     {
       "fullText": "{{ $json.body }}",
       "newsletterName": "The Neuron",
       "subject": "{{ $json.subject }}",
       "from": "{{ $json.from }}",
       "timestamp": "{{ $now.toISOString() }}",
       "date": "{{ $now.format('MMMM D, YYYY') }}"
     }
     ```

### Step 2: Configure Newsletter Sources

Add multiple n8n workflows for different newsletters:
- The Neuron
- AI Breakfast
- TLDR AI
- Import AI
- Etc.

## Environment Variables

Ensure these are set in Vercel:
- `OPENAI_API_KEY` - For AI assistant
- `PERPLEXITY_API_KEY` - (already configured)
- `KV1_REST_API_URL` - Vercel KV store
- `KV1_REST_API_TOKEN` - Vercel KV token

## Data Storage

**Storage Key Pattern:**
- Newsletters: `newsletter:{timestamp}:{newsletterName}`
- Date Index: `newsletter:date:{date}`

**Retention:** 30 days (automatically deleted after TTL expires)

**Why 30 days:** Allows for monthly digest generation and analysis

## Usage

### For Users:

1. **View Newsletters:**
   - Go to homepage → Click "AI Newsletters"
   - See all newsletters grouped by date
   - Click any newsletter to expand and read full text

2. **Navigate by Date:**
   - Click "All Dates" to see everything
   - Click specific date buttons to filter

3. **AI Assistant:**
   - Ask custom questions about newsletters
   - Click "Monthly Legal Summary" for automated analysis
   - AI focuses on legal/law firm relevant content

### Example AI Prompts:

- "Summarize all newsletters from this month focusing on AI regulations"
- "What AI tools mentioned would be useful for law firms?"
- "Are there any data privacy concerns lawyers should know about?"
- "What are the ethical considerations around AI in legal practice?"

## Testing

Run the test script:
```bash
node test_newsletter_flow.js
```

Or test manually:

1. **Test Webhook:**
```bash
curl -X POST https://[your-domain].vercel.app/api/newsletter_ingest \
  -H "Content-Type: application/json" \
  -d '{
    "fullText": "Test newsletter content",
    "newsletterName": "Test Newsletter",
    "subject": "Test",
    "from": "test@example.com",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
    "date": "'$(date +"%B %d, %Y")'"
  }'
```

2. **Test Retrieval:**
```bash
curl https://[your-domain].vercel.app/api/get_newsletters
```

3. **Test AI Chat:**
```bash
curl -X POST https://[your-domain].vercel.app/api/chat_newsletters \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the key AI developments?"}'
```

## Files Created/Modified

**New Files:**
- `/api/newsletter_ingest.js` - Webhook endpoint
- `/api/get_newsletters.js` - Data retrieval
- `/api/chat_newsletters.js` - AI assistant
- `/ai-newsletters.html` - UI page
- `/test_newsletter_flow.js` - Test script
- `/AI_NEWSLETTERS_SETUP.md` - This file

**Modified Files:**
- `/index.html` - Updated navigation (line 236)

## Architecture

```
n8n Workflow
    ↓
    ↓ (webhook POST)
    ↓
/api/newsletter_ingest.js
    ↓
    ↓ (store with TTL)
    ↓
Vercel KV Store
    ↓
    ↓ (retrieve)
    ↓
/api/get_newsletters.js
    ↓
    ↓ (display)
    ↓
/ai-newsletters.html
    ↓
    ↓ (analyze)
    ↓
/api/chat_newsletters.js
    ↓
    ↓ (AI insights)
    ↓
User sees legal-focused summary
```

## AI Assistant Prompting

The AI assistant is configured to:
- **Extract** legal implications from general AI newsletters
- **Highlight** regulations affecting lawyers/law firms
- **Identify** AI tools applicable to legal practice
- **Flag** ethics, privacy, and compliance issues
- **Cite** sources with inline citations [1][2][3]

Even though newsletters aren't law-focused, the AI filters for legal relevance.

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Configure n8n webhooks
3. ✅ Test with real newsletter
4. ✅ Monitor KV storage usage
5. ✅ Adjust TTL if needed (currently 30 days)

## Troubleshooting

**Newsletters not appearing:**
- Check n8n webhook logs
- Verify webhook URL is correct
- Check Vercel function logs
- Ensure all required fields are sent

**AI Assistant not working:**
- Verify OPENAI_API_KEY is set
- Check API quotas
- Review browser console for errors

**Storage issues:**
- Check Vercel KV limits
- Verify KV credentials are correct
- Monitor storage with Vercel dashboard

## Support

For issues or questions, check:
- Vercel function logs
- Browser developer console
- n8n execution logs
- Test script output
