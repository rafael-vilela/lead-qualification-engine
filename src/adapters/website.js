import { rawSource, toFlag } from './normalize.js';

/**
 * Mock website adapter.
 *
 * Reads a fictional site audit from `lead.mockSources.website`. `{ exists: false }`
 * means "we know there is no website"; a missing entry means "unknown".
 */
export function createMockWebsiteAdapter() {
  return {
    source: 'website',
    async fetchSignals(lead) {
      const raw = rawSource(lead, 'website');
      if (!raw) return null;
      const exists = raw.exists !== false;
      return {
        exists,
        https: exists && toFlag(raw.https),
        mobileFriendly: exists && toFlag(raw.mobileFriendly),
        hasContactForm: exists && toFlag(raw.hasContactForm),
        hasOnlineBooking: exists && toFlag(raw.hasOnlineBooking),
      };
    },
  };
}
