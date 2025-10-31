// blocked_domains.js
// MFA (Made For Advertising) and low-quality content farm domains to block

export const BLOCKED_DOMAINS = [
  // Stock ticker spam sites (pure spam - no editorial value)
  'themarketsdaily.com',
  'baseballnewssource.com',
  'tickerreport.com',
  'transcriptdaily.com',

  // Local TV news syndication (low value for legal tech audience)
  'fox13memphis.com',
  'kxii.com',
  'whas11.com',
  'mynews13.com',
  'wfmj.com',
  'mercedsunstar.com',
  'myheraldreview.com',

  // Yahoo aggregators (content farms)
  'finance.yahoo.com',
  'yahoo.com',

  // Generic content farms and low-quality aggregators
  'newsbreak.com',
  'omnilert.com',
  'refreshmiami.com',
  'appliedclinicaltrialsonline.com',
  'morningstar.com',
  'global.morningstar.com',
  'sharesmagazine.co.uk',
  'citizenportal.ai',
  'securityonline.info',
  'digestwire.com',
  'okenergytoday.com',

  // Low-value "Dive" network sites (keep cybersecuritydive.com)
  'k12dive.com',
  'medtechdive.com',
  'highereddive.com',

  // Low-value "ITBrief" network sites (keep itbrief.news)
  'itbrief.com.au',
  'itbrief.asia',
  'itbrief.co.uk',
  'securitybrief.com.au',
];

/**
 * Check if a URL should be blocked based on its domain
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL should be blocked
 */
export function isBlockedDomain(url) {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');

    return BLOCKED_DOMAINS.some(blocked => {
      const normalizedBlocked = blocked.toLowerCase();
      return hostname === normalizedBlocked || hostname.endsWith('.' + normalizedBlocked);
    });
  } catch (error) {
    // Invalid URL - don't block
    return false;
  }
}

/**
 * Get the domain from a URL for logging purposes
 * @param {string} url - The URL to extract domain from
 * @returns {string} - The domain name
 */
export function extractDomain(url) {
  if (!url) return 'unknown';
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}
