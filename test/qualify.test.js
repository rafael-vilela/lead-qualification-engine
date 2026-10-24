import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { qualifyLeads } from '../src/index.js';

const leads = [
  {
    id: 'weak',
    name: 'Weak Signals Shop',
    mockSources: { googleBusiness: { rating: 3.6, reviewCount: 12, claimed: false } },
  },
  {
    id: 'strong',
    name: 'Strong Signals Studio',
    mockSources: {
      googleBusiness: { rating: 4.7, reviewCount: 312, claimed: true, hasHours: true, ownerResponseRate: 0.1 },
      website: { exists: false },
      instagram: { followers: 2400, postsLast30Days: 14, hasLinkInBio: false },
    },
  },
  {
    id: 'closed',
    name: 'Closed Corner Store',
    mockSources: { googleBusiness: { rating: 4.9, reviewCount: 500, permanentlyClosed: true } },
  },
  { id: 'empty', name: 'Empty Profile', mockSources: {} },
];

let originalFetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('The engine must never make network calls');
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('returns leads ranked by score, highest first, with 1-based ranks', async () => {
  const result = await qualifyLeads(leads);
  assert.equal(result.count, 4);
  assert.deepEqual(
    result.leads.map((l) => l.id),
    ['strong', 'weak', 'empty', 'closed'],
  );
  assert.deepEqual(
    result.leads.map((l) => l.rank),
    [1, 2, 3, 4],
  );
  const scores = result.leads.map((l) => l.score);
  assert.deepEqual([...scores].sort((a, b) => b - a), scores);
});

test('disqualified leads always come last', async () => {
  const result = await qualifyLeads(leads);
  assert.equal(result.leads.at(-1).tier, 'disqualified');
});

test('ties are broken deterministically by name', async () => {
  const result = await qualifyLeads([
    { id: 'b', name: 'Bravo', mockSources: {} },
    { id: 'a', name: 'Alpha', mockSources: {} },
  ]);
  assert.deepEqual(
    result.leads.map((l) => l.id),
    ['a', 'b'],
  );
});

test('each ranked lead explains its priority', async () => {
  const result = await qualifyLeads(leads);
  const [top] = result.leads;
  assert.equal(top.score, 95);
  assert.equal(top.tier, 'high');
  assert.match(top.priorityReason, /^High priority \(95\/100\): /);
  assert.ok(Array.isArray(top.factors) && top.factors.length > 0);

  const closed = result.leads.find((l) => l.id === 'closed');
  assert.match(closed.priorityReason, /^Disqualified: /);

  const empty = result.leads.find((l) => l.id === 'empty');
  assert.match(empty.priorityReason, /no positive signals/i);
});

test('reports which sources were available for each lead', async () => {
  const result = await qualifyLeads(leads);
  const strong = result.leads.find((l) => l.id === 'strong');
  assert.deepEqual(strong.dataCoverage, {
    available: ['googleBusiness', 'website', 'instagram'],
    missing: [],
  });
  const weak = result.leads.find((l) => l.id === 'weak');
  assert.deepEqual(weak.dataCoverage, {
    available: ['googleBusiness'],
    missing: ['website', 'instagram'],
  });
});

test('custom adapters can be injected in place of the mocks', async () => {
  const calls = [];
  const fakeAdapter = (source, signals) => ({
    source,
    async fetchSignals(lead) {
      calls.push(`${source}:${lead.id}`);
      return signals;
    },
  });
  const result = await qualifyLeads([{ id: 'custom', name: 'Custom Source Co' }], {
    adapters: [
      fakeAdapter('googleBusiness', null),
      fakeAdapter('website', { exists: false, https: false, mobileFriendly: false, hasContactForm: false, hasOnlineBooking: false }),
      fakeAdapter('instagram', null),
    ],
  });
  assert.deepEqual(calls, ['googleBusiness:custom', 'website:custom', 'instagram:custom']);
  const websiteGap = result.leads[0].factors.find((f) => f.id === 'website_gap');
  assert.equal(websiteGap.points, 20);
});

test('rejects invalid input with a clear error', async () => {
  await assert.rejects(qualifyLeads('not an array'), TypeError);
  await assert.rejects(qualifyLeads([{ name: 'No id' }]), /id/);
  await assert.rejects(qualifyLeads([{ id: 'no-name' }]), /name/);
});
