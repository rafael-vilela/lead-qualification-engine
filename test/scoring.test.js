import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACTORS, scoreLead, tierFor } from '../src/scoring/index.js';

const strongLeadSignals = {
  googleBusiness: {
    rating: 4.7,
    reviewCount: 312,
    claimed: true,
    hasHours: true,
    ownerResponseRate: 0.1,
    permanentlyClosed: false,
  },
  website: { exists: false, https: false, mobileFriendly: false, hasContactForm: false, hasOnlineBooking: false },
  instagram: { followers: 2400, postsLast30Days: 14, hasLinkInBio: false },
};

const pointsById = (result) => Object.fromEntries(result.factors.map((f) => [f.id, f.points]));

test('factor weights add up to 100', () => {
  const total = FACTORS.reduce((sum, f) => sum + f.maxPoints, 0);
  assert.equal(total, 100);
});

test('every factor has an id, label, group and positive maxPoints', () => {
  for (const f of FACTORS) {
    assert.ok(f.id && f.label, `factor ${f.id} needs id and label`);
    assert.ok(['fit', 'opportunity'].includes(f.group), `factor ${f.id} has unknown group`);
    assert.ok(f.maxPoints > 0);
  }
});

test('scores a strong lead and explains every factor', () => {
  const result = scoreLead(strongLeadSignals);
  assert.deepEqual(pointsById(result), {
    reputation: 20,
    verified_profile: 10,
    social_activity: 15,
    audience: 10,
    website_gap: 20,
    conversion_gap: 10,
    review_response_gap: 10,
  });
  assert.equal(result.score, 95);
  assert.equal(result.maxScore, 100);
  assert.equal(result.tier, 'high');
  assert.equal(result.disqualified, false);
  for (const f of result.factors) {
    assert.equal(typeof f.reason, 'string');
    assert.ok(f.reason.length > 0, `factor ${f.id} must explain itself`);
    assert.ok(f.points >= 0 && f.points <= f.maxPoints);
  }
  const reputation = result.factors.find((f) => f.id === 'reputation');
  assert.match(reputation.reason, /4\.7/);
  assert.match(reputation.reason, /312 reviews/);
});

test('missing sources give zero points with an explicit "unavailable" reason', () => {
  const result = scoreLead({ googleBusiness: null, website: null, instagram: null });
  assert.equal(result.score, 0);
  assert.equal(result.tier, 'low');
  for (const f of result.factors) {
    assert.equal(f.points, 0);
    assert.match(f.reason, /unavailable/i);
  }
  assert.ok(result.warnings.some((w) => /coverage/i.test(w)));
});

test('a site without HTTPS and mobile support is a partial website gap', () => {
  const result = scoreLead({
    ...strongLeadSignals,
    website: { exists: true, https: false, mobileFriendly: false, hasContactForm: true, hasOnlineBooking: false },
  });
  const gap = result.factors.find((f) => f.id === 'website_gap');
  assert.equal(gap.points, 12);
  assert.match(gap.reason, /HTTPS/);
  assert.match(gap.reason, /mobile/i);
});

test('a healthy website is not counted as an opportunity', () => {
  const result = scoreLead({
    ...strongLeadSignals,
    website: { exists: true, https: true, mobileFriendly: true, hasContactForm: true, hasOnlineBooking: true },
    instagram: { followers: 2400, postsLast30Days: 14, hasLinkInBio: true },
  });
  const points = pointsById(result);
  assert.equal(points.website_gap, 0);
  assert.equal(points.conversion_gap, 0);
});

test('a permanently closed business is disqualified regardless of other signals', () => {
  const result = scoreLead({
    ...strongLeadSignals,
    googleBusiness: { ...strongLeadSignals.googleBusiness, permanentlyClosed: true },
  });
  assert.equal(result.disqualified, true);
  assert.equal(result.tier, 'disqualified');
  assert.equal(result.score, 0);
  assert.match(result.disqualifiedReason, /permanently closed/i);
  assert.equal(result.factors.length, FACTORS.length, 'factors are still reported for transparency');
});

test('low data coverage produces a warning', () => {
  const result = scoreLead({ googleBusiness: strongLeadSignals.googleBusiness, website: null, instagram: null });
  assert.ok(result.warnings.some((w) => /coverage/i.test(w)));
  const full = scoreLead(strongLeadSignals);
  assert.deepEqual(full.warnings, []);
});

test('tier thresholds', () => {
  assert.equal(tierFor(100), 'high');
  assert.equal(tierFor(70), 'high');
  assert.equal(tierFor(69), 'medium');
  assert.equal(tierFor(45), 'medium');
  assert.equal(tierFor(44), 'low');
  assert.equal(tierFor(0), 'low');
});
