import { clampNumber, rawSource, toCount, toFlag } from './normalize.js';

/**
 * Mock Google Business adapter.
 *
 * Reads fictional data from `lead.mockSources.googleBusiness`. It never calls
 * the network. A production adapter would expose the same `fetchSignals`
 * contract but use an official, authorized API and respect its terms of use.
 */
export function createMockGoogleBusinessAdapter() {
  return {
    source: 'googleBusiness',
    async fetchSignals(lead) {
      const raw = rawSource(lead, 'googleBusiness');
      if (!raw) return null;
      return {
        rating: clampNumber(raw.rating, 0, 5),
        reviewCount: toCount(raw.reviewCount),
        claimed: toFlag(raw.claimed),
        hasHours: toFlag(raw.hasHours),
        ownerResponseRate: raw.ownerResponseRate == null ? null : clampNumber(raw.ownerResponseRate, 0, 1),
        permanentlyClosed: toFlag(raw.permanentlyClosed),
      };
    },
  };
}
