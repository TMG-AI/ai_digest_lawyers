// international_filter.js
// Filter out international (non-US) articles at collection time

/**
 * International domain TLDs to block
 */
const INTERNATIONAL_TLDS = [
  '.co.uk', '.uk',
  '.com.au', '.au',
  '.ca',
  '.eu',
  '.de', '.fr', '.it', '.es', '.nl', '.be', '.ch', '.at', '.se', '.no', '.dk', '.fi',
  '.asia',
  '.in', '.cn', '.jp', '.kr', '.sg',
  '.br', '.mx', '.ar',
  '.co.za', '.nz',
  '.ie', '.pt', '.gr', '.pl', '.cz', '.ro', '.hu'
];

/**
 * International keywords that indicate non-US content
 * Focus on regional legal/regulatory terms and locations
 */
const INTERNATIONAL_KEYWORDS = [
  // UK
  'uk court', 'uk law', 'uk regulation', 'uk government', 'uk parliament',
  'british law', 'england and wales', 'scottish law', 'northern ireland',
  'ico uk', 'uk ico', 'uk competition',

  // EU/Europe
  'eu court', 'eu law', 'eu regulation', 'european commission', 'european parliament',
  'european union', 'gdpr enforcement', 'eu member state', 'european court',
  'brussels regulation', 'eu directive', 'european data protection',
  'eu artificial intelligence act', 'eu ai act',

  // Australia
  'australian law', 'australian court', 'australian regulation', 'australian privacy',
  'accc', 'australian competition',

  // Canada
  'canadian law', 'canadian court', 'canadian regulation', 'canadian privacy',
  'pipeda', 'supreme court of canada',

  // Other regions
  'singapore law', 'singapore court', 'singapore regulation',
  'hong kong law', 'hong kong court',
  'new zealand law', 'indian law', 'south african law'
];

/**
 * International news source domains to block
 */
const INTERNATIONAL_NEWS_SOURCES = [
  'bbc.com', 'bbc.co.uk',
  'theguardian.com', 'guardian.co.uk',
  'telegraph.co.uk',
  'thetimes.co.uk',
  'independent.co.uk',
  'ft.com', // Financial Times international
  'smh.com.au', 'theage.com.au',
  'globeandmail.com',
  'scmp.com', // South China Morning Post
  'straitstimes.com',
  'thelawyer.com', // UK legal publication
  'legalweek.com', // International legal
  'iberianlawyer.com',
  'lawyersweekly.com.au'
];

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Check if domain is international
 */
function isInternationalDomain(url) {
  const domain = extractDomain(url);
  if (!domain) return false;

  // Check international news sources
  if (INTERNATIONAL_NEWS_SOURCES.some(source => domain === source || domain.endsWith('.' + source))) {
    return true;
  }

  // Check TLDs
  return INTERNATIONAL_TLDS.some(tld => domain.endsWith(tld));
}

/**
 * Check if content contains international keywords
 */
function hasInternationalKeywords(title, summary, source) {
  const text = `${title} ${summary} ${source}`.toLowerCase();

  return INTERNATIONAL_KEYWORDS.some(keyword => {
    // Use word boundary to avoid false positives
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(text);
  });
}

/**
 * Main filter function - returns true if article should be BLOCKED
 * @param {string} title - Article title
 * @param {string} summary - Article summary/description
 * @param {string} link - Article URL
 * @param {string} source - Article source name
 * @returns {boolean} - True if international (should be blocked)
 */
export function isInternationalArticle(title, summary, link, source) {
  // Check domain
  if (isInternationalDomain(link)) {
    return true;
  }

  // Check content keywords
  if (hasInternationalKeywords(title, summary, source)) {
    return true;
  }

  return false;
}

/**
 * Get reason why article was blocked (for logging)
 */
export function getBlockReason(title, summary, link, source) {
  const domain = extractDomain(link);

  if (INTERNATIONAL_NEWS_SOURCES.some(s => domain === s || domain.endsWith('.' + s))) {
    return `International news source: ${domain}`;
  }

  if (INTERNATIONAL_TLDS.some(tld => domain.endsWith(tld))) {
    return `International domain: ${domain}`;
  }

  const text = `${title} ${summary} ${source}`.toLowerCase();
  const matchedKeyword = INTERNATIONAL_KEYWORDS.find(keyword => {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(text);
  });

  if (matchedKeyword) {
    return `International keyword: "${matchedKeyword}"`;
  }

  return 'International content';
}
