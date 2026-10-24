import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockGoogleBusinessAdapter,
  createMockWebsiteAdapter,
  createMockInstagramAdapter,
  createMockAdapters,
} from '../src/adapters/index.js';

const fullLead = {
  id: 'lead-x',
  name: 'Example Co',
  mockSources: {
    googleBusiness: {
      rating: 4.6,
      reviewCount: 120,
      claimed: true,
      hasHours: true,
      ownerResponseRate: 0.4,
    },
    website: {
      url: 'https://example-co.example',
      https: true,
      mobileFriendly: false,
      hasContactForm: true,
      hasOnlineBooking: false,
    },
    instagram: { followers: 1500, postsLast30Days: 2, hasLinkInBio: false },
  },
};

test('google business adapter normalizes the mock profile', async () => {
  const signals = await createMockGoogleBusinessAdapter().fetchSignals(fullLead);
  assert.deepEqual(signals, {
    rating: 4.6,
    reviewCount: 120,
    claimed: true,
    hasHours: true,
    ownerResponseRate: 0.4,
    permanentlyClosed: false,
  });
});

test('website adapter normalizes the mock site audit', async () => {
  const signals = await createMockWebsiteAdapter().fetchSignals(fullLead);
  assert.deepEqual(signals, {
    exists: true,
    https: true,
    mobileFriendly: false,
    hasContactForm: true,
    hasOnlineBooking: false,
  });
});

test('instagram adapter normalizes the mock profile metrics', async () => {
  const signals = await createMockInstagramAdapter().fetchSignals(fullLead);
  assert.deepEqual(signals, { followers: 1500, postsLast30Days: 2, hasLinkInBio: false });
});

test('adapters return null when a source has no data for the lead', async () => {
  const lead = { id: 'lead-y', name: 'No Data Inc', mockSources: {} };
  for (const adapter of createMockAdapters()) {
    assert.equal(await adapter.fetchSignals(lead), null, `${adapter.source} should return null`);
  }
  const leadWithoutMocks = { id: 'lead-z', name: 'Nothing At All' };
  for (const adapter of createMockAdapters()) {
    assert.equal(await adapter.fetchSignals(leadWithoutMocks), null);
  }
});

test('website adapter distinguishes "no website" from "unknown"', async () => {
  const adapter = createMockWebsiteAdapter();
  const noSite = await adapter.fetchSignals({ id: 'a', name: 'A', mockSources: { website: { exists: false } } });
  assert.deepEqual(noSite, {
    exists: false,
    https: false,
    mobileFriendly: false,
    hasContactForm: false,
    hasOnlineBooking: false,
  });
  const unknown = await adapter.fetchSignals({ id: 'b', name: 'B', mockSources: {} });
  assert.equal(unknown, null);
});

test('adapters clamp out-of-range and malformed values', async () => {
  const lead = {
    id: 'lead-w',
    name: 'Weird Data LLC',
    mockSources: {
      googleBusiness: { rating: 7, reviewCount: -3, claimed: 'yes', ownerResponseRate: 1.5 },
      instagram: { followers: 'lots', postsLast30Days: 3.7 },
    },
  };
  const gb = await createMockGoogleBusinessAdapter().fetchSignals(lead);
  assert.equal(gb.rating, 5);
  assert.equal(gb.reviewCount, 0);
  assert.equal(gb.claimed, false, 'only a literal true counts as claimed');
  assert.equal(gb.ownerResponseRate, 1);

  const ig = await createMockInstagramAdapter().fetchSignals(lead);
  assert.equal(ig.followers, 0);
  assert.equal(ig.postsLast30Days, 3);
  assert.equal(ig.hasLinkInBio, false);
});

test('missing owner response rate stays unknown (null), not zero', async () => {
  const lead = { id: 'r', name: 'R', mockSources: { googleBusiness: { rating: 4 } } };
  const gb = await createMockGoogleBusinessAdapter().fetchSignals(lead);
  assert.equal(gb.ownerResponseRate, null);
});

test('createMockAdapters returns one adapter per source', () => {
  const sources = createMockAdapters().map((a) => a.source);
  assert.deepEqual(sources, ['googleBusiness', 'website', 'instagram']);
});
