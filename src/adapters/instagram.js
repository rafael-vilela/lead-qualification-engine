import { rawSource, toCount, toFlag } from './normalize.js';

/**
 * Mock Instagram adapter.
 *
 * Reads fictional, aggregate profile metrics from `lead.mockSources.instagram`.
 * No scraping, no login, no automation: just local data.
 */
export function createMockInstagramAdapter() {
  return {
    source: 'instagram',
    async fetchSignals(lead) {
      const raw = rawSource(lead, 'instagram');
      if (!raw) return null;
      return {
        followers: toCount(raw.followers),
        postsLast30Days: toCount(raw.postsLast30Days),
        hasLinkInBio: toFlag(raw.hasLinkInBio),
      };
    },
  };
}
